const {Ruolo, Permesso, Utente} = require('../models')

// crea ruolo
const creaRuolo = async (req, res) => {
    try{
        const {nome} = req.body
        if(!nome)
            return res.status(400).json({
        message: 'Nome obbligatorio'
        })

        const [ruolo, creato] = await Ruolo.findOrCreate({
            where: {name: nome}
        })

        return res.status(creato ? 201 : 200).json({ ruolo})

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// assegna permesso a ruolo
const associaPermesso = async (req, res) =>  {
    try {
        const {ruoloId,  permessoId} = req.body
        const ruolo = await Ruolo.findByPk(ruoloId)
        const permesso = await Permesso.findByPk(permessoId)

        if(!ruolo || !permesso)
            return res.status(404).json({
        message: 'Non trovato'
    })

    await ruolo.addPermessi(permesso)
    return res.status(200).json({
        message: 'Permesso associato al ruolo'
    })

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// assegna ruolo all'utente
const assegnaAUtente = async (req, res) => {
    try {
        const {utenteId, ruoloId} = req.body
        const utente = await Utente.findByPk(utenteId)
        const ruolo = await Ruolo.findByPk(ruoloId)

        if(!utente || !ruolo)
            return res.status(404).json({
            message: 'Non trovato'
        })

        await utente.addRuoli_diretti(ruolo)
        return res.status(200).json({
            message: 'Ruolo assegnato all\'utente'
        })
    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// rimuove un permesso da un ruolo
const rimuoviPermesso = async (req, res) => {
    try {
        const {ruoloId, permessoId} = req.body
        const ruolo = await Ruolo.findByPk(ruoloId)
        const permesso = await Permesso.findByPk(permessoId)

        if(!ruolo || !permesso)
            return res.status(404).json({
        message: 'Non trovato'
    })

    await ruolo.removePermessi(permesso)
    return res.status(200).json({
        message: 'Permesso rimosso dal ruolo'
    })

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// rimuove un ruolo diretto dall'utente
const rimuoviDaUtente = async (req, res) => {
    try {
        const {utenteId, ruoloId} = req.body
        const utente = await Utente.findByPk(utenteId)
        const ruolo = await Ruolo.findByPk(ruoloId)

        if(!utente || !ruolo)
            return res.status(404).json({
            message: 'Non trovato'
        })

        await utente.removeRuoli_diretti(ruolo)
        return res.status(200).json({
            message: 'Ruolo rimosso dall\'utente'
        })
    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// lista di tutti i ruoli
const lista = async (req, res) => {
    try {
        const ruoli = await Ruolo.findAll()
        return res.status(200).json(ruoli)
    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// ottieni un singolo ruolo (con i permessi associati) tramite id
const visualizzaRuolo = async (req, res) => {
    try {
        const { id } = req.params
        const ruolo = await Ruolo.findByPk(id, {
            include: [{ model: Permesso, as: 'permessi' }]
        })

        if (!ruolo) {
            return res.status(404).json({
                message: 'Ruolo non trovato'
            })
        }

        return res.status(200).json(ruolo)
    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// aggiorna un ruolo esistente
const modifica = async (req, res) => {
    try {
        const { id } = req.params
        const { nome, descrizione } = req.body

        const ruolo = await Ruolo.findByPk(id)
        if (!ruolo) {
            return res.status(404).json({
                message: 'Ruolo non trovato'
            })
        }

        if (nome !== undefined) ruolo.name = nome
        if (descrizione !== undefined) ruolo.description = descrizione
        await ruolo.save()

        return res.status(200).json({
            message: 'Ruolo aggiornato con successo',
            ruolo
        })
    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// elimina un ruolo
const elimina = async (req, res) => {
    try {
        const { id } = req.params
        const ruolo = await Ruolo.findByPk(id)

        if (!ruolo) {
            return res.status(404).json({
                message: 'Ruolo non trovato'
            })
        }

        await ruolo.destroy()
        return res.status(200).json({
            message: 'Ruolo eliminato con successo'
        })
    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

module.exports= {creaRuolo, assegnaAUtente, associaPermesso, rimuoviPermesso, rimuoviDaUtente, lista, visualizzaRuolo, modifica, elimina}