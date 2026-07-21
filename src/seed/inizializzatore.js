const bcrypt = require('bcryptjs')
const {sequelize, Permesso, Ruolo, Utente} = require('../models')

// funzione principale
async function avviaInizializzazione() {
    try {
        console.log('--- INIZIO POPOLAMENTO DATABASE ---')

        // crea le tabelle che nonnesisono
        // alter true aggiorna i campi senza cancellare i dati esistenti
        await sequelize.sync({alter: true})
        console.log('Tabelle create o aggiornate con successo')

        // creazione dei permessi base
        // uso findOrCreate per evitare dublicati se lo script viene lanciato due volte
        await Permesso.findOrCreate({
            where: {name: 'catalogo:gestione'},
            defaults: {
                description: 'Permette di creare, modificare e disattivare prodotti'}
        })

        await Permesso.findOrCreate({
            where: {name: 'ordini:gestione'},
            defaults: {
                description: 'Permettere di gestire, evadere e fatturare gli ordini'}
        })

        await Permesso.findOrCreate({
            where: {name: 'prodotti:creare'},
            defaults: {
                description: 'Permette di creare nuovi prodotti nel catalogo'}
        })

        await Permesso.findOrCreate({
            where: {name: 'prodotti:modificare'},
            defaults: {
                description: 'Permette di modificare i prodotti esistenti nel catalogo'}
        })

        await Permesso.findOrCreate({
            where: {name: 'prodotti:eliminare'},
            defaults: {
                description: 'Permette di disattivare i prodotti dal catalogo'}
        })

        await Permesso.findOrCreate({
            where: {name: 'utenti:gestione'},
            defaults: {
                description: 'Permette di visualizzare, modificare e disattivare gli utenti'}
        })

        await Permesso.findOrCreate({
            where: {name: 'ordini:creare'},
            defaults: {
                description: 'Permette al cliente di inviare un nuovo ordine dal carrello'}
        })

        await Permesso.findOrCreate({
            where: {name: 'ordini:evadere'},
            defaults: {
                description: 'Permette all\'operatore di magazzino di prendere in carico ed evadere gli ordini, scalando lo stock'}
        })

        await Permesso.findOrCreate({
            where: {name: 'fatture:gestione'},
            defaults: {
                description: 'Permette alla contabilità di generare, consultare e cercare le fatture'}
        })
        console.log('Permessi di sistema pronti')

        // creazione dei ruoli
        const [ruoloAdmin] = await Ruolo.findOrCreate({
            where: { name: 'AMMINISTRATORE'},
            defaults: {
                description: 'Accesso totale a tutte le funzionalità del gestionale'}
        })

        const [ruoloCliente] = await Ruolo.findOrCreate({
            where: { name: 'CLIENTE'},
            defaults: {
                description: 'Utente finale che effettua gli ordini sul catalogo'}
        })

        const [ruoloOperatore] = await Ruolo.findOrCreate({
            where: { name: 'OPERATORE_MAGAZZINO'},
            defaults: {
                description: 'Gestisce la lista ordini e l\'evasione, senza accesso a prezzi e fatture'}
        })

        const [ruoloContabilita] = await Ruolo.findOrCreate({
            where: { name: 'CONTABILITA'},
            defaults: {
                description: 'Genera e consulta le fatture degli ordini evasi'}
        })
        console.log('Ruoli standard creati')

        // assegnazione di tutti i permessi all'admin
        // sequelize crea automaticamente i metodi set o add per le relazioni molti a molti
        const tuttiIPermessi = await Permesso.findAll()
        await ruoloAdmin.setPermessi(tuttiIPermessi)
        console.log(`Tutti i permessi (${tuttiIPermessi.length}) associati al ruolo Admin`)

        // assegnazione dei permessi operativi ai ruoli CLIENTE e OPERATORE_MAGAZZINO
        const permessoCreaOrdine = await Permesso.findOne({ where: { name: 'ordini:creare' } })
        await ruoloCliente.addPermessi(permessoCreaOrdine)

        const permessoEvadiOrdine = await Permesso.findOne({ where: { name: 'ordini:evadere' } })
        await ruoloOperatore.addPermessi(permessoEvadiOrdine)

        const permessoGestioneFatture = await Permesso.findOne({ where: { name: 'fatture:gestione' } })
        await ruoloContabilita.addPermessi(permessoGestioneFatture)
        console.log('Permessi operativi assegnati ai ruoli CLIENTE, OPERATORE_MAGAZZINO e CONTABILITA')

        // creazione utente admin
        const emailAdmin = 'admin@orvent.it'
        const utenteEsistente = await Utente.findOne({
            where: {email: emailAdmin}
        })

        if(!utenteEsistente) {
            // legge la password prima di salvarla nel db
            const salt = await bcrypt.genSalt(10)
            const passwordCifrata = await bcrypt.hash('Admin123!', salt)

            const superUser = await Utente.create({
                email: emailAdmin,
                password_hash: passwordCifrata,
                nome:'Admin',
                cognome: 'Orvent',
                attivo: true
            })

            // colleghiamo l'utente appena creato al ruolo Admin
            await superUser.addRuoli_diretti(ruoloAdmin)
            console.log(`Utente admin creato con successo!  Accedi con: ${emailAdmin}`)
        } else {
            console.log('Utente admin glià presente')
        }

        console.log('--- POPOLAMENTO COMPLETATO SON SUCCESSO ---')
    } catch (err) {
        console.error('Errore durante l\'inizializzazione del database:', err)
    } finally {
        // chiudiamo la connessione al db per non lasciare il processo node appeso
        await sequelize.close()
    }
}

avviaInizializzazione()