const fs = require('fs')
const request = require('supertest')
const { PDFParse } = require('pdf-parse')
const app = require('../src/app')
const { Ordine, Fattura } = require('../src/models')
const { creaUtenteConRuolo, generaToken, creaProdotto } = require('./helpers/fixtures')

const estraiTestoPdf = async (percorsoPdf) => {
    const buffer = fs.readFileSync(percorsoPdf)
    const parser = new PDFParse({ data: buffer })
    const risultato = await parser.getText()
    return risultato.text
}

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

    test('l\'imponibile si arrotonda riga per riga, non sommando i grezzi e arrotondando alla fine', async () => {
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const { utente: contabile } = await creaContabile()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)
        const tokenContabile = generaToken(contabile)

        // due righe il cui subtotale grezzo (prezzo a 2 decimali x quantita' a 3 decimali)
        // NON e' un valore di centesimi pulito: 2.00 x 5.003 = 10.006, 2.00 x 10.003 = 20.006.
        // Arrotondando riga per riga: 10.01 + 20.01 = 30.02 (quello che deve salvare la fattura).
        // Sommando i grezzi e arrotondando una sola volta alla fine si otterrebbe invece
        // 30.012 -> 30.01: un centesimo in meno, che non torna con la somma delle righe stampate.
        const prodottoA = await creaProdotto({ prezzo: 2.00, scorta: 100 })
        const prodottoB = await creaProdotto({ prezzo: 2.00, scorta: 100 })

        const { body: creazione } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [
                { prodottoId: prodottoA.id, quantita: 5.003 },
                { prodottoId: prodottoB.id, quantita: 10.003 }
            ] })
        const idOrdine = creazione.ordine.id

        await request(app)
            .post(`/api/ordini/${idOrdine}/prendi-in-carico`)
            .set('Authorization', `Bearer ${tokenOperatore}`)
        await request(app)
            .post(`/api/ordini/${idOrdine}/evadi`)
            .set('Authorization', `Bearer ${tokenOperatore}`)

        const risposta = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        expect(parseFloat(risposta.body.fattura.importo_imponibile)).toBe(30.02)

        // il totale salvato deve coincidere esattamente con imponibile + IVA, senza
        // scostamenti di un centesimo dovuti a un doppio arrotondamento
        const { importo_imponibile, importo_iva, importo_totale } = risposta.body.fattura
        expect(parseFloat(importo_totale)).toBe(
            Math.round((parseFloat(importo_imponibile) + parseFloat(importo_iva)) * 100) / 100
        )
    })

    // timeout piu' alto del default (5s): il test fa oltre una dozzina di richieste
    // HTTP sequenziali (4 ordini x creazione/presa-in-carico/evasione) e ognuna, da
    // quando verificaToken rilegge 'attivo' dal DB ad ogni richiesta, costa una query
    // in piu' - un costo reale e accettato (vedi README), non un errore da correggere
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
    }, 20000)
})

describe('Fatture: il PDF si genera FUORI dalla transazione, dopo il commit', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    test('un fallimento nella scrittura del PDF non brucia il numero ne\' riporta l\'ordine a EVASO', async () => {
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const { utente: contabile } = await creaContabile()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)
        const tokenContabile = generaToken(contabile)

        const idOrdine = await creaOrdineEvaso(tokenCliente, tokenOperatore)

        // simula un disco pieno/errore di scrittura: il numero e lo stato dell'ordine sono
        // gia' stati committati nella transazione PRIMA che questo venga chiamato
        jest.spyOn(fs, 'mkdirSync').mockImplementationOnce(() => {
            throw new Error('ENOSPC: simulato per il test')
        })

        const rispostaFallita = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        expect(rispostaFallita.status).toBe(500)

        // il numero NON e' stato bruciato: la fattura esiste gia', numerata, ma senza PDF
        const fatturaIncompleta = await Fattura.findOne({ where: { ordine_id: idOrdine } })
        expect(fatturaIncompleta).not.toBeNull()
        expect(fatturaIncompleta.numero_fattura).toBe(1)
        expect(fatturaIncompleta.percorso_pdf).toBeNull()

        // e l'ordine resta FATTURATO (non torna a EVASO): il fallimento e' solo nel PDF,
        // numero e importi sono gia' un dato acquisito
        const ordineDopo = await Ordine.findByPk(idOrdine)
        expect(ordineDopo.stato).toBe('FATTURATO')

        // un secondo tentativo (disco tornato disponibile) completa la STESSA fattura,
        // riusando lo stesso numero, invece di rifiutare o crearne una seconda
        const rispostaCompletata = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        expect(rispostaCompletata.status).toBe(201)
        expect(rispostaCompletata.body.fattura.numero_fattura).toBe(1)
        expect(fs.existsSync(rispostaCompletata.body.fattura.percorso_pdf)).toBe(true)

        expect(await Fattura.count({ where: { ordine_id: idOrdine } })).toBe(1)
    })

    test('il PDF rigenerato stampa la data di emissione originale, non quella del retry', async () => {
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const { utente: contabile } = await creaContabile()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)
        const tokenContabile = generaToken(contabile)

        const idOrdine = await creaOrdineEvaso(tokenCliente, tokenOperatore)

        // il primo tentativo fallisce nella scrittura del PDF: numero e importi restano
        // pero' committati, con la loro data di emissione (createdAt) originale
        jest.spyOn(fs, 'mkdirSync').mockImplementationOnce(() => {
            throw new Error('ENOSPC: simulato per il test')
        })
        await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        // retrodatiamo l'emissione di 5 giorni: se il retry (che avviene ORA, in tempo
        // reale) generasse il PDF leggendo l'orologio corrente invece di fattura.createdAt,
        // il documento rigenerato stamperebbe la data di oggi, non quella retrodatata qui
        const dataEmissioneOriginale = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        await Fattura.update(
            { createdAt: dataEmissioneOriginale },
            { where: { ordine_id: idOrdine }, silent: true }
        )
        const dataEmissioneAttesa = dataEmissioneOriginale.toLocaleDateString('it-IT')
        const dataOggiNonAttesa = new Date().toLocaleDateString('it-IT')

        const rispostaCompletata = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })
        expect(rispostaCompletata.status).toBe(201)

        const testoPdf = await estraiTestoPdf(rispostaCompletata.body.fattura.percorso_pdf)
        expect(testoPdf).toContain(dataEmissioneAttesa)
        if (dataEmissioneAttesa !== dataOggiNonAttesa) {
            expect(testoPdf).not.toContain(dataOggiNonAttesa)
        }
    })
})
