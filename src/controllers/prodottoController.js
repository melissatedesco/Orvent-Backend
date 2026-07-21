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
    }
}

module.exports = prodottoController