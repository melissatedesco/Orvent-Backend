const express = require('express')
const router = express.Router()
const fatturaController = require('../controllers/fatturaController')
const { verificaToken } = require('../middleware/authJwt')
const hasPermission = require('../middleware/hasPermission')

// contabilità: coda degli ordini evasi da fatturare
router.get('/coda', verificaToken, hasPermission('fatture:gestione'), fatturaController.codaDaFatturare)

// contabilità: genera una fattura da un ordine evaso
router.post('/genera', verificaToken, hasPermission('fatture:gestione'), fatturaController.genera)

// contabilità: storico fatture, ricercabile tramite query string (?numero, ?ordineId, ?cliente, ?dal, ?al)
router.get('/', verificaToken, hasPermission('fatture:gestione'), fatturaController.lista)

// dettaglio di una fattura
router.get('/:id', verificaToken, hasPermission('fatture:gestione'), fatturaController.visualizzaFattura)

// scarica il pdf della fattura
router.get('/:id/pdf', verificaToken, hasPermission('fatture:gestione'), fatturaController.scaricaPdf)

module.exports = router
