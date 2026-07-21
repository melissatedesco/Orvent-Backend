const express = require('express')
const router = express.Router()
const utenteController = require('../controllers/utenteController')
const {verificaToken} = require('../middleware/authJwt')
const hasPermission = require('../middleware/hasPermission')

// rotta per registrazione
router.post('/registrati', utenteController.registra)

// rotta protetta per vedere il proprio profilo
router.get('/profilo', verificaToken, utenteController.ottieniProfilo)

// rotta protetta per aggiornare il proprio profilo
router.put('/profilo', verificaToken, utenteController.aggiornaProfilo)

// rotta amministrativa per visualizzare tutti gli utenti
router.get('/', verificaToken, hasPermission('utenti:gestione'), utenteController.lista)

// rotta amministrativa per creare un utente scegliendo il ruolo (es. operatore, contabilità, admin)
router.post('/', verificaToken, hasPermission('utenti:gestione'), utenteController.creaUtente)

// rotta amministrativa per modificare un utente tramite ID
router.put('/:id', verificaToken, hasPermission('utenti:gestione'), utenteController.modifica)

// rotta amministrativa per visualizzare un singolo utente
router.get('/:id', verificaToken, hasPermission('utenti:gestione'), utenteController.visualizzaUtente)

// rotta amministrativa per disattivare (eliminare) un utente
router.delete('/:id', verificaToken, hasPermission('utenti:gestione'), utenteController.elimina)

module.exports = router