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




module.exports={ creaPermesso, assegnaAUtente}