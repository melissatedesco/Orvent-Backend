const {Utente, Ruolo} = require ('../models')
const bcrypt = require('bcrypt')

// registrazione nuovo utente
const registra = async (req, res) => {
    try {
        const { nome, cognome, email, password} = req.body

        // controllo campi obbligatori
        if(!nome || !cognome || !email || !password) {
            return res.status(400).json({
                message: 'Tutti i campi sono obbligatori'
            })
        }

        // controllo email già registrata
        const utenteEsistente = await Utente.findOne({
            where: {email}
        })

        if (utenteEsistente) {
            return res.status(400).json({
                message: 'Questa email è già associata a un account'
            })
        }

        // cifratura della password
        const salt = await bcrypt.genSalt(10)
        const passwordCifrata = await bcrypt.hash(password, salt)

        // creazione dell'utente
        const nuovoUtente = await Utente.create({
            nome,
            cognome,
            email,
            password_hash: passwordCifrata
        })

        // risposta nel json
        return res.status(201).json({
            message:'Utente registrato con successo',
            utente: {
                id: nuovoUtente.id,
                nome: nuovoUtente.nome,
                cognome: nuovoUtente.cognome,
                email: nuovoUtente.email
            }
        })
    } catch (error) {
        console.error('Errore durante la registrazione:', error)
        return res.status(500).json({
            message: 'Errore interno del server durante la registrazione'
        })
    }
}

// utente loggato protetto jwt
const ottieniProfilo = async (req, res) => {
    try {
        // req.utente.id viene iniettato dal middleware "verificaToken"
        const idUtente = req.utente.id

        const utente = await Utente.findByPk(idUtente, {
            attributes: ['id', 'nome', 'cognome', 'email', 'createdAt'],
            include: [
                {
                    model:Ruolo,
                    as: 'ruoli_diretti',
                    attributes: ['name']
                }
            ]
        })

        if(!utente) {
            return res.status(404).json({
                message: "Utente non trovato"
            })
        }

        return res.status(200).json(utente)

    } catch (error) {
        console.error('Errore nel recupero del profilo:', error)
        return res.status(500).json({
            message: 'Errore interno del server durante il recupero del profilo'
        })
    }
}

module.exports= {registra, ottieniProfilo}