const { Ordine, RigaOrdine, Utente } = require('../models')
const ordineService = require('../services/ordineService')
const { ottieniPermessiUtente } = require('../middleware/hasPermission')

// l'operatore di magazzino non ha accesso ai prezzi: rimuoviamo i campi economici dalla risposta
// quando chi guarda non ha il permesso 'ordini:gestione' ne' e' il proprietario dell'ordine
const formattaOrdine = (ordine, mostraPrezzi) => {
    const json = ordine.toJSON()
    if (!mostraPrezzi) {
        delete json.totale_importo
        if (json.righe) {
            json.righe = json.righe.map(({ prezzo_congelato, ...resto }) => resto)
        }
    }
    return json
}

// cliente: invia un nuovo ordine a partire dal carrello
const crea = async (req, res) => {
    try {
        const idUtente = req.utente.id
        const { righe } = req.body

        const ordine = await ordineService.creaOrdine(idUtente, righe)
        return res.status(201).json({
            message: 'Ordine inviato con successo',
            ordine
        })
    } catch (error) {
        console.error('Errore durante la creazione dell\'ordine:', error)
        return res.status(error.status || 500).json({
            message: error.status ? error.message : 'Errore interno del server durante la creazione dell\'ordine'
        })
    }
}

// cliente: storico dei propri ordini
const storicoProprio = async (req, res) => {
    try {
        const idUtente = req.utente.id
        const ordini = await Ordine.findAll({
            where: { user_id: idUtente },
            include: [{ model: RigaOrdine, as: 'righe' }],
            order: [['createdAt', 'DESC']]
        })
        return res.status(200).json(ordini)
    } catch (error) {
        console.error('Errore durante il recupero dello storico ordini:', error)
        return res.status(500).json({ message: 'Errore interno del server' })
    }
}

// operatore/admin: lista di tutti gli ordini, filtrabile per stato (?stato=NUOVO)
const lista = async (req, res) => {
    try {
        const { stato } = req.query
        const where = stato ? { stato } : {}

        const permessi = await ottieniPermessiUtente(req.utente.id)
        const mostraPrezzi = Boolean(permessi?.has('ordini:gestione'))

        const ordini = await Ordine.findAll({
            where,
            include: [
                { model: RigaOrdine, as: 'righe' },
                { model: Utente, as: 'user', attributes: ['id', 'nome', 'cognome'] }
            ],
            order: [['createdAt', 'ASC']]
        })

        return res.status(200).json(ordini.map(o => formattaOrdine(o, mostraPrezzi)))
    } catch (error) {
        console.error('Errore durante il recupero degli ordini:', error)
        return res.status(500).json({ message: 'Errore interno del server' })
    }
}

// dettaglio di un ordine: accessibile al proprietario o allo staff con permesso di evasione/gestione
const visualizzaOrdine = async (req, res) => {
    try {
        const { id } = req.params
        const idUtente = req.utente.id

        const ordine = await Ordine.findByPk(id, {
            include: [{ model: RigaOrdine, as: 'righe' }]
        })

        if (!ordine) {
            return res.status(404).json({ message: 'Ordine non trovato' })
        }

        const isProprietario = ordine.user_id === idUtente
        const permessi = await ottieniPermessiUtente(idUtente)
        const isStaff = Boolean(permessi?.has('ordini:evadere') || permessi?.has('ordini:gestione'))

        if (!isProprietario && !isStaff) {
            return res.status(403).json({ message: 'Accesso negato' })
        }

        const mostraPrezzi = isProprietario || Boolean(permessi?.has('ordini:gestione'))
        return res.status(200).json(formattaOrdine(ordine, mostraPrezzi))
    } catch (error) {
        console.error('Errore durante il recupero dell\'ordine:', error)
        return res.status(500).json({ message: 'Errore interno del server' })
    }
}

// cliente: annulla un proprio ordine (consentito solo da NUOVO)
const annulla = async (req, res) => {
    try {
        const { id } = req.params
        const idUtente = req.utente.id
        const ordine = await ordineService.annullaOrdine(id, idUtente)
        return res.status(200).json({ message: 'Ordine annullato con successo', ordine })
    } catch (error) {
        console.error('Errore durante l\'annullamento dell\'ordine:', error)
        return res.status(error.status || 500).json({
            message: error.status ? error.message : 'Errore interno del server'
        })
    }
}

// operatore: prende in carico l'ordine (NUOVO -> IN_EVASIONE)
const prendiInCarico = async (req, res) => {
    try {
        const { id } = req.params
        const ordine = await ordineService.prendiInCarico(id)
        return res.status(200).json({ message: 'Ordine preso in carico', ordine })
    } catch (error) {
        console.error('Errore durante la presa in carico dell\'ordine:', error)
        return res.status(error.status || 500).json({
            message: error.status ? error.message : 'Errore interno del server'
        })
    }
}

// operatore: conferma la preparazione, evade l'ordine e scala automaticamente lo stock
const evadi = async (req, res) => {
    try {
        const { id } = req.params
        const ordine = await ordineService.evadiOrdine(id)
        return res.status(200).json({ message: 'Ordine evaso con successo', ordine })
    } catch (error) {
        console.error('Errore durante l\'evasione dell\'ordine:', error)
        return res.status(error.status || 500).json({
            message: error.status ? error.message : 'Errore interno del server'
        })
    }
}

module.exports = { crea, storicoProprio, lista, visualizzaOrdine, annulla, prendiInCarico, evadi }
