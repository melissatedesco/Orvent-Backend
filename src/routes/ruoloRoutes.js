const express = require('express')
const router = express.Router()
const ruoloController = require('../controllers/ruoloController')

router.post('/ruoli', ruoloController.creaRuolo )
router.post('/ruoli/associa-permesso', ruoloController.associaPermesso)
router.post('/utenti/assegna-ruolo', ruoloController.assegnaAUtente)

module.exports= router