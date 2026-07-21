const { Fattura, Ordine, RigaOrdine, Utente } = require('../models')
const fatturaService = require('../services/fatturaService')

// contabilità: coda degli ordini evasi ma non ancora fatturati
const codaDaFatturare = async (req, res) => {
    try {
        const ordini = await Ordine.findAll({
            where: { stato: 'EVASO' },
            include: [
                { model: RigaOrdine, as: 'righe' },
                { model: Utente, as: 'user', attributes: ['id', 'nome', 'cognome', 'email'] }
            ],
            order: [['createdAt', 'ASC']]
        })
        return res.status(200).json(ordini)
    } catch (error) {
        console.error('Errore durante il recupero della coda da fatturare:', error)
        return res.status(500).json({ message: 'Errore interno del server' })
    }
}

// contabilità: genera la fattura da un ordine evaso, con dati precompilati dall'ordine
const genera = async (req, res) => {
    try {
        const { ordineId } = req.body
        if (!ordineId) {
            return res.status(400).json({ message: 'ordineId obbligatorio' })
        }

        const fattura = await fatturaService.generaFattura(ordineId)
        return res.status(201).json({
            message: 'Fattura generata con successo',
            fattura
        })
    } catch (error) {
        console.error('Errore durante la generazione della fattura:', error)
        return res.status(error.status || 500).json({
            message: error.status ? error.message : 'Errore interno del server durante la generazione della fattura'
        })
    }
}

// contabilità: storico fatture, ricercabile per numero, ordine, cliente o intervallo di date
const lista = async (req, res) => {
    try {
        const fatture = await fatturaService.listaFatture(req.query)
        return res.status(200).json(fatture)
    } catch (error) {
        console.error('Errore durante il recupero delle fatture:', error)
        return res.status(500).json({ message: 'Errore interno del server' })
    }
}

// dettaglio di una fattura
const visualizzaFattura = async (req, res) => {
    try {
        const { id } = req.params
        const fattura = await Fattura.findByPk(id, {
            include: [{
                model: Ordine,
                as: 'ordine',
                include: [
                    { model: RigaOrdine, as: 'righe' },
                    { model: Utente, as: 'user', attributes: ['id', 'nome', 'cognome', 'email'] }
                ]
            }]
        })

        if (!fattura) {
            return res.status(404).json({ message: 'Fattura non trovata' })
        }

        return res.status(200).json(fattura)
    } catch (error) {
        console.error('Errore durante il recupero della fattura:', error)
        return res.status(500).json({ message: 'Errore interno del server' })
    }
}

// scarica il pdf della fattura
const scaricaPdf = async (req, res) => {
    try {
        const { id } = req.params
        const fattura = await Fattura.findByPk(id)

        if (!fattura) {
            return res.status(404).json({ message: 'Fattura non trovata' })
        }

        return res.download(fattura.percorso_pdf, `fattura_${fattura.numero_fattura}.pdf`, (error) => {
            if (error && !res.headersSent) {
                console.error('Errore durante l\'invio del PDF:', error)
                res.status(500).json({ message: 'Errore durante il recupero del PDF' })
            }
        })
    } catch (error) {
        console.error('Errore durante lo scaricamento della fattura:', error)
        return res.status(500).json({ message: 'Errore interno del server' })
    }
}

module.exports = { codaDaFatturare, genera, lista, visualizzaFattura, scaricaPdf }
