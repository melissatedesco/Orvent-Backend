require('dotenv').config()

// senza JWT_SECRET l'app non deve avviarsi: un fallback hardcoded nel codice sarebbe
// un segreto noto a chiunque veda il repository, capace di forgiare un token valido
// per qualsiasi utente. Meglio un crash rumoroso al deploy che un buco silenzioso in
// produzione. Il controllo va fatto PRIMA di richiedere ./app, perche' richiederlo
// carica a sua volta i controller che leggono process.env.JWT_SECRET al load del modulo
if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET non impostata: impossibile avviare il server in sicurezza.')
    process.exit(1)
}

const app = require('./app')
const { sequelize } = require('./models')

const PORT = process.env.PORT || 5000

// connessione al db e avvio server
// sincronizzazione dei modelli con il db
sequelize.sync()
.then(() => {
    console.log('Connessione al database MySQL sincronizzata con successo')

    // una volta pronto il db, avviamo il server express
    app.listen(PORT, () => {
        console.log(`Server Orvent attivo su: http://localhost:${PORT}`)
    })
})
.catch(error => {
    console.error('Impossibile avviare l\'app. Errore di sincronizzazione', error)
})
