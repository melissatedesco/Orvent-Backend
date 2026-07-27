const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Utente } = require('../models')
const { ottieniPermessiUtente } = require('../middleware/hasPermission')

// inizializziamo dotenv per leggere il .env
require('dotenv').config()
// nessun fallback: server.js non fa partire il processo se JWT_SECRET manca
const CHIAVE_SEGRETA = process.env.JWT_SECRET;

// definizione del controller
const authController = {

    login: async (req, res) => {

        try {
            const { email, password} = req.body;
    
           if (!email || !password) {
            return res.status(400).json({ messaggio: 'Inserisci sia l\'email che la password.' });
          }
    
          const utenteTrovato = await Utente.findOne({ where: { email: email } });
    
          if (!utenteTrovato) {
            return res.status(404).json({ messaggio: 'Utente non trovato. Verifica la tua email.' });
          }
    
          if (!utenteTrovato.attivo) {
            return res.status(403).json({ messaggio: 'Questo account è stato disattivato.' });
          }
    
          const passwordCorretta = await bcrypt.compare(password, utenteTrovato.password_hash);
    
          if (!passwordCorretta) {
            return res.status(401).json({ messaggio: 'Password errata.' });
          }
    
          const payloadToken = {
            id: utenteTrovato.id,
            email: utenteTrovato.email
          };

          // Generiamo il token firmandolo con la chiave segreta del file .env
          const tokenGenerato = jwt.sign(payloadToken, CHIAVE_SEGRETA, { expiresIn: '8h' });

          // recuperiamo permessi (diretti + da ruoli + da gruppi) e ruoli diretti per il frontend (RBAC)
          const permessiUtente = await ottieniPermessiUtente(utenteTrovato.id)
          const ruoliUtente = await utenteTrovato.getRuoli_diretti({ attributes: ['name'] })

          return res.status(200).json({
            messaggio: 'Login effettuato con successo!',
            token: tokenGenerato,
            utente: {
              id: utenteTrovato.id,
              nome: utenteTrovato.nome,
              cognome: utenteTrovato.cognome,
              email: utenteTrovato.email,
              permessi: Array.from(permessiUtente),
              ruoli: ruoliUtente.map(ruolo => ruolo.name)
            }
          });
    
        } catch (errore) {
          console.error('Errore durante il login:', errore);
          return res.status(500).json({ messaggio: 'Errore interno del server durante il login.' });
        }
    }
}

module.exports = authController