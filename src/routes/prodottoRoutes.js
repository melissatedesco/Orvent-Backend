const express = require('express')
const router = express.Router()
const prodottoController = require('../controllers/prodottoController')
const {verificaToken} = require('../middleware/authJwt')
const hasPermission = require('../middleware/hasPermission')

// rotta per visualizzare i prodotti
router.get('/', verificaToken, prodottoController.lista)

// rotta per visualizzare un singolo prodotto
router.get('/:id', verificaToken, prodottoController.visualizzaProdotto)

// rotta per crea un prodotto
router.post('/', verificaToken, hasPermission('prodotti:creare'), prodottoController.crea)

// rotta per aggiornare un prodotto
router.put('/:id', verificaToken, hasPermission('prodotti:modificare'), prodottoController.modifica)

// rotta per disattivare (eliminare) un prodotto
router.delete('/:id', verificaToken, hasPermission('prodotti:eliminare'), prodottoController.elimina)

module.exports= router