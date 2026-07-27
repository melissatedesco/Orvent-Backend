const request = require('supertest')
const app = require('../src/app')
const { Ruolo, Permesso, Gruppo, Utente } = require('../src/models')
const { creaUtente, creaUtenteConRuolo, generaToken } = require('./helpers/fixtures')

describe('Rimozione associazioni RBAC (controparte degli endpoint di assegnazione)', () => {
    // queste rotte sono amministrative: richiedono un utente autenticato con 'utenti:gestione'
    // creato dentro ogni test (non in beforeAll) perche' il beforeEach globale in
    // setupFilesAfterEnv.js svuota tutte le tabelle prima di ciascun test
    const creaAdminSicurezza = async () => {
        const { utente } = await creaUtenteConRuolo('RUOLO_ADMIN_RIMOZIONI', ['utenti:gestione'])
        return generaToken(utente)
    }

    test('rimuove un permesso da un ruolo', async () => {
        const tokenAdmin = await creaAdminSicurezza()
        const ruolo = await Ruolo.create({ name: 'RUOLO_RIMOZIONE' })
        const permesso = await Permesso.create({ name: 'permesso:rimozione' })
        await ruolo.addPermessi(permesso)

        const risposta = await request(app)
            .delete('/api/sicurezza/ruoli/associa-permesso')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ ruoloId: ruolo.id, permessoId: permesso.id })
        expect(risposta.status).toBe(200)

        const ruoloAggiornato = await Ruolo.findByPk(ruolo.id, { include: [{ model: Permesso, as: 'permessi' }] })
        expect(ruoloAggiornato.permessi.map(p => p.id)).not.toContain(permesso.id)

        const nonTrovato = await request(app)
            .delete('/api/sicurezza/ruoli/associa-permesso')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ ruoloId: 999999, permessoId: permesso.id })
        expect(nonTrovato.status).toBe(404)
    })

    test('rimuove un ruolo diretto da un utente', async () => {
        const tokenAdmin = await creaAdminSicurezza()
        const utente = await creaUtente()
        const ruolo = await Ruolo.create({ name: 'RUOLO_DA_RIMUOVERE' })
        await utente.addRuoli_diretti(ruolo)

        const risposta = await request(app)
            .delete('/api/sicurezza/utenti/assegna-ruolo')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ utenteId: utente.id, ruoloId: ruolo.id })
        expect(risposta.status).toBe(200)

        const utenteAggiornato = await Utente.findByPk(utente.id, { include: [{ model: Ruolo, as: 'ruoli_diretti' }] })
        expect(utenteAggiornato.ruoli_diretti.map(r => r.id)).not.toContain(ruolo.id)
    })

    test('rimuove un permesso assegnato direttamente a un utente', async () => {
        const tokenAdmin = await creaAdminSicurezza()
        const utente = await creaUtente()
        const permesso = await Permesso.create({ name: 'permesso:diretto:rimuovi' })
        await utente.addPermessi_diretti(permesso)

        const risposta = await request(app)
            .delete('/api/sicurezza/permessi/assegna-diretto')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ utenteId: utente.id, permessoId: permesso.id })
        expect(risposta.status).toBe(200)

        const utenteAggiornato = await Utente.findByPk(utente.id, { include: [{ model: Permesso, as: 'permessi_diretti' }] })
        expect(utenteAggiornato.permessi_diretti.map(p => p.id)).not.toContain(permesso.id)
    })

    test('rimuove un ruolo da un gruppo', async () => {
        const tokenAdmin = await creaAdminSicurezza()
        const gruppo = await Gruppo.create({ name: 'GRUPPO_RIMOZIONE_RUOLO' })
        const ruolo = await Ruolo.create({ name: 'RUOLO_DEL_GRUPPO' })
        await gruppo.addRuoli_gruppo(ruolo)

        const risposta = await request(app)
            .delete('/api/sicurezza/gruppi/associa-ruolo')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ gruppoId: gruppo.id, ruoloId: ruolo.id })
        expect(risposta.status).toBe(200)

        const gruppoAggiornato = await Gruppo.findByPk(gruppo.id, { include: [{ model: Ruolo, as: 'ruoli_gruppo' }] })
        expect(gruppoAggiornato.ruoli_gruppo.map(r => r.id)).not.toContain(ruolo.id)
    })

    test('rimuove un utente da un gruppo', async () => {
        const tokenAdmin = await creaAdminSicurezza()
        const utente = await creaUtente()
        const gruppo = await Gruppo.create({ name: 'GRUPPO_RIMOZIONE_UTENTE' })
        await utente.addGruppi(gruppo)

        const risposta = await request(app)
            .delete('/api/sicurezza/utenti/assegna-gruppo')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ utenteId: utente.id, gruppoId: gruppo.id })
        expect(risposta.status).toBe(200)

        const utenteAggiornato = await Utente.findByPk(utente.id, { include: [{ model: Gruppo, as: 'gruppi' }] })
        expect(utenteAggiornato.gruppi.map(g => g.id)).not.toContain(gruppo.id)
    })
})
