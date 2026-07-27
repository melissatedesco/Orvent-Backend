const fs = require('fs')
const request = require('supertest')
const { PDFParse } = require('pdf-parse')
const app = require('../src/app')
const { creaUtenteConRuolo, generaToken, creaProdotto } = require('./helpers/fixtures')

const creaCliente = (overrides = {}) => creaUtenteConRuolo('TEST_CLIENTE_CONGELAMENTO', ['ordini:creare'], overrides)
const creaOperatore = () => creaUtenteConRuolo('TEST_OPERATORE_CONGELAMENTO', ['ordini:evadere'])
const creaContabile = () => creaUtenteConRuolo('TEST_CONTABILITA_CONGELAMENTO', ['fatture:gestione'])
const creaAdminCatalogo = () => creaUtenteConRuolo('TEST_ADMIN_CATALOGO_CONGELAMENTO', ['prodotti:modificare'])

const estraiTestoPdf = async (percorsoPdf) => {
    const buffer = fs.readFileSync(percorsoPdf)
    const parser = new PDFParse({ data: buffer })
    const risultato = await parser.getText()
    return risultato.text
}

// prova del nove per la regola di dominio "congelamento dati": una volta emessa,
// una fattura non deve MAI cambiare contenuto anche se il catalogo o il profilo
// cliente cambiano dopo. Questi test creano la condizione di modifica concorrente
// e verificano il testo effettivo del PDF gia' scritto su disco, non solo i campi
// del modello.
describe('Congelamento dati: la fattura non cambia se catalogo o cliente cambiano dopo', () => {
    test('rinominare il prodotto dopo l\'ordine non cambia il nome stampato in fattura', async () => {
        const { utente: cliente } = await creaCliente()
        const { utente: operatore } = await creaOperatore()
        const { utente: contabile } = await creaContabile()
        const { utente: adminCatalogo } = await creaAdminCatalogo()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)
        const tokenContabile = generaToken(contabile)
        const tokenAdminCatalogo = generaToken(adminCatalogo)

        const prodotto = await creaProdotto({ nome: 'NOME_ORIGINALE_PRODOTTO', prezzo: 10, scorta: 10 })

        const { body: creazione } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 1 }] })
        const idOrdine = creazione.ordine.id

        // il prodotto viene rinominato DOPO che l'ordine e' stato creato, prima della fattura
        const rinomina = await request(app)
            .put(`/api/prodotti/${prodotto.id}`)
            .set('Authorization', `Bearer ${tokenAdminCatalogo}`)
            .send({ nome: 'NOME_NUOVO_PRODOTTO' })
        expect(rinomina.status).toBe(200)

        await request(app)
            .post(`/api/ordini/${idOrdine}/prendi-in-carico`)
            .set('Authorization', `Bearer ${tokenOperatore}`)
        await request(app)
            .post(`/api/ordini/${idOrdine}/evadi`)
            .set('Authorization', `Bearer ${tokenOperatore}`)

        const { body: generazione } = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        const testoPdf = await estraiTestoPdf(generazione.fattura.percorso_pdf)

        expect(testoPdf).toContain('NOME_ORIGINALE_PRODOTTO')
        expect(testoPdf).not.toContain('NOME_NUOVO_PRODOTTO')
    })

    test('il cliente che cambia cognome dopo la fattura non ne altera piu\' il contenuto', async () => {
        const { utente: cliente } = await creaCliente({ nome: 'Mario', cognome: 'COGNOME_ORIGINALE' })
        const { utente: operatore } = await creaOperatore()
        const { utente: contabile } = await creaContabile()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)
        const tokenContabile = generaToken(contabile)

        const prodotto = await creaProdotto({ prezzo: 10, scorta: 10 })

        const { body: creazione } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 1 }] })
        const idOrdine = creazione.ordine.id

        await request(app)
            .post(`/api/ordini/${idOrdine}/prendi-in-carico`)
            .set('Authorization', `Bearer ${tokenOperatore}`)
        await request(app)
            .post(`/api/ordini/${idOrdine}/evadi`)
            .set('Authorization', `Bearer ${tokenOperatore}`)

        // la fattura viene generata ORA: congela il cliente cosi' come e' in questo istante
        const { body: generazione } = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })
        const idFattura = generazione.fattura.id

        // il cliente aggiorna il cognome SOLO ADESSO, a fattura gia' emessa: un documento
        // fiscale chiuso non deve mai risentirne, ne' se riletto ne' se ristampato
        const aggiornamentoProfilo = await request(app)
            .put('/api/utenti/profilo')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ cognome: 'COGNOME_NUOVO' })
        expect(aggiornamentoProfilo.status).toBe(200)

        // riletta dall'API (era il punto rotto: visualizzaFattura joinava Utente dal vivo)
        const rilettura = await request(app)
            .get(`/api/fatture/${idFattura}`)
            .set('Authorization', `Bearer ${tokenContabile}`)
        expect(rilettura.body.cliente_ragione_sociale).toContain('COGNOME_ORIGINALE')
        expect(rilettura.body.cliente_ragione_sociale).not.toContain('COGNOME_NUOVO')

        // e il PDF gia' scritto su disco, ovviamente, non cambia neppure lui
        const testoPdf = await estraiTestoPdf(generazione.fattura.percorso_pdf)
        expect(testoPdf).toContain('COGNOME_ORIGINALE')
        expect(testoPdf).not.toContain('COGNOME_NUOVO')
    })

    test('la fattura congela partita IVA e indirizzo del cliente, composti da via/CAP/citta/provincia', async () => {
        const { utente: cliente } = await creaCliente({
            partita_iva: 'IT12345678901',
            indirizzo: 'Via Roma 1',
            cap: '00100',
            citta: 'Roma',
            provincia: 'RM'
        })
        const { utente: operatore } = await creaOperatore()
        const { utente: contabile } = await creaContabile()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)
        const tokenContabile = generaToken(contabile)

        const prodotto = await creaProdotto({ prezzo: 10, scorta: 10 })

        const { body: creazione } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 1 }] })

        await request(app)
            .post(`/api/ordini/${creazione.ordine.id}/prendi-in-carico`)
            .set('Authorization', `Bearer ${tokenOperatore}`)
        await request(app)
            .post(`/api/ordini/${creazione.ordine.id}/evadi`)
            .set('Authorization', `Bearer ${tokenOperatore}`)

        const { body: generazione } = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: creazione.ordine.id })

        expect(generazione.fattura.cliente_partita_iva).toBe('IT12345678901')
        expect(generazione.fattura.cliente_indirizzo).toBe('Via Roma 1, 00100 Roma (RM)')

        const testoPdf = await estraiTestoPdf(generazione.fattura.percorso_pdf)
        expect(testoPdf).toContain('P.IVA: IT12345678901')
        expect(testoPdf).toContain('Indirizzo: Via Roma 1, 00100 Roma (RM)')
    })
})

// una fattura senza destinatario identificabile non e' un documento fiscale valido:
// va bloccata PRIMA, con un 400 esplicito alla contabile, non scoperta a documento emesso
describe('Validazione profilo fiscale del cliente prima di generare la fattura', () => {
    const creaOrdineEvasoConProfilo = async (overridesCliente) => {
        const { utente: cliente } = await creaCliente(overridesCliente)
        const { utente: operatore } = await creaOperatore()
        const tokenCliente = generaToken(cliente)
        const tokenOperatore = generaToken(operatore)

        const prodotto = await creaProdotto({ prezzo: 10, scorta: 10 })
        const { body } = await request(app)
            .post('/api/ordini')
            .set('Authorization', `Bearer ${tokenCliente}`)
            .send({ righe: [{ prodottoId: prodotto.id, quantita: 1 }] })

        await request(app)
            .post(`/api/ordini/${body.ordine.id}/prendi-in-carico`)
            .set('Authorization', `Bearer ${tokenOperatore}`)
        await request(app)
            .post(`/api/ordini/${body.ordine.id}/evadi`)
            .set('Authorization', `Bearer ${tokenOperatore}`)

        return body.ordine.id
    }

    test('rifiuta la generazione se al cliente manca l\'indirizzo, anche con partita IVA presente', async () => {
        const { utente: contabile } = await creaContabile()
        const tokenContabile = generaToken(contabile)
        const idOrdine = await creaOrdineEvasoConProfilo({ partita_iva: 'IT12345678901', indirizzo: null })

        const risposta = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        expect(risposta.status).toBe(400)
        expect(risposta.body.message).toMatch(/indirizzo/i)
    })

    test('rifiuta la generazione se al cliente manca sia la partita IVA sia il codice fiscale', async () => {
        const { utente: contabile } = await creaContabile()
        const tokenContabile = generaToken(contabile)
        const idOrdine = await creaOrdineEvasoConProfilo({ partita_iva: null, codice_fiscale: null })

        const risposta = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        expect(risposta.status).toBe(400)
        expect(risposta.body.message).toMatch(/partita iva|codice fiscale/i)
    })

    test('un cliente privato (solo codice fiscale, senza partita IVA) puo\' comunque essere fatturato', async () => {
        const { utente: contabile } = await creaContabile()
        const tokenContabile = generaToken(contabile)
        const idOrdine = await creaOrdineEvasoConProfilo({ partita_iva: null, codice_fiscale: 'RSSMRA80A01H501U' })

        const risposta = await request(app)
            .post('/api/fatture/genera')
            .set('Authorization', `Bearer ${tokenContabile}`)
            .send({ ordineId: idOrdine })

        expect(risposta.status).toBe(201)
        expect(risposta.body.fattura.cliente_partita_iva).toBeNull()
        expect(risposta.body.fattura.cliente_codice_fiscale).toBe('RSSMRA80A01H501U')

        const testoPdf = await estraiTestoPdf(risposta.body.fattura.percorso_pdf)
        expect(testoPdf).toContain('C.F.: RSSMRA80A01H501U')
        expect(testoPdf).not.toContain('P.IVA:')
    })
})
