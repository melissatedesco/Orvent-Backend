const request = require('supertest')
const app = require('../src/app')
const { creaUtente, creaUtenteConRuolo, generaToken } = require('./helpers/fixtures')

// un JWT resta valido fino alla scadenza anche se l'account viene disattivato nel
// frattempo: verificaToken deve rileggere 'attivo' ad ogni richiesta, non fidarsi solo
// del fatto che la firma del token sia valida, altrimenti la disattivazione di un
// account e' per lo piu' simbolica per le ore restanti del token
describe('Autenticazione: un token resta valido solo finche\' l\'account e\' attivo', () => {
    test('un utente disattivato dopo l\'emissione del token perde l\'accesso alla richiesta successiva', async () => {
        const utente = await creaUtente()
        const token = generaToken(utente)

        const primaDellaDisattivazione = await request(app)
            .get('/api/utenti/profilo')
            .set('Authorization', `Bearer ${token}`)
        expect(primaDellaDisattivazione.status).toBe(200)

        utente.attivo = false
        await utente.save()

        const dopoLaDisattivazione = await request(app)
            .get('/api/utenti/profilo')
            .set('Authorization', `Bearer ${token}`)
        expect(dopoLaDisattivazione.status).toBe(401)
    })

    test('un token con un id utente inesistente viene rifiutato', async () => {
        const token = generaToken({ id: 999999, email: 'fantasma@example.com' })

        const risposta = await request(app)
            .get('/api/utenti/profilo')
            .set('Authorization', `Bearer ${token}`)
        expect(risposta.status).toBe(401)
    })

    test('un utente attivo con permesso valido continua ad accedere normalmente', async () => {
        const { utente } = await creaUtenteConRuolo('TEST_AUTENTICAZIONE', ['prodotti:creare'])
        const token = generaToken(utente)

        const risposta = await request(app)
            .post('/api/prodotti')
            .set('Authorization', `Bearer ${token}`)
            .send({ sku: 'SKU-AUTH-TEST', nome: 'Prodotto', prezzo: 5, tipo_unita: 'PEZZO' })
        expect(risposta.status).toBe(201)
    })
})
