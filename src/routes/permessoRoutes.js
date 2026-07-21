const express = require('express')
const router = express.Router()
const permessoController = require('../controllers/permessoController')

router.post('/permessi', permessoController.creaPermesso)
router.post('/permessi/assegna-diretto', permessoController.assegnaAUtente)

module.exports= router