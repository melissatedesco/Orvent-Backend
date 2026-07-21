const express = require('express')
const router = express.Router()
const ordineController = require('../controllers/ordineController')
const { verificaToken } = require('../middleware/authJwt')
const hasPermission = require('../middleware/hasPermission')

// cliente: invia un nuovo ordine dal carrello
router.post('/', verificaToken, hasPermission('ordini:creare'), ordineController.crea)

// cliente: storico dei propri ordini
router.get('/', verificaToken, ordineController.storicoProprio)

// operatore/admin: lista di tutti gli ordini, filtrabile per stato
router.get('/tutti', verificaToken, hasPermission('ordini:evadere'), ordineController.lista)

// dettaglio di un ordine (proprietario o staff)
router.get('/:id', verificaToken, ordineController.visualizzaOrdine)

// cliente: annulla un proprio ordine (solo se ancora NUOVO)
router.post('/:id/annulla', verificaToken, hasPermission('ordini:creare'), ordineController.annulla)

// operatore: prende in carico l'ordine
router.post('/:id/prendi-in-carico', verificaToken, hasPermission('ordini:evadere'), ordineController.prendiInCarico)

// operatore: evade l'ordine e scala lo stock
router.post('/:id/evadi', verificaToken, hasPermission('ordini:evadere'), ordineController.evadi)

module.exports = router
