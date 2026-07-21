const express = require('express')
const router = express.Router()
const permessoController = require('../controllers/permessoController')
const ruoloController = require('../controllers/ruoloController')

// rotte permessi
router.post('/permessi', permessoController.creaPermesso)

// assegna un permesso all'utente
router.post('/permessi/assegna-diretto', permessoController.assegnaAUtente)

// rotte ruolo
router.post('/ruoli', ruoloController.creaRuolo)

// associa permesso a ruolo
router.post('/ruoli/associa-permesso', ruoloController.associaPermesso)

// assegna un ruolo ad un utente
router.post('/utenti/assegna-ruolo', ruoloController.assegnaAUtente)

module.exports= router