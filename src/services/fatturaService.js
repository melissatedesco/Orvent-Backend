const fs = require('fs')
const path = require('path')
const { Op } = require('sequelize')
const PDFDocument = require('pdfkit')
const { sequelize, Fattura, Ordine, RigaOrdine, Utente } = require('../models')
const { eseguiConRetrySuDeadlock } = require('../utils/transazioni')

const CARTELLA_FATTURE = path.join(__dirname, '..', '..', 'output', 'fatture')

// arrotonda un valore monetario a 2 decimali. Va applicato riga per riga, PRIMA di
// sommare: se si sommano valori grezzi e si arrotonda solo il totale, la somma degli
// importi stampati riga per riga nel PDF puo' differire di un centesimo dal totale
// salvato in fattura (il classico documento che "non torna").
const arrotonda = (valore) => Math.round(valore * 100) / 100

// calcola imponibile e IVA di una singola riga, sempre nello stesso modo: sia il PDF
// che il calcolo dei totali di fattura usano questa funzione, cosi' non possono mai
// disallinearsi tra loro
const calcolaRiga = (riga) => {
    const imponibileRiga = arrotonda(parseFloat(riga.prezzo_congelato) * parseFloat(riga.quantita))
    const ivaRiga = arrotonda(imponibileRiga * (parseFloat(riga.aliquota_congelata) / 100))
    return { imponibileRiga, ivaRiga }
}

// compone l'indirizzo congelato in fattura da via/CAP/città/provincia dell'utente
const componiIndirizzo = (utente) => {
    if (!utente.indirizzo) return null
    let indirizzo = utente.indirizzo
    if (utente.cap || utente.citta) {
        indirizzo += `, ${[utente.cap, utente.citta].filter(Boolean).join(' ')}`
    }
    if (utente.provincia) indirizzo += ` (${utente.provincia})`
    return indirizzo
}

// una fattura senza destinatario identificabile non e' un documento fiscale valido:
// l'indirizzo e' sempre obbligatorio, mentre partita IVA e codice fiscale sono alternativi
// (aziende B2B hanno la prima, privati B2C il secondo: non serve che li abbiano entrambi)
const validaProfiloFiscale = (utente) => {
    if (!utente.indirizzo) {
        const errore = new Error('Profilo fiscale del cliente incompleto: manca l\'indirizzo.')
        errore.status = 400
        throw errore
    }
    if (!utente.partita_iva && !utente.codice_fiscale) {
        const errore = new Error('Profilo fiscale del cliente incompleto: manca partita IVA o codice fiscale.')
        errore.status = 400
        throw errore
    }
}

// genera il pdf della fattura su disco e restituisce il percorso del file
const generaPdf = (fattura, ordine) => {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(CARTELLA_FATTURE, { recursive: true })

        const percorsoAssoluto = path.join(CARTELLA_FATTURE, `fattura_${fattura.numero_fattura}.pdf`)
        const doc = new PDFDocument({ margin: 50 })
        const stream = fs.createWriteStream(percorsoAssoluto)

        doc.pipe(stream)

        doc.fontSize(20).text('Orvent', { align: 'left' })
        doc.fontSize(10).text('Fattura', { align: 'left' })
        doc.moveDown()

        // fattura.createdAt, non new Date(): e' il timestamp del commit originale, scritto
        // una sola volta. Una rigenerazione (percorso di recupero) puo' avvenire giorni
        // dopo l'emissione: se qui si leggesse l'orologio corrente, due PDF con lo stesso
        // numero (l'originale e il rigenerato) stamperebbero date diverse
        doc.fontSize(12).text(`Fattura n. ${fattura.numero_fattura}`)
        doc.text(`Data: ${fattura.createdAt.toLocaleDateString('it-IT')}`)
        doc.text(`Ordine n. ${ordine.id}`)
        doc.moveDown()

        // dati cliente letti dalla fattura stessa (congelati alla generazione), mai dal
        // profilo utente corrente: la fattura e' un documento fiscale chiuso
        doc.text(`Cliente: ${fattura.cliente_ragione_sociale}`)
        if (fattura.cliente_partita_iva) doc.text(`P.IVA: ${fattura.cliente_partita_iva}`)
        if (fattura.cliente_codice_fiscale) doc.text(`C.F.: ${fattura.cliente_codice_fiscale}`)
        doc.text(`Indirizzo: ${fattura.cliente_indirizzo}`)
        doc.moveDown()

        doc.fontSize(12).text('Dettaglio ordine', { underline: true })
        doc.moveDown(0.5)

        // descrizione/codice/aliquota letti dalla riga d'ordine (congelati alla creazione),
        // mai dal catalogo prodotti corrente: se il prodotto viene rinominato o la sua
        // aliquota cambia dopo l'ordine, il documento fiscale gia' emesso non deve cambiare
        ordine.righe.forEach(riga => {
            const { imponibileRiga } = calcolaRiga(riga)
            doc.fontSize(10).text(
                `[${riga.codice_congelato}] ${riga.descrizione_congelata} - ${riga.quantita} ${riga.unita_misura_congelata} x ${parseFloat(riga.prezzo_congelato).toFixed(2)} € (IVA ${parseFloat(riga.aliquota_congelata).toFixed(0)}%) = ${imponibileRiga.toFixed(2)} €`
            )
        })

        // niente percentuale unica in fattura: prodotti diversi possono avere
        // aliquote diverse (vedi dettaglio riga per riga sopra)
        doc.moveDown()
        doc.fontSize(12).text(`Imponibile: ${parseFloat(fattura.importo_imponibile).toFixed(2)} €`)
        doc.text(`IVA: ${parseFloat(fattura.importo_iva).toFixed(2)} €`)
        doc.fontSize(14).text(`Totale: ${parseFloat(fattura.importo_totale).toFixed(2)} €`)

        doc.end()

        stream.on('finish', () => resolve(percorsoAssoluto))
        stream.on('error', reject)
    })
}

// genera la fattura da un ordine evaso: numerazione progressiva senza interruzioni,
// calcolo di imponibile/IVA/totale in una transazione BREVE (sola scrittura DB), poi
// produzione del PDF DOPO il commit: un fallimento nella scrittura su disco (lenta,
// non transazionale) non deve tenere bloccati per tutta la sua durata i lock fiscali
// critici (numerazione progressiva, riga ordine) che servono solo per il passo 1
const generaFattura = async (ordineId) => {
    const { fattura, ordine } = await eseguiConRetrySuDeadlock(() => sequelize.transaction(async (t) => {
        // niente include verso Prodotto: le righe portano gia' i dati congelati
        // (descrizione_congelata, codice_congelato) di cui il documento ha bisogno
        const ordine = await Ordine.findByPk(ordineId, {
            include: [
                { model: RigaOrdine, as: 'righe' },
                { model: Utente, as: 'user' }
            ],
            transaction: t,
            lock: t.LOCK.UPDATE
        })

        if (!ordine) {
            const errore = new Error('Ordine non trovato')
            errore.status = 404
            throw errore
        }

        if (ordine.stato === 'FATTURATO') {
            // puo' essere un doppio tentativo di fatturazione, oppure il completamento di
            // un PDF rimasto in sospeso per un fallimento precedente (percorso_pdf nullo,
            // numero e importi pero' gia' committati): in questo caso riusiamo la stessa
            // fattura gia' numerata invece di rifiutare o crearne una seconda
            const fatturaEsistente = await Fattura.findOne({ where: { ordine_id: ordine.id }, transaction: t })
            if (fatturaEsistente && !fatturaEsistente.percorso_pdf) {
                return { fattura: fatturaEsistente, ordine }
            }
            const errore = new Error(`Impossibile fatturare un ordine in stato ${ordine.stato}`)
            errore.status = 400
            throw errore
        }

        if (ordine.stato !== 'EVASO') {
            const errore = new Error(`Impossibile fatturare un ordine in stato ${ordine.stato}`)
            errore.status = 400
            throw errore
        }

        // meglio bloccare qui, alla contabile, con un 400 esplicito, che scoprire a
        // fattura gia' emessa che il destinatario e' vuoto o incompleto
        validaProfiloFiscale(ordine.user)

        // FOR UPDATE sull'intera tabella serializza le generazioni concorrenti, cosi'
        // la numerazione progressiva resta univoca e senza interruzioni (requisito fiscale)
        const [[{ max }]] = await sequelize.query(
            'SELECT MAX(numero_fattura) as max FROM fatture FOR UPDATE',
            { transaction: t }
        )
        const numeroFattura = (max || 0) + 1

        // imponibile e IVA si ricalcolano riga per riga (dai dati gia' congelati sulla
        // riga, mai dal catalogo) e si arrotondano PRIMA di sommare: cosi' il totale
        // salvato coincide sempre con la somma degli importi stampati riga per riga
        let imponibile = 0
        let iva = 0
        for (const riga of ordine.righe) {
            const { imponibileRiga, ivaRiga } = calcolaRiga(riga)
            imponibile += imponibileRiga
            iva += ivaRiga
        }
        imponibile = arrotonda(imponibile)
        iva = arrotonda(iva)
        const totale = arrotonda(imponibile + iva)

        const fattura = await Fattura.create({
            ordine_id: ordine.id,
            numero_fattura: numeroFattura,
            importo_imponibile: imponibile.toFixed(2),
            importo_iva: iva.toFixed(2),
            importo_totale: totale.toFixed(2),
            percorso_pdf: null,
            // congeliamo i dati cliente cosi' come sono ORA: se il profilo utente cambia
            // in futuro, questa fattura gia' emessa non deve risentirne
            cliente_ragione_sociale: `${ordine.user.nome} ${ordine.user.cognome}`,
            cliente_partita_iva: ordine.user.partita_iva || null,
            cliente_codice_fiscale: ordine.user.codice_fiscale || null,
            cliente_indirizzo: componiIndirizzo(ordine.user)
        }, { transaction: t })

        ordine.stato = 'FATTURATO'
        await ordine.save({ transaction: t })

        return { fattura, ordine }
    }), { contesto: `generaFattura ordine ${ordineId}` })

    // FUORI dalla transazione, dopo il commit: numero, importi e stato dell'ordine sono
    // gia' persistiti. Se la scrittura del PDF fallisce da qui in poi, il numero non
    // viene bruciato ne' l'ordine resta in uno stato incoerente: la fattura resta con
    // percorso_pdf nullo, completabile da un tentativo successivo (vedi ramo sopra)
    fattura.percorso_pdf = await generaPdf(fattura, ordine)
    await fattura.save()

    return fattura
}

// storico fatture, ricercabile per numero, ordine, cliente o intervallo di date
// la ricerca per cliente lavora sui dati CONGELATI in fattura (cliente_ragione_sociale),
// non su un join live verso Utente: il profilo utente puo' essere cambiato nel frattempo
const listaFatture = async (filtri = {}) => {
    const { numero, ordineId, cliente, dal, al } = filtri
    const where = {}

    if (numero) where.numero_fattura = numero
    if (ordineId) where.ordine_id = ordineId
    if (cliente) where.cliente_ragione_sociale = { [Op.like]: `%${cliente}%` }
    if (dal || al) {
        where.createdAt = {}
        if (dal) where.createdAt[Op.gte] = new Date(dal)
        if (al) where.createdAt[Op.lte] = new Date(al)
    }

    return Fattura.findAll({
        where,
        include: [{ model: Ordine, as: 'ordine' }],
        order: [['numero_fattura', 'DESC']]
    })
}

module.exports = { generaFattura, listaFatture }
