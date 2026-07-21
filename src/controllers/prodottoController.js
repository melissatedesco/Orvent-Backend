const {Prodotto} = require('../models')

const prodottoController = {
    // creazione di un nuovo prodotto
    crea: async (req, res) => {
        try {
            // estaiamo i dati dal corpo della richiesta
            const { sku, nome, descrizione, prezzo, scorta, tipo_unita } = req.body

            // validazione base dei campi obbligatori
            if (!sku || !nome || prezzo === undefined || !tipo_unita) {
                return res.status(400).json({
                    message: 'I campi SKU, Nome, prezzo e tipo_unita sono obbligatori'
                })
            }

            // verifichiamo se lo sku (codice univoco del prodotto) esiste già
            const skuEsistente = await Prodotto.findOne({ where: {sku}})
            if(skuEsistente) {
                return res.status(400).json({
                    message: `Lo SKU '${sku}' è già associato a un altro prodotto`
                })
            }

            // creiamo il prodotto nel db
            const nuovoProdotto =await Prodotto.create({
                sku,
                nome,
                descrizione,
                prezzo,
                tipo_unita,
                scorta: scorta || 0
            })

            return res.status(201).json({
                message: 'Prodotto creato con successo!',
                prodotto: nuovoProdotto
            })

        } catch (error) {
            console.error('Errore durante la creazione del prodotto:', error)
            return res.status(500).json({
                message: 'Errore interneo del server durante la creazione del prodotto'
            })
        }
    },

    // visualizza la lista di tutti i prodotti, solo gli utenti loggati
    lista: async (req, res) => {
        try {
            const prodotti = await Prodotto.findAll()
            return res.status(200).json(prodotti)
        } catch (error) {
            console.error('Errore durante il recupero dei prodotti:', error)
            return res.status(500).json({
                messaggio: 'Errore interno del server durante il recupero del catalogo'
            })
        }
    },

    // visualizza un singolo prodotto tramite id
    visualizzaProdotto: async (req, res) => {
        try {
            const { id } = req.params
            const prodotto = await Prodotto.findByPk(id)

            if (!prodotto) {
                return res.status(404).json({
                    message: 'Prodotto non trovato'
                })
            }

            return res.status(200).json(prodotto)
        } catch (error) {
            console.error('Errore durante il recupero del prodotto:', error)
            return res.status(500).json({
                message: 'Errore interno del server durante il recupero del prodotto'
            })
        }
    },

    // aggiorna un prodotto esistente
    modifica: async (req, res) => {
        try {
            const { id } = req.params
            const { nome, descrizione, prezzo, scorta, tipo_unita } = req.body

            const prodotto = await Prodotto.findByPk(id)
            if (!prodotto) {
                return res.status(404).json({
                    message: 'Prodotto non trovato'
                })
            }

            if (nome !== undefined) prodotto.nome = nome
            if (descrizione !== undefined) prodotto.descrizione = descrizione
            if (prezzo !== undefined) prodotto.prezzo = prezzo
            if (scorta !== undefined) prodotto.scorta = scorta
            if (tipo_unita !== undefined) prodotto.tipo_unita = tipo_unita
            await prodotto.save()

            return res.status(200).json({
                message: 'Prodotto aggiornato con successo',
                prodotto
            })
        } catch (error) {
            console.error('Errore durante l\'aggiornamento del prodotto:', error)
            return res.status(500).json({
                message: 'Errore interno del server durante l\'aggiornamento del prodotto'
            })
        }
    },

    // disattiva un prodotto (soft delete, per preservare l'integrità referenziale degli ordini passati)
    elimina: async (req, res) => {
        try {
            const { id } = req.params
            const prodotto = await Prodotto.findByPk(id)

            if (!prodotto) {
                return res.status(404).json({
                    message: 'Prodotto non trovato'
                })
            }

            prodotto.attivo = false
            await prodotto.save()

            return res.status(200).json({
                message: 'Prodotto disattivato con successo'
            })
        } catch (error) {
            console.error('Errore durante l\'eliminazione del prodotto:', error)
            return res.status(500).json({
                message: 'Errore interno del server durante l\'eliminazione del prodotto'
            })
        }
    }
}

module.exports = prodottoController