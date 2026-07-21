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

module.exports= {creaRuolo, assegnaAUtente, associaPermesso}