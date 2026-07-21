const express = require('express')
const router = express.Router()
const permessoController = require('../controllers/permessoController')
const ruoloController = require('../controllers/ruoloController')
const {verificaToken} = require('../middleware/authJwt')

// rotte permessi
router.post('/permessi', permessoController.creaPermesso)

// visualizza tutti i permessi
router.get('/permessi', verificaToken, permessoController.lista)

// visualizza un singolo permesso
router.get('/permessi/:id', verificaToken, permessoController.visualizzaPermesso)

// aggiorna un permesso
router.put('/permessi/:id', verificaToken, permessoController.modifica)

// elimina un permesso
router.delete('/permessi/:id', verificaToken, permessoController.elimina)

// assegna un permesso all'utente
router.post('/permessi/assegna-diretto', permessoController.assegnaAUtente)

// rotte ruolo
router.post('/ruoli', ruoloController.creaRuolo)

// visualizza tutti i ruoli
router.get('/ruoli', verificaToken, ruoloController.lista)

// visualizza un singolo ruolo (con i permessi associati)
router.get('/ruoli/:id', verificaToken, ruoloController.visualizzaRuolo)

// aggiorna un ruolo
router.put('/ruoli/:id', verificaToken, ruoloController.modifica)

// elimina un ruolo
router.delete('/ruoli/:id', verificaToken, ruoloController.elimina)

// associa permesso a ruolo
router.post('/ruoli/associa-permesso', ruoloController.associaPermesso)

// assegna un ruolo ad un utente
router.post('/utenti/assegna-ruolo', ruoloController.assegnaAUtente)

module.exports= router