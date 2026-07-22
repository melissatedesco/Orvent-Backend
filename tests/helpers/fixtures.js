const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Utente, Ruolo, Permesso, Gruppo, Prodotto } = require('../../src/models')

let contatore = 0
const prossimoId = () => {
    contatore += 1
    return `${Date.now()}-${contatore}`
}

const creaPermesso = async (nome) => {
    const [permesso] = await Permesso.findOrCreate({ where: { name: nome } })
    return permesso
}

const creaRuoloConPermessi = async (nomeRuolo, nomiPermessi = []) => {
    const [ruolo] = await Ruolo.findOrCreate({ where: { name: nomeRuolo } })
    if (nomiPermessi.length > 0) {
        const permessi = await Promise.all(nomiPermessi.map(creaPermesso))
        await ruolo.addPermessi(permessi)
    }
    return ruolo
}

const creaGruppoConRuolo = async (nomeGruppo, ruolo) => {
    const [gruppo] = await Gruppo.findOrCreate({ where: { name: nomeGruppo } })
    await gruppo.addRuoli_gruppo(ruolo)
    return gruppo
}

// crea un utente "vuoto", senza ruoli/permessi/gruppi
const creaUtente = async (overrides = {}) => {
    const passwordHash = await bcrypt.hash('Password123!', 10)
    return Utente.create({
        nome: overrides.nome || 'Test',
        cognome: overrides.cognome || 'Utente',
        email: overrides.email || `test-${prossimoId()}@example.com`,
        password_hash: passwordHash,
        attivo: overrides.attivo ?? true
    })
}

// crea un utente e gli assegna un ruolo diretto (creato al volo con i permessi indicati)
const creaUtenteConRuolo = async (nomeRuolo, nomiPermessi = [], overrides = {}) => {
    const ruolo = await creaRuoloConPermessi(nomeRuolo, nomiPermessi)
    const utente = await creaUtente(overrides)
    await utente.addRuoli_diretti(ruolo)
    return { utente, ruolo }
}

// crea un utente che eredita i permessi solo tramite un gruppo (nessun ruolo diretto)
const creaUtenteConGruppo = async (nomeGruppo, nomeRuolo, nomiPermessi = [], overrides = {}) => {
    const ruolo = await creaRuoloConPermessi(nomeRuolo, nomiPermessi)
    const gruppo = await creaGruppoConRuolo(nomeGruppo, ruolo)
    const utente = await creaUtente(overrides)
    await utente.addGruppi(gruppo)
    return { utente, gruppo, ruolo }
}

const generaToken = (utente) => {
    return jwt.sign({ id: utente.id, email: utente.email }, process.env.JWT_SECRET, { expiresIn: '1h' })
}

const creaProdotto = async (overrides = {}) => {
    return Prodotto.create({
        sku: overrides.sku || `SKU-${prossimoId()}`,
        nome: overrides.nome || 'Prodotto di test',
        descrizione: overrides.descrizione,
        prezzo: overrides.prezzo ?? 10.00,
        scorta: overrides.scorta ?? 100,
        tipo_unita: overrides.tipo_unita || 'PEZZO',
        attivo: overrides.attivo ?? true
    })
}

module.exports = {
    creaPermesso,
    creaRuoloConPermessi,
    creaGruppoConRuolo,
    creaUtente,
    creaUtenteConRuolo,
    creaUtenteConGruppo,
    generaToken,
    creaProdotto
}
