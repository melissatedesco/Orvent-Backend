const { Utente, Ruolo, Permesso, Gruppo} = require('../models')

// carica l'insieme dei permessi effettivi di un utente: diretti + da ruoli + ereditati dai gruppi
// esportata a parte cosi' i controller possono decidere autorizzazioni piu' fini (es. visibilita' prezzi)
// senza dover ripetere questa query
const ottieniPermessiUtente = async (idUtente) => {
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

    if (!utenteDb) return null

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

    // Raccogliamo i permessi ereditati dai gruppi a cui l'utente appartiene
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

    return permessiUtente
}

// middleware di controllo accessi
const hasPermission = (permessoRichiesto) => {
    return async (req, res, next) => {
        try{
            // recuperiamo l'id dell'utente dal jwt
            const idUtente = req.utente?.id || req.utente?.id_utente

            if (!idUtente) {
                return res.status(401).json({
                    message: 'Accesso negato. ID utente non presente nel token'
                })
            }

            const permessiUtente = await ottieniPermessiUtente(idUtente)

            if (!permessiUtente) {
                return res.status(404).json({
                    message: 'Utente non trovato nel sistema.'
                });
            }

            // Verifica finale: l'utente ha il permesso richiesto?
            if (permessiUtente.has(permessoRichiesto)) {
                return next(); // Via libera! Procedi al controller (es. prodottoController.crea)
            }

            // Se arriviamo qui, il token è valido ma l'utente non ha i privilegi necessari
            return res.status(403).json({
                message: 'Accesso negato. Non disponi dei privilegi necessari per questa operazione.'
            });

        } catch (errore) {
            console.error('Errore durante la verifica dei permessi:', errore);
            return res.status(500).json({
                message: 'Errore interno del server durante il controllo di sicurezza.'
            });
        }
    };
};

module.exports = hasPermission;
module.exports.ottieniPermessiUtente = ottieniPermessiUtente;
