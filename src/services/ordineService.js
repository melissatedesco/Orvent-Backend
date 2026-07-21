const { sequelize, Ordine, RigaOrdine, Prodotto } = require('../models')

// crea un ordine dal carrello: congela prezzo e unita' di misura del prodotto al momento dell'invio
// e verifica solo la disponibilita' (lo stock viene scalato in fase di evasione, non alla creazione,
// perche' e' l'operatore di magazzino a confermare la preparazione)
const creaOrdine = async (utenteId, righeCarrello) => {
    if (!Array.isArray(righeCarrello) || righeCarrello.length === 0) {
        const errore = new Error('Il carrello non può essere vuoto')
        errore.status = 400
        throw errore
    }

    return sequelize.transaction(async (t) => {
        let totale = 0
        const righeDaCreare = []

        for (const { prodottoId, quantita } of righeCarrello) {
            if (!prodottoId || quantita === undefined || parseFloat(quantita) <= 0) {
                const errore = new Error('Ogni riga del carrello deve indicare prodottoId e una quantità maggiore di zero')
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
                unita_misura_congelata: prodotto.tipo_unita
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
    })
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
const evadiOrdine = async (ordineId) => {
    return sequelize.transaction(async (t) => {
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

        for (const riga of ordine.righe) {
            const prodotto = await Prodotto.findByPk(riga.prodotto_id, { transaction: t, lock: t.LOCK.UPDATE })

            if (!prodotto.haScortaSufficiente(riga.quantita)) {
                const errore = new Error(`Scorta insufficiente per il prodotto "${prodotto.nome}", impossibile evadere l'ordine`)
                errore.status = 409
                throw errore
            }

            prodotto.scorta = parseFloat(prodotto.scorta) - parseFloat(riga.quantita)
            await prodotto.save({ transaction: t })
        }

        ordine.stato = 'EVASO'
        await ordine.save({ transaction: t })
        return ordine
    })
}

module.exports = { creaOrdine, annullaOrdine, prendiInCarico, evadiOrdine }
