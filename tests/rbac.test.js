const request = require('supertest')
const app = require('../src/app')
const { creaUtente, creaUtenteConRuolo, creaUtenteConGruppo, generaToken } = require('./helpers/fixtures')

// Le rotte protette da permesso usano tutte lo stesso middleware hasPermission,
// quindi verifichiamo la catena utente -> (gruppo) -> ruolo -> permesso su un solo
// endpoint reale (creazione prodotto, che richiede 'prodotti:creare').
describe('RBAC: utente -> (gruppo) -> ruolo -> permesso', () => {
    const nuovoProdotto = {
        sku: 'RBAC-TEST-001',
        nome: 'Prodotto RBAC',
        prezzo: 5.00,
        scorta: 10,
        tipo_unita: 'PEZZO'
    }

    test('senza token: 401', async () => {
        const risposta = await request(app).post('/api/prodotti').send(nuovoProdotto)
        expect(risposta.status).toBe(401)
    })

    test('utente autenticato senza alcun permesso: 403', async () => {
        const utente = await creaUtente()
        const token = generaToken(utente)

        const risposta = await request(app)
            .post('/api/prodotti')
            .set('Authorization', `Bearer ${token}`)
            .send(nuovoProdotto)

        expect(risposta.status).toBe(403)
    })

    test('permesso assegnato direttamente all\'utente: 201', async () => {
        const utente = await creaUtente()
        const { creaPermesso } = require('./helpers/fixtures')
        const permesso = await creaPermesso('prodotti:creare')
        await utente.addPermessi_diretti(permesso)
        const token = generaToken(utente)

        const risposta = await request(app)
            .post('/api/prodotti')
            .set('Authorization', `Bearer ${token}`)
            .send(nuovoProdotto)

        expect(risposta.status).toBe(201)
    })

    test('permesso ereditato da un ruolo diretto: 201', async () => {
        const { utente } = await creaUtenteConRuolo('TEST_RUOLO', ['prodotti:creare'])
        const token = generaToken(utente)

        const risposta = await request(app)
            .post('/api/prodotti')
            .set('Authorization', `Bearer ${token}`)
            .send(nuovoProdotto)

        expect(risposta.status).toBe(201)
    })

    test('permesso ereditato da un gruppo (nessun ruolo diretto): 201', async () => {
        const { utente } = await creaUtenteConGruppo('TEST_GRUPPO', 'TEST_RUOLO_GRUPPO', ['prodotti:creare'])
        const token = generaToken(utente)

        const risposta = await request(app)
            .post('/api/prodotti')
            .set('Authorization', `Bearer ${token}`)
            .send(nuovoProdotto)

        expect(risposta.status).toBe(201)
    })

    test('permesso di un ruolo diverso non basta: 403', async () => {
        const { utente } = await creaUtenteConRuolo('TEST_RUOLO_ALTRO', ['prodotti:modificare'])
        const token = generaToken(utente)

        const risposta = await request(app)
            .post('/api/prodotti')
            .set('Authorization', `Bearer ${token}`)
            .send(nuovoProdotto)

        expect(risposta.status).toBe(403)
    })
})
