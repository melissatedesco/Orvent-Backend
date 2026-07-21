const fs = require('fs')
const path = require('path')
const { Op } = require('sequelize')
const PDFDocument = require('pdfkit')
const { sequelize, Fattura, Ordine, RigaOrdine, Prodotto, Utente } = require('../models')

const ALIQUOTA_IVA = 0.22
const CARTELLA_FATTURE = path.join(__dirname, '..', '..', 'output', 'fatture')

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

        doc.fontSize(12).text(`Fattura n. ${fattura.numero_fattura}`)
        doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`)
        doc.text(`Ordine n. ${ordine.id}`)
        doc.moveDown()

        if (ordine.user) {
            doc.text(`Cliente: ${ordine.user.nome} ${ordine.user.cognome}`)
            doc.text(`Email: ${ordine.user.email}`)
            doc.moveDown()
        }

        doc.fontSize(12).text('Dettaglio ordine', { underline: true })
        doc.moveDown(0.5)

        ordine.righe.forEach(riga => {
            const nomeProdotto = riga.prodotto ? riga.prodotto.nome : `Prodotto #${riga.prodotto_id}`
            const subtotale = (parseFloat(riga.prezzo_congelato) * parseFloat(riga.quantita)).toFixed(2)
            doc.fontSize(10).text(
                `${nomeProdotto} - ${riga.quantita} ${riga.unita_misura_congelata} x ${parseFloat(riga.prezzo_congelato).toFixed(2)} € = ${subtotale} €`
            )
        })

        doc.moveDown()
        doc.fontSize(12).text(`Imponibile: ${parseFloat(fattura.importo_imponibile).toFixed(2)} €`)
        doc.text(`IVA (${(ALIQUOTA_IVA * 100).toFixed(0)}%): ${parseFloat(fattura.importo_iva).toFixed(2)} €`)
        doc.fontSize(14).text(`Totale: ${parseFloat(fattura.importo_totale).toFixed(2)} €`)

        doc.end()

        stream.on('finish', () => resolve(percorsoAssoluto))
        stream.on('error', reject)
    })
}

// genera la fattura da un ordine evaso: numerazione progressiva senza interruzioni,
// calcolo automatico di imponibile/IVA/totale e produzione del PDF
const generaFattura = async (ordineId) => {
    return sequelize.transaction(async (t) => {
        const ordine = await Ordine.findByPk(ordineId, {
            include: [
                { model: RigaOrdine, as: 'righe', include: [{ model: Prodotto, as: 'prodotto' }] },
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

        if (ordine.stato !== 'EVASO') {
            const errore = new Error(`Impossibile fatturare un ordine in stato ${ordine.stato}`)
            errore.status = 400
            throw errore
        }

        // FOR UPDATE sull'intera tabella serializza le generazioni concorrenti, cosi'
        // la numerazione progressiva resta univoca e senza interruzioni (requisito fiscale)
        const [[{ max }]] = await sequelize.query(
            'SELECT MAX(numero_fattura) as max FROM fatture FOR UPDATE',
            { transaction: t }
        )
        const numeroFattura = (max || 0) + 1

        const imponibile = parseFloat(ordine.totale_importo)
        const iva = imponibile * ALIQUOTA_IVA
        const totale = imponibile + iva

        const fattura = await Fattura.create({
            ordine_id: ordine.id,
            numero_fattura: numeroFattura,
            importo_imponibile: imponibile.toFixed(2),
            importo_iva: iva.toFixed(2),
            importo_totale: totale.toFixed(2),
            percorso_pdf: 'in_generazione'
        }, { transaction: t })

        fattura.percorso_pdf = await generaPdf(fattura, ordine)
        await fattura.save({ transaction: t })

        ordine.stato = 'FATTURATO'
        await ordine.save({ transaction: t })

        return fattura
    })
}

// storico fatture, ricercabile per numero, ordine, cliente o intervallo di date
const listaFatture = async (filtri = {}) => {
    const { numero, ordineId, cliente, dal, al } = filtri
    const where = {}

    if (numero) where.numero_fattura = numero
    if (ordineId) where.ordine_id = ordineId
    if (dal || al) {
        where.createdAt = {}
        if (dal) where.createdAt[Op.gte] = new Date(dal)
        if (al) where.createdAt[Op.lte] = new Date(al)
    }

    const includeUtente = {
        model: Utente,
        as: 'user',
        attributes: ['id', 'nome', 'cognome', 'email']
    }

    if (cliente) {
        includeUtente.where = {
            [Op.or]: [
                { nome: { [Op.like]: `%${cliente}%` } },
                { cognome: { [Op.like]: `%${cliente}%` } },
                { email: { [Op.like]: `%${cliente}%` } }
            ]
        }
    }

    return Fattura.findAll({
        where,
        include: [{
            model: Ordine,
            as: 'ordine',
            include: [includeUtente]
        }],
        order: [['numero_fattura', 'DESC']]
    })
}

module.exports = { generaFattura, listaFatture }
