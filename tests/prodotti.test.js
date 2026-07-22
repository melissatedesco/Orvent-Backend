const request = require('supertest')
const app = require('../src/app')
const { Prodotto } = require('../src/models')
const { creaUtenteConRuolo, creaUtente, generaToken, creaProdotto } = require('./helpers/fixtures')

const creaAdminCatalogo = () => creaUtenteConRuolo('TEST_ADMIN_CATALOGO', ['prodotti:creare', 'prodotti:modificare', 'prodotti:eliminare'])

describe('Prodotti: creazione', () => {
    test('rifiuta la creazione se mancano i campi obbligatori', async () => {
        const { utente } = await creaAdminCatalogo()
        const token = generaToken(utente)

        const risposta = await request(app)
            .post('/api/prodotti')
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Prodotto senza sku', prezzo: 5, tipo_unita: 'PEZZO' })

        expect(risposta.status).toBe(400)
    })

    test('rifiuta uno sku duplicato', async () => {
        const { utente } = await creaAdminCatalogo()
        const token = generaToken(utente)
        const datiProdotto = { sku: 'SKU-DUPLICATO', nome: 'Prodotto', prezzo: 5, tipo_unita: 'PEZZO' }

        const prima = await request(app).post('/api/prodotti').set('Authorization', `Bearer ${token}`).send(datiProdotto)
        expect(prima.status).toBe(201)

        const seconda = await request(app).post('/api/prodotti').set('Authorization', `Bearer ${token}`).send(datiProdotto)
        expect(seconda.status).toBe(400)

        expect(await Prodotto.count({ where: { sku: 'SKU-DUPLICATO' } })).toBe(1)
    })

    test('se la scorta non e\' indicata viene impostata a 0', async () => {
        const { utente } = await creaAdminCatalogo()
        const token = generaToken(utente)

        const risposta = await request(app)
            .post('/api/prodotti')
            .set('Authorization', `Bearer ${token}`)
            .send({ sku: 'SKU-SENZA-SCORTA', nome: 'Prodotto', prezzo: 5, tipo_unita: 'PEZZO' })

        expect(risposta.status).toBe(201)
        expect(parseFloat(risposta.body.prodotto.scorta)).toBe(0)
    })

    test('la creazione richiede il permesso prodotti:creare', async () => {
        const utenteSenzaPermessi = await creaUtente()
        const token = generaToken(utenteSenzaPermessi)

        const risposta = await request(app)
            .post('/api/prodotti')
            .set('Authorization', `Bearer ${token}`)
            .send({ sku: 'SKU-NEGATO', nome: 'Prodotto', prezzo: 5, tipo_unita: 'PEZZO' })

        expect(risposta.status).toBe(403)
    })
})

describe('Prodotti: lettura', () => {
    test('la lista richiede solo autenticazione, nessun permesso specifico', async () => {
        await creaProdotto()
        const utenteQualsiasi = await creaUtente()
        const token = generaToken(utenteQualsiasi)

        const risposta = await request(app).get('/api/prodotti').set('Authorization', `Bearer ${token}`)
        expect(risposta.status).toBe(200)
        expect(Array.isArray(risposta.body)).toBe(true)
    })

    test('senza token: 401', async () => {
        const risposta = await request(app).get('/api/prodotti')
        expect(risposta.status).toBe(401)
    })

    test('un id inesistente restituisce 404', async () => {
        const utenteQualsiasi = await creaUtente()
        const token = generaToken(utenteQualsiasi)

        const risposta = await request(app).get('/api/prodotti/999999').set('Authorization', `Bearer ${token}`)
        expect(risposta.status).toBe(404)
    })
})

describe('Prodotti: modifica ed eliminazione', () => {
    test('la modifica richiede il permesso prodotti:modificare', async () => {
        const prodotto = await creaProdotto({ prezzo: 10 })
        const utenteSenzaPermessi = await creaUtente()
        const token = generaToken(utenteSenzaPermessi)

        const risposta = await request(app)
            .put(`/api/prodotti/${prodotto.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ prezzo: 20 })

        expect(risposta.status).toBe(403)
    })

    test('con il permesso, la modifica aggiorna i campi indicati', async () => {
        const prodotto = await creaProdotto({ prezzo: 10, scorta: 5 })
        const { utente } = await creaAdminCatalogo()
        const token = generaToken(utente)

        const risposta = await request(app)
            .put(`/api/prodotti/${prodotto.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ prezzo: 25, scorta: 50 })

        expect(risposta.status).toBe(200)
        expect(parseFloat(risposta.body.prodotto.prezzo)).toBe(25)
        expect(parseFloat(risposta.body.prodotto.scorta)).toBe(50)
    })

    test('l\'eliminazione richiede il permesso prodotti:eliminare', async () => {
        const prodotto = await creaProdotto()
        const utenteSenzaPermessi = await creaUtente()
        const token = generaToken(utenteSenzaPermessi)

        const risposta = await request(app)
            .delete(`/api/prodotti/${prodotto.id}`)
            .set('Authorization', `Bearer ${token}`)

        expect(risposta.status).toBe(403)
    })

    test('l\'eliminazione e\' un soft delete: il record resta nel db con attivo=false', async () => {
        const prodotto = await creaProdotto()
        const { utente } = await creaAdminCatalogo()
        const token = generaToken(utente)

        const risposta = await request(app)
            .delete(`/api/prodotti/${prodotto.id}`)
            .set('Authorization', `Bearer ${token}`)

        expect(risposta.status).toBe(200)

        const prodottoDopo = await Prodotto.findByPk(prodotto.id)
        expect(prodottoDopo).not.toBeNull()
        expect(prodottoDopo.attivo).toBe(false)
    })
})
