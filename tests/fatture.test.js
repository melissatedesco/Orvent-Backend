const fs = require('fs')
const request = require('supertest')
const app = require('../src/app')
const { Ordine } = require('../src/models')
const { creaUtenteConRuolo, generaToken, creaProdotto } = require('./helpers/fixtures')

const creaCliente = () => creaUtenteConRuolo('TEST_CLIENTE', ['ordini:creare'])
const creaOperatore = () => creaUtenteConRuolo('TEST_OPERATORE', ['ordini:evadere'])
const creaContabile = () => creaUtenteConRuolo('TEST_CONTABILITA', ['fatture:gestione'])

// crea un prodotto e un ordine gia' evaso (pronto per essere fatturato)
const creaOrdineEvaso = async (tokenCliente, tokenOperatore, overrides = {}) => {
    const prodotto = await creaProdotto(overrides)
    const { body } = await request(app)
        .post('/api/ordini')
        .set('Authorization', `Bearer ${tokenCliente}`)
        .send({ righe: [{ prodottoId: prodotto.id, quantita: overrides.quantita ?? 2 }] })

    await request(app)
        .post(`/api/ordini/${body.ordine.id}/prendi-in-carico`)
        .set('Authorization', `Bearer ${tokenOperatore}`)
    await request(app)
        .post(`/api/ordini/${body.ordine.id}/evadi`)
        .set('Authorization', `Bearer ${tokenOperatore}`)

    return body.ordine.id
}

describe('Fatture: generazione, calcolo e numerazione', () => {
    test('genera la fattura da un ordine evaso: imponibile, IVA, totale e PDF su disco', async () => {
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const { utente: contabile } = await creaContabile()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)
        const tokenContabile = generaToken(contabile)

        const idOrdine = await creaOrdineEvaso(tokenCliente, tokenOperatore, { prezzo: 100, scorta: 10, quantita: 2 })

        const risposta = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        expect(risposta.status).toBe(201)
        const { fattura } = risposta.body
        expect(fattura.numero_fattura).toBe(1)
        expect(parseFloat(fattura.importo_imponibile)).toBe(200)
        expect(parseFloat(fattura.importo_iva)).toBe(44)
        expect(parseFloat(fattura.importo_totale)).toBe(244)
        expect(fs.existsSync(fattura.percorso_pdf)).toBe(true)

        const ordineDopo = await Ordine.findByPk(idOrdine)
        expect(ordineDopo.stato).toBe('FATTURATO')
    })

    test('non si puo\' fatturare un ordine non ancora evaso', async () => {
        const { utente: cliente } = await creaCliente()
        const { utente: contabile } = await creaContabile()
        const tokenCliente = generaToken(cliente)
        const tokenContabile = generaToken(contabile)

        const prodotto = await creaProdotto()
        const { body } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 1 }] })

        const risposta = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: body.ordine.id })

        expect(risposta.status).toBe(400)
    })

    test('non si puo\' fatturare due volte lo stesso ordine', async () => {
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const { utente: contabile } = await creaContabile()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)
        const tokenContabile = generaToken(contabile)

        const idOrdine = await creaOrdineEvaso(tokenCliente, tokenOperatore)

        await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        const secondoTentativo = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        expect(secondoTentativo.status).toBe(400)
    })

    test('la numerazione e\' progressiva su ordini fatturati in sequenza', async () => {
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const { utente: contabile } = await creaContabile()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)
        const tokenContabile = generaToken(contabile)

        const idOrdine1 = await creaOrdineEvaso(tokenCliente, tokenOperatore)
        const idOrdine2 = await creaOrdineEvaso(tokenCliente, tokenOperatore)

        const fattura1 = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine1 })
        const fattura2 = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine2 })

        expect(fattura1.body.fattura.numero_fattura).toBe(1)
        expect(fattura2.body.fattura.numero_fattura).toBe(2)
    })

    test('la numerazione resta univoca e senza buchi anche generando fatture in concorrenza', async () => {
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const { utente: contabile } = await creaContabile()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)
        const tokenContabile = generaToken(contabile)

        const idOrdini = []
        for (let i = 0; i < 4; i += 1) {
            idOrdini.push(await creaOrdineEvaso(tokenCliente, tokenOperatore))
        }

        const risposte = await Promise.all(
            idOrdini.map(idOrdine => request(app)
                .post('/api/fatture/genera')
                .set('Authorization', `Bearer ${tokenContabile}`)
                .send({ ordineId: idOrdine })
            )
        )

        risposte.forEach(risposta => expect(risposta.status).toBe(201))

        const numeri = risposte.map(r => r.body.fattura.numero_fattura).sort((a, b) => a - b)
        expect(numeri).toEqual([1, 2, 3, 4])
    })
})
