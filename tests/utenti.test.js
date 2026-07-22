const request = require('supertest')
const app = require('../src/app')
const { Utente, Ruolo, Gruppo } = require('../src/models')
const { creaUtenteConRuolo, creaUtente, creaRuoloConPermessi, generaToken } = require('./helpers/fixtures')

const creaAdminUtenti = () => creaUtenteConRuolo('TEST_ADMIN_UTENTI', ['utenti:gestione'])

describe('Utenti: registrazione pubblica', () => {
    test('crea l\'utente, cifra la password e assegna il ruolo CLIENTE di default', async () => {
        await creaRuoloConPermessi('CLIENTE', ['ordini:creare'])

        const risposta = await request(app)
            .post('/api/utenti/registrati')
            .send({ nome: 'Mario', cognome: 'Rossi', email: 'mario@example.com', password: 'Password123!' })

        expect(risposta.status).toBe(201)
        expect(risposta.body.utente.email).toBe('mario@example.com')
        expect(risposta.body.utente.password_hash).toBeUndefined()

        const utenteDb = await Utente.findOne({
            where: { email: 'mario@example.com' },
            include: [{ model: Ruolo, as: 'ruoli_diretti' }]
        })
        expect(utenteDb.password_hash).not.toBe('Password123!')
        expect(utenteDb.ruoli_diretti.map(r => r.name)).toContain('CLIENTE')
    })

    test('rifiuta la registrazione se mancano campi obbligatori', async () => {
        const risposta = await request(app)
            .post('/api/utenti/registrati')
            .send({ nome: 'Mario', email: 'mario@example.com', password: 'Password123!' })

        expect(risposta.status).toBe(400)
    })

    test('rifiuta un\'email gia\' registrata', async () => {
        const dati = { nome: 'Mario', cognome: 'Rossi', email: 'duplicato@example.com', password: 'Password123!' }
        await request(app).post('/api/utenti/registrati').send(dati)
        const seconda = await request(app).post('/api/utenti/registrati').send(dati)

        expect(seconda.status).toBe(400)
        expect(await Utente.count({ where: { email: 'duplicato@example.com' } })).toBe(1)
    })

    test('le credenziali appena registrate funzionano per il login', async () => {
        await request(app)
            .post('/api/utenti/registrati')
            .send({ nome: 'Mario', cognome: 'Rossi', email: 'login-test@example.com', password: 'Password123!' })

        const risposta = await request(app)
            .post('/api/auth/login')
            .send({ email: 'login-test@example.com', password: 'Password123!' })

        expect(risposta.status).toBe(200)
        expect(risposta.body.token).toBeDefined()
    })
})

describe('Utenti: profilo personale', () => {
    test('GET /profilo richiede autenticazione e restituisce i propri dati', async () => {
        const utente = await creaUtente({ nome: 'Luigi', email: 'luigi@example.com' })
        const token = generaToken(utente)

        const senzaToken = await request(app).get('/api/utenti/profilo')
        expect(senzaToken.status).toBe(401)

        const conToken = await request(app).get('/api/utenti/profilo').set('Authorization', `Bearer ${token}`)
        expect(conToken.status).toBe(200)
        expect(conToken.body.email).toBe('luigi@example.com')
    })

    test('PUT /profilo aggiorna nome e cognome del chiamante', async () => {
        const utente = await creaUtente({ nome: 'Vecchio', cognome: 'Nome' })
        const token = generaToken(utente)

        const risposta = await request(app)
            .put('/api/utenti/profilo')
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Nuovo' })

        expect(risposta.status).toBe(200)
        expect(risposta.body.utente.nome).toBe('Nuovo')

        const utenteDb = await Utente.findByPk(utente.id)
        expect(utenteDb.nome).toBe('Nuovo')
    })
})

describe('Utenti: creazione amministrativa con ruolo e gruppi', () => {
    test('richiede il permesso utenti:gestione', async () => {
        const utenteSenzaPermessi = await creaUtente()
        const token = generaToken(utenteSenzaPermessi)

        const risposta = await request(app)
            .post('/api/utenti')
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Op', cognome: 'Test', email: 'op@example.com', password: 'Password123!', ruolo: 'CLIENTE' })

        expect(risposta.status).toBe(403)
    })

    test('crea l\'utente con il ruolo indicato', async () => {
        await creaRuoloConPermessi('OPERATORE_MAGAZZINO', ['ordini:evadere'])
        const { utente: admin } = await creaAdminUtenti()
        const token = generaToken(admin)

        const risposta = await request(app)
            .post('/api/utenti')
            .set('Authorization', `Bearer ${token}`)
            .send({
                nome: 'Luca', cognome: 'Verdi', email: 'operatore@example.com',
                password: 'Password123!', ruolo: 'OPERATORE_MAGAZZINO'
            })

        expect(risposta.status).toBe(201)
        expect(risposta.body.utente.ruolo).toBe('OPERATORE_MAGAZZINO')
    })

    test('rifiuta un ruolo inesistente', async () => {
        const { utente: admin } = await creaAdminUtenti()
        const token = generaToken(admin)

        const risposta = await request(app)
            .post('/api/utenti')
            .set('Authorization', `Bearer ${token}`)
            .send({
                nome: 'Luca', cognome: 'Verdi', email: 'ruoloinesistente@example.com',
                password: 'Password123!', ruolo: 'RUOLO_CHE_NON_ESISTE'
            })

        expect(risposta.status).toBe(400)
        expect(await Utente.count({ where: { email: 'ruoloinesistente@example.com' } })).toBe(0)
    })

    test('assegna i gruppi indicati e rifiuta un gruppo inesistente', async () => {
        await creaRuoloConPermessi('CLIENTE', [])
        await Gruppo.create({ name: 'MAGAZZINO_NORD' })
        const { utente: admin } = await creaAdminUtenti()
        const token = generaToken(admin)

        const conGruppoValido = await request(app)
            .post('/api/utenti')
            .set('Authorization', `Bearer ${token}`)
            .send({
                nome: 'Anna', cognome: 'Bianchi', email: 'anna@example.com',
                password: 'Password123!', gruppi: ['MAGAZZINO_NORD']
            })
        expect(conGruppoValido.status).toBe(201)
        expect(conGruppoValido.body.utente.gruppi).toContain('MAGAZZINO_NORD')

        const conGruppoInvalido = await request(app)
            .post('/api/utenti')
            .set('Authorization', `Bearer ${token}`)
            .send({
                nome: 'Bruno', cognome: 'Neri', email: 'bruno@example.com',
                password: 'Password123!', gruppi: ['GRUPPO_INESISTENTE']
            })
        expect(conGruppoInvalido.status).toBe(400)
    })
})

describe('Utenti: gestione amministrativa', () => {
    test('la lista richiede il permesso utenti:gestione', async () => {
        const utenteSenzaPermessi = await creaUtente()
        const token = generaToken(utenteSenzaPermessi)

        const risposta = await request(app).get('/api/utenti').set('Authorization', `Bearer ${token}`)
        expect(risposta.status).toBe(403)
    })

    test('l\'eliminazione e\' un soft delete: attivo diventa false, il record resta', async () => {
        const utenteDaEliminare = await creaUtente({ email: 'daeliminare@example.com' })
        const { utente: admin } = await creaAdminUtenti()
        const token = generaToken(admin)

        const risposta = await request(app)
            .delete(`/api/utenti/${utenteDaEliminare.id}`)
            .set('Authorization', `Bearer ${token}`)

        expect(risposta.status).toBe(200)

        const utenteDopo = await Utente.findByPk(utenteDaEliminare.id)
        expect(utenteDopo).not.toBeNull()
        expect(utenteDopo.attivo).toBe(false)
    })
})
