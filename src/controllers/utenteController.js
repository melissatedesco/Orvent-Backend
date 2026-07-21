const {Utente, Ruolo, Gruppo} = require ('../models')
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

        // assegna il ruolo CLIENTE di default a chi si registra autonomamente
        const ruoloCliente = await Ruolo.findOne({ where: { name: 'CLIENTE' } })
        if (ruoloCliente) {
            await nuovoUtente.addRuoli_diretti(ruoloCliente)
        }

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

// crea un utente scegliendo ruolo e gruppi direttamente (uso amministrativo, richiede 'utenti:gestione')
const creaUtente = async (req, res) => {
    try {
        const { nome, cognome, email, password, ruolo, gruppi } = req.body

        if (!nome || !cognome || !email || !password) {
            return res.status(400).json({
                message: 'Tutti i campi sono obbligatori'
            })
        }

        const utenteEsistente = await Utente.findOne({ where: { email } })
        if (utenteEsistente) {
            return res.status(400).json({
                message: 'Questa email è già associata a un account'
            })
        }

        const nomeRuolo = ruolo || 'CLIENTE'
        const ruoloTrovato = await Ruolo.findOne({ where: { name: nomeRuolo } })
        if (!ruoloTrovato) {
            return res.status(400).json({
                message: `Il ruolo "${nomeRuolo}" non esiste`
            })
        }

        // i gruppi sono opzionali: se indicati devono esistere tutti, altrimenti errore
        const nomiGruppi = gruppi || []
        const gruppiTrovati = []
        for (const nomeGruppo of nomiGruppi) {
            const gruppoTrovato = await Gruppo.findOne({ where: { name: nomeGruppo } })
            if (!gruppoTrovato) {
                return res.status(400).json({
                    message: `Il gruppo "${nomeGruppo}" non esiste`
                })
            }
            gruppiTrovati.push(gruppoTrovato)
        }

        const salt = await bcrypt.genSalt(10)
        const passwordCifrata = await bcrypt.hash(password, salt)

        const nuovoUtente = await Utente.create({
            nome,
            cognome,
            email,
            password_hash: passwordCifrata
        })

        await nuovoUtente.addRuoli_diretti(ruoloTrovato)
        if (gruppiTrovati.length > 0) {
            await nuovoUtente.addGruppi(gruppiTrovati)
        }

        return res.status(201).json({
            message: 'Utente creato con successo',
            utente: {
                id: nuovoUtente.id,
                nome: nuovoUtente.nome,
                cognome: nuovoUtente.cognome,
                email: nuovoUtente.email,
                ruolo: ruoloTrovato.name,
                gruppi: gruppiTrovati.map(g => g.name)
            }
        })
    } catch (error) {
        console.error('Errore durante la creazione dell\'utente:', error)
        return res.status(500).json({
            message: 'Errore interno del server durante la creazione dell\'utente'
        })
    }
}

// lista di tutti gli utenti (uso amministrativo)
const lista = async (req, res) => {
    try {
        const utenti = await Utente.findAll({
            attributes: ['id', 'nome', 'cognome', 'email', 'attivo', 'createdAt']
        })
        return res.status(200).json(utenti)
    } catch (error) {
        console.error('Errore durante il recupero degli utenti:', error)
        return res.status(500).json({
            message: 'Errore interno del server durante il recupero degli utenti'
        })
    }
}

// ottieni un singolo utente tramite id (uso amministrativo)
const visualizzaUtente = async (req, res) => {
    try {
        const { id } = req.params
        const utente = await Utente.findByPk(id, {
            attributes: ['id', 'nome', 'cognome', 'email', 'attivo', 'createdAt']
        })

        if (!utente) {
            return res.status(404).json({
                message: 'Utente non trovato'
            })
        }

        return res.status(200).json(utente)
    } catch (error) {
        console.error('Errore durante il recupero dell\'utente:', error)
        return res.status(500).json({
            message: 'Errore interno del server durante il recupero dell\'utente'
        })
    }
}

// aggiorna il profilo dell'utente autenticato
const aggiornaProfilo = async (req, res) => {
    try {
        const idUtente = req.utente.id
        const { nome, cognome, password } = req.body

        const utente = await Utente.findByPk(idUtente)
        if (!utente) {
            return res.status(404).json({
                message: 'Utente non trovato'
            })
        }

        if (nome !== undefined) utente.nome = nome
        if (cognome !== undefined) utente.cognome = cognome
        if (password) {
            const salt = await bcrypt.genSalt(10)
            utente.password_hash = await bcrypt.hash(password, salt)
        }

        await utente.save()

        return res.status(200).json({
            message: 'Profilo aggiornato con successo',
            utente: {
                id: utente.id,
                nome: utente.nome,
                cognome: utente.cognome,
                email: utente.email
            }
        })
    } catch (error) {
        console.error('Errore durante l\'aggiornamento del profilo:', error)
        return res.status(500).json({
            message: 'Errore interno del server durante l\'aggiornamento del profilo'
        })
    }
}

// aggiorna un utente tramite id (uso amministrativo)
const modifica = async (req, res) => {
    try {
        const { id } = req.params
        const { nome, cognome, email, password, attivo } = req.body

        const utente = await Utente.findByPk(id)
        if (!utente) {
            return res.status(404).json({
                message: 'Utente non trovato'
            })
        }

        if (nome !== undefined) utente.nome = nome
        if (cognome !== undefined) utente.cognome = cognome
        if (email !== undefined) utente.email = email
        if (attivo !== undefined) utente.attivo = attivo
        if (password) {
            const salt = await bcrypt.genSalt(10)
            utente.password_hash = await bcrypt.hash(password, salt)
        }

        await utente.save()

        return res.status(200).json({
            message: 'Utente aggiornato con successo',
            utente: {
                id: utente.id,
                nome: utente.nome,
                cognome: utente.cognome,
                email: utente.email,
                attivo: utente.attivo
            }
        })
    } catch (error) {
        console.error('Errore durante l\'aggiornamento dell\'utente:', error)
        return res.status(500).json({
            message: 'Errore interno del server durante l\'aggiornamento dell\'utente'
        })
    }
}

// disattiva un utente (soft delete, per preservare lo storico fiscale e degli ordini)
const elimina = async (req, res) => {
    try {
        const { id } = req.params
        const utente = await Utente.findByPk(id)

        if (!utente) {
            return res.status(404).json({
                message: 'Utente non trovato'
            })
        }

        utente.attivo = false
        await utente.save()

        return res.status(200).json({
            message: 'Utente disattivato con successo'
        })
    } catch (error) {
        console.error('Errore durante l\'eliminazione dell\'utente:', error)
        return res.status(500).json({
            message: 'Errore interno del server durante l\'eliminazione dell\'utente'
        })
    }
}

module.exports= {registra, creaUtente, ottieniProfilo, lista, visualizzaUtente, aggiornaProfilo, modifica, elimina}