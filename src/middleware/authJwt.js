const jwt = require('jsonwebtoken');

const verificaToken = (req, res, next) => {
  // 1. Estraiamo l'header Authorization (Bearer Token)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // 2. Se non c'è il token, neghiamo l'accesso
  if (!token) {
    return res.status(401).json({ messaggio: 'Accesso negato. Token mancante.' });
  }

  try {
    // 3. Verifichiamo il token usando la chiave segreta
    const CHIAVE_SEGRETA = process.env.JWT_SECRET || 'chiave_di_emergenza_orvent';
    
    // 4. Decodifichiamo il payload e lo assegniamo a req.utente
    const payloadDecodificato = jwt.verify(token, CHIAVE_SEGRETA);
    
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