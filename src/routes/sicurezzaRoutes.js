const express = require('express')
const router = express.Router()
const permessoController = require('../controllers/permessoController')
const ruoloController = require('../controllers/ruoloController')
const gruppoController = require('../controllers/gruppoController')
const {verificaToken} = require('../middleware/authJwt')
const hasPermission = require('../middleware/hasPermission')

// tutte le rotte di questo file sono amministrative (RBAC): richiedono il permesso 'utenti:gestione'
const richiedeGestioneSicurezza = [verificaToken, hasPermission('utenti:gestione')]

// rotte permessi
router.post('/permessi', ...richiedeGestioneSicurezza, permessoController.creaPermesso)

// visualizza tutti i permessi
router.get('/permessi', ...richiedeGestioneSicurezza, permessoController.lista)

// assegna un permesso all'utente
router.post('/permessi/assegna-diretto', ...richiedeGestioneSicurezza, permessoController.assegnaAUtente)

// rimuove un permesso assegnato direttamente all'utente
router.delete('/permessi/assegna-diretto', ...richiedeGestioneSicurezza, permessoController.rimuoviDaUtente)

// visualizza un singolo permesso (path parametrico: va registrato dopo i path letterali sopra)
router.get('/permessi/:id', ...richiedeGestioneSicurezza, permessoController.visualizzaPermesso)

// aggiorna un permesso
router.put('/permessi/:id', ...richiedeGestioneSicurezza, permessoController.modifica)

// elimina un permesso
router.delete('/permessi/:id', ...richiedeGestioneSicurezza, permessoController.elimina)

// rotte ruolo
router.post('/ruoli', ...richiedeGestioneSicurezza, ruoloController.creaRuolo)

// visualizza tutti i ruoli
router.get('/ruoli', ...richiedeGestioneSicurezza, ruoloController.lista)

// associa permesso a ruolo
router.post('/ruoli/associa-permesso', ...richiedeGestioneSicurezza, ruoloController.associaPermesso)

// rimuove un permesso da un ruolo
router.delete('/ruoli/associa-permesso', ...richiedeGestioneSicurezza, ruoloController.rimuoviPermesso)

// assegna un ruolo ad un utente
router.post('/utenti/assegna-ruolo', ...richiedeGestioneSicurezza, ruoloController.assegnaAUtente)

// rimuove un ruolo diretto dall'utente
router.delete('/utenti/assegna-ruolo', ...richiedeGestioneSicurezza, ruoloController.rimuoviDaUtente)

// visualizza un singolo ruolo (con i permessi associati) (path parametrico: dopo i path letterali sopra)
router.get('/ruoli/:id', ...richiedeGestioneSicurezza, ruoloController.visualizzaRuolo)

// aggiorna un ruolo
router.put('/ruoli/:id', ...richiedeGestioneSicurezza, ruoloController.modifica)

// elimina un ruolo
router.delete('/ruoli/:id', ...richiedeGestioneSicurezza, ruoloController.elimina)

// rotte gruppo
router.post('/gruppi', ...richiedeGestioneSicurezza, gruppoController.creaGruppo)

// visualizza tutti i gruppi
router.get('/gruppi', ...richiedeGestioneSicurezza, gruppoController.lista)

// associa un ruolo a un gruppo
router.post('/gruppi/associa-ruolo', ...richiedeGestioneSicurezza, gruppoController.associaRuolo)

// rimuove un ruolo dal gruppo
router.delete('/gruppi/associa-ruolo', ...richiedeGestioneSicurezza, gruppoController.rimuoviRuolo)

// aggiunge un utente a un gruppo
router.post('/utenti/assegna-gruppo', ...richiedeGestioneSicurezza, gruppoController.aggiungiUtente)

// rimuove un utente dal gruppo
router.delete('/utenti/assegna-gruppo', ...richiedeGestioneSicurezza, gruppoController.rimuoviUtente)

// visualizza un singolo gruppo (con i ruoli associati) (path parametrico: dopo i path letterali sopra)
router.get('/gruppi/:id', ...richiedeGestioneSicurezza, gruppoController.visualizzaGruppo)

// aggiorna un gruppo
router.put('/gruppi/:id', ...richiedeGestioneSicurezza, gruppoController.modifica)

// elimina un gruppo
router.delete('/gruppi/:id', ...richiedeGestioneSicurezza, gruppoController.elimina)

module.exports= router
