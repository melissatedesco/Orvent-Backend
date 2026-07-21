const express = require('express')
const cors = require('cors')
require('dotenv').config()
const {sequelize} = require('./models')
const authRoutes = require('./routes/authRoutes')
const utenteRoutes =require('./routes/utenteRoutes')
const prodottoRoutes = require('./routes/prodottoRoutes')
const sicurezzaRoutes= require('./routes/sicurezzaRoutes')
const ordineRoutes = require('./routes/ordineRoutes')
const fatturaRoutes = require('./routes/fatturaRoutes')
const app = express()
const PORT = process.env.PORT || 5000

// middleware globali
app.use(cors())
app.use(express.json())

// registrazione delle rotte
app.use('/api/utenti', utenteRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/prodotti', prodottoRoutes)
app.use('/api/sicurezza', sicurezzaRoutes)
app.use('/api/ordini', ordineRoutes)
app.use('/api/fatture', fatturaRoutes)

// rotta test rapido nel browser
app.get('/', (req, res) => {
    res.send('Orvent Backend API è online e funzionante ')
})

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