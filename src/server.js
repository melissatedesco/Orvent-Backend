require('dotenv').config()
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
