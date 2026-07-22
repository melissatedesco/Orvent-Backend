const express = require('express')
const router = express.Router()
const permessoController = require('../controllers/permessoController')
const ruoloController = require('../controllers/ruoloController')
const gruppoController = require('../controllers/gruppoController')
const {verificaToken} = require('../middleware/authJwt')

// rotte permessi
router.post('/permessi', permessoController.creaPermesso)

// visualizza tutti i permessi
router.get('/permessi', verificaToken, permessoController.lista)

// assegna un permesso all'utente
router.post('/permessi/assegna-diretto', permessoController.assegnaAUtente)

// rimuove un permesso assegnato direttamente all'utente
router.delete('/permessi/assegna-diretto', permessoController.rimuoviDaUtente)

// visualizza un singolo permesso (path parametrico: va registrato dopo i path letterali sopra)
router.get('/permessi/:id', verificaToken, permessoController.visualizzaPermesso)

// aggiorna un permesso
router.put('/permessi/:id', verificaToken, permessoController.modifica)

// elimina un permesso
router.delete('/permessi/:id', verificaToken, permessoController.elimina)

// rotte ruolo
router.post('/ruoli', ruoloController.creaRuolo)

// visualizza tutti i ruoli
router.get('/ruoli', verificaToken, ruoloController.lista)

// associa permesso a ruolo
router.post('/ruoli/associa-permesso', ruoloController.associaPermesso)

// rimuove un permesso da un ruolo
router.delete('/ruoli/associa-permesso', ruoloController.rimuoviPermesso)

// assegna un ruolo ad un utente
router.post('/utenti/assegna-ruolo', ruoloController.assegnaAUtente)

// rimuove un ruolo diretto dall'utente
router.delete('/utenti/assegna-ruolo', ruoloController.rimuoviDaUtente)

// visualizza un singolo ruolo (con i permessi associati) (path parametrico: dopo i path letterali sopra)
router.get('/ruoli/:id', verificaToken, ruoloController.visualizzaRuolo)

// aggiorna un ruolo
router.put('/ruoli/:id', verificaToken, ruoloController.modifica)

// elimina un ruolo
router.delete('/ruoli/:id', verificaToken, ruoloController.elimina)

// rotte gruppo
router.post('/gruppi', gruppoController.creaGruppo)

// visualizza tutti i gruppi
router.get('/gruppi', verificaToken, gruppoController.lista)

// associa un ruolo a un gruppo
router.post('/gruppi/associa-ruolo', gruppoController.associaRuolo)

// rimuove un ruolo dal gruppo
router.delete('/gruppi/associa-ruolo', gruppoController.rimuoviRuolo)

// aggiunge un utente a un gruppo
router.post('/utenti/assegna-gruppo', gruppoController.aggiungiUtente)

// rimuove un utente dal gruppo
router.delete('/utenti/assegna-gruppo', gruppoController.rimuoviUtente)

// visualizza un singolo gruppo (con i ruoli associati) (path parametrico: dopo i path letterali sopra)
router.get('/gruppi/:id', verificaToken, gruppoController.visualizzaGruppo)

// aggiorna un gruppo
router.put('/gruppi/:id', verificaToken, gruppoController.modifica)

// elimina un gruppo
router.delete('/gruppi/:id', verificaToken, gruppoController.elimina)

module.exports= router
