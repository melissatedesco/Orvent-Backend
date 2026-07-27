const { sequelize, Ordine, RigaOrdine, Prodotto } = require('../models')
const { eseguiConRetrySuDeadlock } = require('../utils/transazioni')

// L'ordinamento dei lock sui prodotti (per prodottoId/prodotto_id) elimina i cicli
// di attesa SU QUELLA risorsa, ma evadiOrdine locka l'ordine con un JOIN su RigaOrdine
// (SELECT ... FOR UPDATE su un indice secondario, ordine_id): questo prende anche dei
// next-key/gap lock sull'indice, che possono entrare in conflitto con l'INSERT di una
// creaOrdine concorrente (bulkCreate su righe_ordine di un ordine diverso) tramite un
// meccanismo indipendente dal lock sulle righe prodotto. Da qui il retry-su-deadlock
// condiviso in src/utils/transazioni.js (usato anche da fatturaService).

// crea un ordine dal carrello: congela prezzo e unita' di misura del prodotto al momento dell'invio
// e verifica solo la disponibilita' (lo stock viene scalato in fase di evasione, non alla creazione,
// perche' e' l'operatore di magazzino a confermare la preparazione)
const creaOrdine = async (utenteId, righeCarrello) => {
    if (!Array.isArray(righeCarrello) || righeCarrello.length === 0) {
        const errore = new Error('Il carrello non può essere vuoto')
        errore.status = 400
        throw errore
    }

    return eseguiConRetrySuDeadlock(() => sequelize.transaction(async (t) => {
        let totale = 0
        const righeDaCreare = []
        // solo transazione qui dentro: niente PDF/email/filesystem, vedi commento su eseguiConRetrySuDeadlock

        // stesso ordinamento per prodottoId usato in evadiOrdine: i prodotti si lockano
        // SEMPRE nella stessa sequenza in ogni percorso che acquisisce piu' lock nella
        // stessa transazione. Altrimenti una creaOrdine con le righe [7, 3] concorrente a
        // un'altra creaOrdine (o a un evadiOrdine, che ordina per prodotto_id) su [3, 7]
        // formerebbero comunque un ciclo di attesa: il deadlock non dipende da quale dei
        // due percorsi sia "l'evasione", ma dal fatto che i criteri di lock divergano
        const righeOrdinate = [...righeCarrello].sort((a, b) => a.prodottoId - b.prodottoId)

        for (const { prodottoId, quantita } of righeOrdinate) {
            // Number.isFinite, non solo "<= 0": con quantita non numerica (es. "abc"),
            // parseFloat restituisce NaN e "NaN <= 0" e' false, quindi senza questo
            // controllo il ramo d'errore non scatterebbe e il NaN si propagherebbe nel
            // totale dell'ordine invece di essere respinto con un 400 pulito
            const quantitaNumerica = parseFloat(quantita)
            if (!prodottoId || quantita === undefined || !Number.isFinite(quantitaNumerica) || quantitaNumerica <= 0) {
                const errore = new Error('Ogni riga del carrello deve indicare prodottoId e una quantità numerica maggiore di zero')
                errore.status = 400
                throw errore
            }

            const prodotto = await Prodotto.findByPk(prodottoId, { transaction: t, lock: t.LOCK.UPDATE })

            if (!prodotto || !prodotto.attivo) {
                const errore = new Error(`Prodotto ${prodottoId} non disponibile`)
                errore.status = 404
                throw errore
            }

            if (!prodotto.haScortaSufficiente(quantita)) {
                const errore = new Error(`Scorta insufficiente per il prodotto "${prodotto.nome}"`)
                errore.status = 409
                throw errore
            }

            const prezzo_congelato = prodotto.prezzo
            totale += parseFloat(prezzo_congelato) * parseFloat(quantita)

            righeDaCreare.push({
                prodotto_id: prodotto.id,
                quantita,
                prezzo_congelato,
                unita_misura_congelata: prodotto.tipo_unita,
                codice_congelato: prodotto.sku,
                descrizione_congelata: prodotto.nome,
                aliquota_congelata: prodotto.aliquota_iva
            })
        }

        const ordine = await Ordine.create({
            user_id: utenteId,
            stato: 'NUOVO',
            totale_importo: totale.toFixed(2)
        }, { transaction: t })

        await RigaOrdine.bulkCreate(
            righeDaCreare.map(riga => ({ ...riga, ordine_id: ordine.id })),
            { transaction: t }
        )

        return Ordine.findByPk(ordine.id, {
            include: [{ model: RigaOrdine, as: 'righe' }],
            transaction: t
        })
    }), { contesto: `creaOrdine utente ${utenteId}` })
}

// il cliente annulla un proprio ordine: consentito solo da NUOVO, prima che l'operatore lo prenda
// in carico o scali lo stock. Non è una cancellazione fisica: l'ordine resta con stato ANNULLATO
const annullaOrdine = async (ordineId, utenteId) => {
    const ordine = await Ordine.findByPk(ordineId)
    if (!ordine) {
        const errore = new Error('Ordine non trovato')
        errore.status = 404
        throw errore
    }

    if (ordine.user_id !== utenteId) {
        const errore = new Error('Non puoi annullare un ordine che non ti appartiene')
        errore.status = 403
        throw errore
    }

    if (ordine.stato !== 'NUOVO') {
        const errore = new Error(`Impossibile annullare un ordine in stato ${ordine.stato}`)
        errore.status = 400
        throw errore
    }

    ordine.stato = 'ANNULLATO'
    await ordine.save()
    return ordine
}

// l'operatore di magazzino prende in carico l'ordine
const prendiInCarico = async (ordineId) => {
    const ordine = await Ordine.findByPk(ordineId)
    if (!ordine) {
        const errore = new Error('Ordine non trovato')
        errore.status = 404
        throw errore
    }

    if (ordine.stato !== 'NUOVO') {
        const errore = new Error(`Impossibile prendere in carico un ordine in stato ${ordine.stato}`)
        errore.status = 400
        throw errore
    }

    ordine.stato = 'IN_EVASIONE'
    await ordine.save()
    return ordine
}

// evade l'ordine: riverifica la disponibilita' e scala lo stock in modo atomico e transazionale,
// cosi' la scorta non scende mai sotto zero anche in caso di evasioni concorrenti
const evadiOrdine = async (ordineId, idOperatore) => {
    // solo transazione qui dentro: niente PDF/email/filesystem, vedi commento su eseguiConRetrySuDeadlock
    return eseguiConRetrySuDeadlock(() => sequelize.transaction(async (t) => {
        const ordine = await Ordine.findByPk(ordineId, {
            include: [{ model: RigaOrdine, as: 'righe' }],
            transaction: t,
            lock: t.LOCK.UPDATE
        })

        if (!ordine) {
            const errore = new Error('Ordine non trovato')
            errore.status = 404
            throw errore
        }

        if (!['NUOVO', 'IN_EVASIONE'].includes(ordine.stato)) {
            const errore = new Error(`Impossibile evadere un ordine in stato ${ordine.stato}`)
            errore.status = 400
            throw errore
        }

        // le righe si lockano SEMPRE nello stesso ordine (per prodotto_id crescente):
        // due evasioni concorrenti che coinvolgono gli stessi prodotti in sequenza diversa
        // (es. ordine A: prodotti 5,8 - ordine B: prodotti 8,5) altrimenti si bloccherebbero
        // a vicenda in attesa reciproca (deadlock), che MySQL risolverebbe abortendo una
        // delle due transazioni con un errore non gestito invece del consueto 409
        const righeOrdinate = [...ordine.righe].sort((a, b) => a.prodotto_id - b.prodotto_id)

        for (const riga of righeOrdinate) {
            const prodotto = await Prodotto.findByPk(riga.prodotto_id, { transaction: t, lock: t.LOCK.UPDATE })

            if (!prodotto.haScortaSufficiente(riga.quantita)) {
                const errore = new Error(`Scorta insufficiente per il prodotto "${prodotto.nome}", impossibile evadere l'ordine`)
                errore.status = 409
                throw errore
            }

            prodotto.scorta = parseFloat(prodotto.scorta) - parseFloat(riga.quantita)
            await prodotto.save({ transaction: t })
        }

        // tracciabilita': chi ha evaso l'ordine e quando
        ordine.stato = 'EVASO'
        ordine.operatore_id = idOperatore
        ordine.data_evasione = new Date()
        await ordine.save({ transaction: t })
        return ordine
    }), { contesto: `evadiOrdine ordine ${ordineId}` })
}

module.exports = { creaOrdine, annullaOrdine, prendiInCarico, evadiOrdine }
