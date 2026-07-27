const request = require('supertest')
const app = require('../src/app')
const { Ordine, Prodotto } = require('../src/models')
const { creaUtenteConRuolo, generaToken, creaProdotto } = require('./helpers/fixtures')

const creaCliente = () => creaUtenteConRuolo('TEST_CLIENTE', ['ordini:creare'])
const creaOperatore = () => creaUtenteConRuolo('TEST_OPERATORE', ['ordini:evadere'])

describe('Ordini: transazioni, congelamento prezzo e stock', () => {
    test('la creazione congela il prezzo e non scala subito lo stock', async () => {
        const prodotto = await creaProdotto({ prezzo: 10.00, scorta: 50 })
        const { utente } = await creaCliente()
        const token = generaToken(utente)

        const rispostaCreazione = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${token}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 3 }] })

        expect(rispostaCreazione.status).toBe(201)
        expect(rispostaCreazione.body.ordine.stato).toBe('NUOVO')
        expect(parseFloat(rispostaCreazione.body.ordine.totale_importo)).toBe(30)
        expect(parseFloat(rispostaCreazione.body.ordine.righe[0].prezzo_congelato)).toBe(10)

        const prodottoDopo = await Prodotto.findByPk(prodotto.id)
        expect(parseFloat(prodottoDopo.scorta)).toBe(50)

        // il prezzo di catalogo cambia, ma la riga d'ordine resta congelata al valore storico
        prodottoDopo.prezzo = 999
        await prodottoDopo.save()

        const idOrdine = rispostaCreazione.body.ordine.id
        const rispostaDettaglio = await request(app)
            .get(`/api/ordini/${idOrdine}`)
            .set('Authorization', `Bearer ${token}`)

        expect(parseFloat(rispostaDettaglio.body.righe[0].prezzo_congelato)).toBe(10)
    })

    test('una quantita superiore alla scorta viene rifiutata e non crea l\'ordine', async () => {
        const prodotto = await creaProdotto({ scorta: 5 })
        const { utente } = await creaCliente()
        const token = generaToken(utente)

        const risposta = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${token}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 10 }] })

        expect(risposta.status).toBe(409)
        expect(await Ordine.count()).toBe(0)
    })

    test('una quantita non numerica viene rifiutata con 400, non propagata come NaN', async () => {
        const prodotto = await creaProdotto({ scorta: 10 })
        const { utente } = await creaCliente()
        const token = generaToken(utente)

        const risposta = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${token}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 'abc' }] })

        expect(risposta.status).toBe(400)
        expect(await Ordine.count()).toBe(0)
    })

    test('operatore: prendi in carico ed evadi scalano correttamente lo stock', async () => {
        const prodotto = await creaProdotto({ scorta: 10 })
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)

        const { body } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 4 }] })
        const idOrdine = body.ordine.id

        const presoInCarico = await request(app)
            .post(`/api/ordini/${idOrdine}/prendi-in-carico`)
            .set('Authorization', `Bearer ${tokenOperatore}`)
        expect(presoInCarico.status).toBe(200)
        expect(presoInCarico.body.ordine.stato).toBe('IN_EVASIONE')

        const evaso = await request(app)
            .post(`/api/ordini/${idOrdine}/evadi`)
            .set('Authorization', `Bearer ${tokenOperatore}`)
        expect(evaso.status).toBe(200)
        expect(evaso.body.ordine.stato).toBe('EVASO')

        const prodottoDopo = await Prodotto.findByPk(prodotto.id)
        expect(parseFloat(prodottoDopo.scorta)).toBe(6)
    })

    test('l\'operatore non vede prezzi e importi ne\' in prendi-in-carico ne\' in evadi', async () => {
        // evadi in particolare carica ordine.righe per scalare lo stock: senza il filtro,
        // prezzo_congelato per riga finirebbe nella risposta come effetto collaterale
        const prodotto = await creaProdotto({ prezzo: 42, scorta: 10 })
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)

        const { body } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 2 }] })
        const idOrdine = body.ordine.id

        const presoInCarico = await request(app)
            .post(`/api/ordini/${idOrdine}/prendi-in-carico`)
            .set('Authorization', `Bearer ${tokenOperatore}`)
        expect(presoInCarico.body.ordine.totale_importo).toBeUndefined()

        const evaso = await request(app)
            .post(`/api/ordini/${idOrdine}/evadi`)
            .set('Authorization', `Bearer ${tokenOperatore}`)
        expect(evaso.body.ordine.totale_importo).toBeUndefined()
        evaso.body.ordine.righe.forEach(riga => {
            expect(riga.prezzo_congelato).toBeUndefined()
        })
    })

    test('evadere un ordine con scorta diventata insufficiente nel frattempo fallisce senza modificare nulla', async () => {
        const prodotto = await creaProdotto({ scorta: 10 })
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)

        const { body } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 4 }] })
        const idOrdine = body.ordine.id

        // un altro movimento di magazzino nel frattempo azzera quasi tutta la scorta
        prodotto.scorta = 1
        await prodotto.save()

        const evasione = await request(app)
            .post(`/api/ordini/${idOrdine}/evadi`)
            .set('Authorization', `Bearer ${tokenOperatore}`)
        expect(evasione.status).toBe(409)

        const ordineDopo = await Ordine.findByPk(idOrdine)
        expect(ordineDopo.stato).toBe('NUOVO')

        const prodottoDopo = await Prodotto.findByPk(prodotto.id)
        expect(parseFloat(prodottoDopo.scorta)).toBe(1)
    })

    test('due evasioni concorrenti sullo stesso prodotto non fanno mai scendere la scorta sotto zero', async () => {
        const prodotto = await creaProdotto({ scorta: 5 })
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)

        const ordine1 = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 5 }] })
        const ordine2 = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 5 }] })

        const [risposta1, risposta2] = await Promise.all([
            request(app).post(`/api/ordini/${ordine1.body.ordine.id}/evadi`).set('Authorization', `Bearer ${tokenOperatore}`),
            request(app).post(`/api/ordini/${ordine2.body.ordine.id}/evadi`).set('Authorization', `Bearer ${tokenOperatore}`)
        ])

        const codici = [risposta1.status, risposta2.status].sort()
        expect(codici).toEqual([200, 409])

        const prodottoDopo = await Prodotto.findByPk(prodotto.id)
        expect(parseFloat(prodottoDopo.scorta)).toBe(0)

        const ordiniEvasi = await Ordine.count({ where: { stato: 'EVASO' } })
        expect(ordiniEvasi).toBe(1)
    })

    test('evadere un ordine registra chi lo ha evaso e quando', async () => {
        const prodotto = await creaProdotto({ scorta: 10 })
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)

        const { body } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 1 }] })

        const prima = new Date()
        await request(app)
            .post(`/api/ordini/${body.ordine.id}/evadi`)
            .set('Authorization', `Bearer ${tokenOperatore}`)

        const ordineDopo = await Ordine.findByPk(body.ordine.id)
        expect(ordineDopo.operatore_id).toBe(operatore.id)
        expect(ordineDopo.data_evasione).not.toBeNull()
        expect(new Date(ordineDopo.data_evasione).getTime()).toBeGreaterThanOrEqual(prima.getTime() - 1000)
    })

    test('due evasioni concorrenti su ordini con gli stessi prodotti in sequenza invertita non vanno in stallo', async () => {
        // ordine1 blocchera' prodottoA poi prodottoB; ordine2 (con le righe create in ordine
        // opposto) deve comunque lockare prima prodottoA e poi prodottoB, non il contrario:
        // e' esattamente l'ordinamento per prodotto_id in evadiOrdine a prevenire il deadlock
        const prodottoA = await creaProdotto({ scorta: 10 })
        const prodottoB = await creaProdotto({ scorta: 10 })
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)

        const ordine1 = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [
                { prodottoId: prodottoA.id, quantita: 1 },
                { prodottoId: prodottoB.id, quantita: 1 }
            ] })
        const ordine2 = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [
                { prodottoId: prodottoB.id, quantita: 1 },
                { prodottoId: prodottoA.id, quantita: 1 }
            ] })

        const [risposta1, risposta2] = await Promise.all([
            request(app).post(`/api/ordini/${ordine1.body.ordine.id}/evadi`).set('Authorization', `Bearer ${tokenOperatore}`),
            request(app).post(`/api/ordini/${ordine2.body.ordine.id}/evadi`).set('Authorization', `Bearer ${tokenOperatore}`)
        ])

        expect(risposta1.status).toBe(200)
        expect(risposta2.status).toBe(200)
    })

    test('una creaOrdine e una evadiOrdine concorrenti sugli stessi prodotti, in ordine incrociato, non vanno in stallo', async () => {
        // ordineEsistente coinvolge prodottoA e prodottoB: evadiOrdine li lockera' per
        // prodotto_id (A poi B). Una NUOVA creaOrdine, concorrente, arriva con le righe
        // in ordine opposto nel carrello ([B, A]): se creaOrdine lockasse nell'ordine del
        // carrello (B poi A) mentre evadiOrdine lockera' (A poi B), si formerebbe comunque
        // un ciclo di attesa, anche se nessuno dei due percorsi e' "l'evasione doppia" del
        // test precedente. L'ordinamento per prodottoId va applicato in entrambi i percorsi.
        const prodottoA = await creaProdotto({ scorta: 10 })
        const prodottoB = await creaProdotto({ scorta: 10 })
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)

        const ordineEsistente = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [
                { prodottoId: prodottoA.id, quantita: 1 },
                { prodottoId: prodottoB.id, quantita: 1 }
            ] })

        const [rispostaEvasione, rispostaCreazione] = await Promise.all([
            request(app).post(`/api/ordini/${ordineEsistente.body.ordine.id}/evadi`).set('Authorization', `Bearer ${tokenOperatore}`),
            request(app).post('/api/ordini').set('Authorization', `Bearer ${tokenCliente}`).send({ righe: [
                { prodottoId: prodottoB.id, quantita: 1 },
                { prodottoId: prodottoA.id, quantita: 1 }
            ] })
        ])

        expect(rispostaEvasione.status).toBe(200)
        expect(rispostaCreazione.status).toBe(201)
    })
})

describe('Ordini: annullamento', () => {
    test('il cliente puo\' annullare un proprio ordine NUOVO', async () => {
        const prodotto = await creaProdotto()
        const { utente } = await creaCliente()
        const token = generaToken(utente)

        const { body } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${token}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 1 }] })

        const risposta = await request(app)
            .post(`/api/ordini/${body.ordine.id}/annulla`)
            .set('Authorization', `Bearer ${token}`)

        expect(risposta.status).toBe(200)
        expect(risposta.body.ordine.stato).toBe('ANNULLATO')
    })

    test('non si puo\' annullare un ordine gia\' preso in carico', async () => {
        const prodotto = await creaProdotto()
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)

        const { body } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 1 }] })

        await request(app)
            .post(`/api/ordini/${body.ordine.id}/prendi-in-carico`)
            .set('Authorization', `Bearer ${tokenOperatore}`)

        const risposta = await request(app)
            .post(`/api/ordini/${body.ordine.id}/annulla`)
            .set('Authorization', `Bearer ${tokenCliente}`)

        expect(risposta.status).toBe(400)
    })

    test('un cliente non puo\' annullare l\'ordine di un altro cliente', async () => {
        const prodotto = await creaProdotto()
        const { utente: clienteA } = await creaCliente()
        const { utente: clienteB } = await creaCliente()
        const tokenA = generaToken(clienteA)
        const tokenB = generaToken(clienteB)

        const { body } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 1 }] })

        const risposta = await request(app)
            .post(`/api/ordini/${body.ordine.id}/annulla`)
            .set('Authorization', `Bearer ${tokenB}`)

        expect(risposta.status).toBe(403)
    })
})
