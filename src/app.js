const express = require('express')
const cors = require('cors')
const authRoutes = require('./routes/authRoutes')
const utenteRoutes = require('./routes/utenteRoutes')
const prodottoRoutes = require('./routes/prodottoRoutes')
const sicurezzaRoutes = require('./routes/sicurezzaRoutes')
const ordineRoutes = require('./routes/ordineRoutes')
const fatturaRoutes = require('./routes/fatturaRoutes')

const app = express()

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

module.exports = app
