const jwt = require('jsonwebtoken');
const { Utente } = require('../models');

const verificaToken = async (req, res, next) => {
  // 1. Estraiamo l'header Authorization (Bearer Token)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // 2. Se non c'è il token, neghiamo l'accesso
  if (!token) {
    return res.status(401).json({ messaggio: 'Accesso negato. Token mancante.' });
  }

  try {
    // 3. Verifichiamo il token usando la chiave segreta. Nessun fallback: server.js
    // non fa partire il processo se JWT_SECRET manca, quindi qui e' sempre presente
    const payloadDecodificato = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Un JWT resta valido fino alla scadenza (8h) anche se l'account viene
    // disattivato nel frattempo: senza questo controllo, un utente disattivato
    // continuerebbe ad accedere a tutto per il tempo restante del token. Il costo
    // e' una query in piu' per richiesta, accettato deliberatamente per chiudere
    // quella finestra: la revoca deve essere immediata, non solo al prossimo login
    const utente = await Utente.findByPk(payloadDecodificato.id, { attributes: ['id', 'attivo'] });
    if (!utente || !utente.attivo) {
      return res.status(401).json({ messaggio: 'Accesso negato. Utente non trovato o disattivato.' });
    }

    // 🟢 IL PUNTO CRITICO: Assegniamo a req.utente (non req.user!)
    req.utente = payloadDecodificato;

    // 5. Passiamo il controllo al prossimo middleware (hasPermission)
    next();

  } catch (errore) {
    console.error('Errore durante la verifica del token JWT:', errore);
    return res.status(403).json({ messaggio: 'Token non valido o scaduto.' });
  }
};

module.exports = { verificaToken };