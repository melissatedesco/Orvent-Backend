const { Utente, Ruolo, Permesso, Gruppo} = require('../models')

// middleware di controllo accessi

const hasPermission = (permessoRichiesto) => {
    return async (req, res, next) => {
        try{
            // recuperiamo l'id dell'utente dal jwt
            const idUtente = req.utente?.id || req.utente?.id_utente

            console.log(' [DEBUG] ID utente estratto dal token:', idUtente);
       
            if (!idUtente) {
                return res.status(401).json({
                    message: 'Accesso negato. ID utente non presente nel token'
                })
            }
            
            // interroghiamo il db estaendo in un unica query
            // i ruoli assegnati direttamenti all'utente con i relativi permessi
            const utenteDb = await Utente.findByPk(idUtente, {
                include: [
                    {
                      model: Permesso,
                      as: 'permessi_diretti',
                      attributes: ['name']
                    },

                    {
                        model: Ruolo,
                        as: 'ruoli_diretti',
                        include: [{ model: Permesso, as: 'permessi'}]
                    },

                    // i gruppi di cui fa parte l'utente con i relativi ruoli e permessi
                    {
                        model: Gruppo,
                        as: 'gruppi',
                        include: [
                            {
                                model: Ruolo,
                                as: 'ruoli_gruppo',
                                include: [{ model: Permesso, as: 'permessi'}]
                            }
                        ]    
                    }
                ]
            });

            // Se l'ID del token non trova una corrispondenza reale nel database
        if (!utenteDb) {
        console.log(`[DEBUG] Nessun utente trovato nel DB con ID: ${idUtente} `);
        return res.status(404).json({ 
        message: 'Utente non trovato nel sistema.' 
        });
      }

      // Utilizziamo un Set per collezionare tutti i permessi unici dell'utente ed evitare duplicati
      const permessiUtente = new Set();

      // raccogliamo i permessi assegnati direttamente all'utente
      if(utenteDb.permessi_diretti) {
        utenteDb.permessi_diretti.forEach(permesso => {
          permessiUtente.add(permesso.name)
        })
      }

      // Raccogliamo i permessi dai ruoli diretti dell'utente
      if (utenteDb.ruoli_diretti) {
        utenteDb.ruoli_diretti.forEach(ruolo => {
          if (ruolo.permessi) {
            ruolo.permessi.forEach(permesso => {
              permessiUtente.add(permesso.name);
            });
          }
        });
      }

      // 2. Raccogliamo i permessi ereditati dai gruppi a cui l'utente appartiene
      if (utenteDb.gruppi) {
        utenteDb.gruppi.forEach(gruppo => {
          if (gruppo.ruoli_gruppo) {
            gruppo.ruoli_gruppo.forEach(ruolo => {
              if (ruolo.permessi) {
                ruolo.permessi.forEach(permesso => {
                  permessiUtente.add(permesso.name);
                });
              }
            });
          }
        });
      }

      const listaPermessi = Array.from(permessiUtente)
      console.log(' DEBUG - Permessi totali dell\'utente:', listaPermessi);
      console.log(' DEBUG - Permesso richiesto dalla rotta:', permessoRichiesto);

      // 3. Verifica finale: l'utente ha il permesso richiesto?
      if (permessiUtente.has(permessoRichiesto)) {
        console.log(' DEBUG - Permesso accordato!');
        return next(); // Via libera! Procedi al controller (es. prodottoController.crea)
      }

      // Se arriviamo qui, il token è valido ma l'utente non ha i privilegi necessari
      console.log(' DEBUG - Permesso negato');
      return res.status(403).json({ 
        message: 'Accesso negato. Non disponi dei privilegi necessari per questa operazione.' 
      });

    } catch (errore) {
      console.error('❌ Errore durante la verifica dei permessi:', errore);
      return res.status(500).json({ 
        message: 'Errore interno del server durante il controllo di sicurezza.' 
      });
    }
  };
};

module.exports = hasPermission;