const {Gruppo, Ruolo, Utente} = require('../models')

// crea un nuovo gruppo
const creaGruppo = async (req, res) => {
    try {
        const {nome, descrizione} = req.body
        if (!nome) {
            return res.status(400).json({
                message: 'Nome obbligatorio'
            })
        }

        const [gruppo, creato] = await Gruppo.findOrCreate({
            where: {name: nome},
            defaults: {description: descrizione}
        })

        return res.status(creato ? 201 : 200).json({gruppo})

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// assegna un ruolo al gruppo (i membri del gruppo ereditano i permessi del ruolo)
const associaRuolo = async (req, res) => {
    try {
        const {gruppoId, ruoloId} = req.body
        const gruppo = await Gruppo.findByPk(gruppoId)
        const ruolo = await Ruolo.findByPk(ruoloId)

        if(!gruppo || !ruolo)
            return res.status(404).json({
                message: 'Non trovato'
            })

        await gruppo.addRuoli_gruppo(ruolo)
        return res.status(200).json({
            message: 'Ruolo associato al gruppo'
        })

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// aggiunge un utente al gruppo
const aggiungiUtente = async (req, res) => {
    try {
        const {utenteId, gruppoId} = req.body
        const utente = await Utente.findByPk(utenteId)
        const gruppo = await Gruppo.findByPk(gruppoId)

        if(!utente || !gruppo)
            return res.status(404).json({
                message: 'Non trovato'
            })

        await utente.addGruppi(gruppo)
        return res.status(200).json({
            message: 'Utente aggiunto al gruppo'
        })

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// rimuove un ruolo dal gruppo
const rimuoviRuolo = async (req, res) => {
    try {
        const {gruppoId, ruoloId} = req.body
        const gruppo = await Gruppo.findByPk(gruppoId)
        const ruolo = await Ruolo.findByPk(ruoloId)

        if(!gruppo || !ruolo)
            return res.status(404).json({
                message: 'Non trovato'
            })

        await gruppo.removeRuoli_gruppo(ruolo)
        return res.status(200).json({
            message: 'Ruolo rimosso dal gruppo'
        })

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// rimuove un utente dal gruppo
const rimuoviUtente = async (req, res) => {
    try {
        const {utenteId, gruppoId} = req.body
        const utente = await Utente.findByPk(utenteId)
        const gruppo = await Gruppo.findByPk(gruppoId)

        if(!utente || !gruppo)
            return res.status(404).json({
                message: 'Non trovato'
            })

        await utente.removeGruppi(gruppo)
        return res.status(200).json({
            message: 'Utente rimosso dal gruppo'
        })

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// lista di tutti i gruppi
const lista = async (req, res) => {
    try {
        const gruppi = await Gruppo.findAll()
        return res.status(200).json(gruppi)
    } catch (error) {
        console.error('Errore durante il recupero dei gruppi:', error)
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// ottieni un singolo gruppo (con i ruoli associati) tramite id
const visualizzaGruppo = async (req, res) => {
    try {
        const { id } = req.params
        const gruppo = await Gruppo.findByPk(id, {
            include: [{ model: Ruolo, as: 'ruoli_gruppo' }]
        })

        if (!gruppo) {
            return res.status(404).json({
                message: 'Gruppo non trovato'
            })
        }

        return res.status(200).json(gruppo)
    } catch (error) {
        console.error('Errore durante il recupero del gruppo:', error)
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// aggiorna un gruppo esistente
const modifica = async (req, res) => {
    try {
        const { id } = req.params
        const { nome, descrizione } = req.body

        const gruppo = await Gruppo.findByPk(id)
        if (!gruppo) {
            return res.status(404).json({
                message: 'Gruppo non trovato'
            })
        }

        if (nome !== undefined) gruppo.name = nome
        if (descrizione !== undefined) gruppo.description = descrizione
        await gruppo.save()

        return res.status(200).json({
            message: 'Gruppo aggiornato con successo',
            gruppo
        })
    } catch (error) {
        console.error('Errore durante l\'aggiornamento del gruppo:', error)
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// elimina un gruppo
const elimina = async (req, res) => {
    try {
        const { id } = req.params
        const gruppo = await Gruppo.findByPk(id)

        if (!gruppo) {
            return res.status(404).json({
                message: 'Gruppo non trovato'
            })
        }

        await gruppo.destroy()
        return res.status(200).json({
            message: 'Gruppo eliminato con successo'
        })
    } catch (error) {
        console.error('Errore durante l\'eliminazione del gruppo:', error)
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

module.exports = {creaGruppo, associaRuolo, rimuoviRuolo, aggiungiUtente, rimuoviUtente, lista, visualizzaGruppo, modifica, elimina}
