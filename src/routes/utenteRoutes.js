const express = require('express')
const router = express.Router()
const utenteController = require('../controllers/utenteController')
const {verificaToken} = require('../middleware/authJwt')

// rotta per registrazione
router.post('/registrati', utenteController.registra)

// rotta protetta per vedere il proprio profilo
router.get('/profilo', verificaToken, utenteController.ottieniProfilo)

module.exports = router