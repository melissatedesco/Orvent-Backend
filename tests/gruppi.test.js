const request = require('supertest')
const app = require('../src/app')
const { Gruppo, Ruolo, Utente } = require('../src/models')
const { creaUtente, creaRuoloConPermessi, generaToken } = require('./helpers/fixtures')

describe('Gruppi: creazione', () => {
    test('crea un nuovo gruppo', async () => {
        const risposta = await request(app)
            .post('/api/sicurezza/gruppi')
            .send({ nome: 'MAGAZZINO_NORD', descrizione: 'Team del magazzino nord' })

        expect(risposta.status).toBe(201)
        expect(risposta.body.gruppo.name).toBe('MAGAZZINO_NORD')
    })

    test('richiamare la creazione con lo stesso nome non duplica il gruppo (findOrCreate)', async () => {
        await request(app).post('/api/sicurezza/gruppi').send({ nome: 'MAGAZZINO_SUD' })
        const seconda = await request(app).post('/api/sicurezza/gruppi').send({ nome: 'MAGAZZINO_SUD' })

        expect(seconda.status).toBe(200)
        expect(await Gruppo.count({ where: { name: 'MAGAZZINO_SUD' } })).toBe(1)
    })

    test('rifiuta la creazione senza nome', async () => {
        const risposta = await request(app).post('/api/sicurezza/gruppi').send({})
        expect(risposta.status).toBe(400)
    })
})

describe('Gruppi: lettura', () => {
    test('la lista richiede autenticazione', async () => {
        const senzaToken = await request(app).get('/api/sicurezza/gruppi')
        expect(senzaToken.status).toBe(401)

        const utente = await creaUtente()
        const token = generaToken(utente)
        const conToken = await request(app).get('/api/sicurezza/gruppi').set('Authorization', `Bearer ${token}`)
        expect(conToken.status).toBe(200)
        expect(Array.isArray(conToken.body)).toBe(true)
    })

    test('il dettaglio include i ruoli associati e restituisce 404 se il gruppo non esiste', async () => {
        const utente = await creaUtente()
        const token = generaToken(utente)

        const nonEsistente = await request(app)
            .get('/api/sicurezza/gruppi/999999')
            .set('Authorization', `Bearer ${token}`)
        expect(nonEsistente.status).toBe(404)

        const gruppo = await Gruppo.create({ name: 'CONTABILITA_TEAM' })
        const ruolo = await creaRuoloConPermessi('CONTABILITA', ['fatture:gestione'])
        await gruppo.addRuoli_gruppo(ruolo)

        const dettaglio = await request(app)
            .get(`/api/sicurezza/gruppi/${gruppo.id}`)
            .set('Authorization', `Bearer ${token}`)

        expect(dettaglio.status).toBe(200)
        expect(dettaglio.body.ruoli_gruppo.map(r => r.name)).toContain('CONTABILITA')
    })
})

describe('Gruppi: modifica ed eliminazione', () => {
    test('la modifica aggiorna nome e descrizione', async () => {
        const gruppo = await Gruppo.create({ name: 'VECCHIO_NOME' })
        const utente = await creaUtente()
        const token = generaToken(utente)

        const risposta = await request(app)
            .put(`/api/sicurezza/gruppi/${gruppo.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'NUOVO_NOME', descrizione: 'aggiornato' })

        expect(risposta.status).toBe(200)
        expect(risposta.body.gruppo.name).toBe('NUOVO_NOME')
    })

    test('l\'eliminazione di un gruppo e\' definitiva (hard delete), a differenza di utenti/prodotti', async () => {
        const gruppo = await Gruppo.create({ name: 'GRUPPO_DA_ELIMINARE' })
        const utente = await creaUtente()
        const token = generaToken(utente)

        const risposta = await request(app)
            .delete(`/api/sicurezza/gruppi/${gruppo.id}`)
            .set('Authorization', `Bearer ${token}`)

        expect(risposta.status).toBe(200)
        expect(await Gruppo.findByPk(gruppo.id)).toBeNull()
    })
})

describe('Gruppi: associazioni', () => {
    test('associa un ruolo esistente al gruppo e restituisce 404 se ruolo o gruppo non esistono', async () => {
        const gruppo = await Gruppo.create({ name: 'TEAM_TEST' })
        const ruolo = await creaRuoloConPermessi('RUOLO_TEST', [])

        const risposta = await request(app)
            .post('/api/sicurezza/gruppi/associa-ruolo')
            .send({ gruppoId: gruppo.id, ruoloId: ruolo.id })
        expect(risposta.status).toBe(200)

        const gruppoAggiornato = await Gruppo.findByPk(gruppo.id, { include: [{ model: Ruolo, as: 'ruoli_gruppo' }] })
        expect(gruppoAggiornato.ruoli_gruppo.map(r => r.id)).toContain(ruolo.id)

        const rispostaNonTrovato = await request(app)
            .post('/api/sicurezza/gruppi/associa-ruolo')
            .send({ gruppoId: 999999, ruoloId: ruolo.id })
        expect(rispostaNonTrovato.status).toBe(404)
    })

    test('aggiunge un utente al gruppo e restituisce 404 se utente o gruppo non esistono', async () => {
        const gruppo = await Gruppo.create({ name: 'TEAM_UTENTI' })
        const utente = await creaUtente()

        const risposta = await request(app)
            .post('/api/sicurezza/utenti/assegna-gruppo')
            .send({ utenteId: utente.id, gruppoId: gruppo.id })
        expect(risposta.status).toBe(200)

        const utenteAggiornato = await Utente.findByPk(utente.id, { include: [{ model: Gruppo, as: 'gruppi' }] })
        expect(utenteAggiornato.gruppi.map(g => g.id)).toContain(gruppo.id)

        const rispostaNonTrovato = await request(app)
            .post('/api/sicurezza/utenti/assegna-gruppo')
            .send({ utenteId: 999999, gruppoId: gruppo.id })
        expect(rispostaNonTrovato.status).toBe(404)
    })
})

describe('Gruppi: flusso end-to-end tramite le API', () => {
    test('un utente aggiunto a un gruppo eredita i permessi del ruolo del gruppo', async () => {
        const creazioneGruppo = await request(app)
            .post('/api/sicurezza/gruppi')
            .send({ nome: 'MAGAZZINO_EST' })
        const idGruppo = creazioneGruppo.body.gruppo.id

        const ruolo = await creaRuoloConPermessi('OPERATORE_EST', ['ordini:evadere'])

        await request(app)
            .post('/api/sicurezza/gruppi/associa-ruolo')
            .send({ gruppoId: idGruppo, ruoloId: ruolo.id })

        const utente = await creaUtente()
        await request(app)
            .post('/api/sicurezza/utenti/assegna-gruppo')
            .send({ utenteId: utente.id, gruppoId: idGruppo })

        const token = generaToken(utente)

        // /api/ordini/tutti richiede il permesso 'ordini:evadere', ereditato solo tramite il gruppo
        const risposta = await request(app)
            .get('/api/ordini/tutti')
            .set('Authorization', `Bearer ${token}`)

        expect(risposta.status).toBe(200)
    })
})
