const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')

// definizione della rotta di login
router.post('/login', authController.login)

module.exports = router