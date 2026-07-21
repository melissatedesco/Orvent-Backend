const express = require('express')
const router = express.Router()
const prodottoController = require('../controllers/prodottoController')
const {verificaToken} = require('../middleware/authJwt')
const hasPermission = require('../middleware/hasPermission')

// rotta per visualizzare i prodotti
router.get('/', verificaToken, prodottoController.lista)

// rotta per crea un prodotto
router.post('/', verificaToken, hasPermission('prodotti:creare'), prodottoController.crea)

module.exports= router