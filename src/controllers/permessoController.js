const {Permesso, Utente} = require('../models')

// crea un nuovo permesso
const creaPermesso = async (req, res) => {
    try {
        const {nome} = req.body
        if (!nome) {
            return res.status(400).json({
                message: 'Nome obbligatorio'
            })
        }

        const [ permesso, creato] = await Permesso.findOrCreate({
            where: {name: nome}
        })
        return res.status(creato ? 201 : 200).json({permesso})

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'})
    }
}

// assegna permesso all'utente
const assegnaAUtente = async (req, res) =>  {
    try {
        const {utenteId,  permessoId} = req.body
        const utente = await Utente.findByPk(utenteId)
        const permesso = await Permesso.findByPk(permessoId)

        if(!utente || !permesso)
            return res.status(404).json({
        message: 'Utente o Permesso non trovato'
    })

    await utente.addPermessi_diretti(permesso)
    return res.status(200).json({
        message: `Permesso "${permesso.name}" assegnato direttamente a ${utente.nome}`
    })

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}


// rimuove un permesso assegnato direttamente all'utente
const rimuoviDaUtente = async (req, res) => {
    try {
        const {utenteId, permessoId} = req.body
        const utente = await Utente.findByPk(utenteId)
        const permesso = await Permesso.findByPk(permessoId)

        if(!utente || !permesso)
            return res.status(404).json({
        message: 'Utente o Permesso non trovato'
    })

    await utente.removePermessi_diretti(permesso)
    return res.status(200).json({
        message: `Permesso "${permesso.name}" rimosso da ${utente.nome}`
    })

    } catch (error) {
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// lista di tutti i permessi
const lista = async (req, res) => {
    try {
        const permessi = await Permesso.findAll()
        return res.status(200).json(permessi)
    } catch (error) {
        console.error('Errore durante il recupero dei permessi:', error)
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// ottieni un singolo permesso tramite id
const visualizzaPermesso = async (req, res) => {
    try {
        const { id } = req.params
        const permesso = await Permesso.findByPk(id)

        if (!permesso) {
            return res.status(404).json({
                message: 'Permesso non trovato'
            })
        }

        return res.status(200).json(permesso)
    } catch (error) {
        console.error('Errore durante il recupero del permesso:', error)
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// aggiorna un permesso esistente
const modifica = async (req, res) => {
    try {
        const { id } = req.params
        const { nome, descrizione } = req.body

        const permesso = await Permesso.findByPk(id)
        if (!permesso) {
            return res.status(404).json({
                message: 'Permesso non trovato'
            })
        }

        if (nome !== undefined) permesso.name = nome
        if (descrizione !== undefined) permesso.description = descrizione
        await permesso.save()

        return res.status(200).json({
            message: 'Permesso aggiornato con successo',
            permesso
        })
    } catch (error) {
        console.error('Errore durante l\'aggiornamento del permesso:', error)
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

// elimina un permesso
const elimina = async (req, res) => {
    try {
        const { id } = req.params
        const permesso = await Permesso.findByPk(id)

        if (!permesso) {
            return res.status(404).json({
                message: 'Permesso non trovato'
            })
        }

        await permesso.destroy()
        return res.status(200).json({
            message: 'Permesso eliminato con successo'
        })
    } catch (error) {
        console.error('Errore durante l\'eliminazione del permesso:', error)
        return res.status(500).json({
            message: 'Errore del server'
        })
    }
}

module.exports={ creaPermesso, assegnaAUtente, rimuoviDaUtente, lista, visualizzaPermesso, modifica, elimina}