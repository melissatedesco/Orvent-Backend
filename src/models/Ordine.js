// =========================================================================
// 1. IMPORT DEGLI STRUMENTI NECESSARI
// =========================================================================

// Importiamo 'Model' e 'DataTypes' dalla libreria Sequelize
const { Model, DataTypes } = require('sequelize');

// Importiamo la configurazione del database dal nostro file di connessione
const sequelize = require('../config/db');

// =========================================================================
// 2. DEFINIZIONE DELLA CLASSE
// =========================================================================

class Ordine extends Model {
  // Classe pronta per ospitare eventuali metodi d'istanza futuri
}

// =========================================================================
// 3. INIZIALIZZAZIONE DEI CAMPI (Le colonne della tabella MySQL)
// =========================================================================

Ordine.init({
  // Nota: L'ID del cliente (cliente_id) verrà aggiunto automaticamente 
  // da Sequelize tramite le associazioni nel file index.js

  stato: {
    type: DataTypes.ENUM('NUOVO', 'IN_EVASIONE', 'EVASO', 'FATTURATO'),
    allowNull: false,
    defaultValue: 'NUOVO'
    // REQUISITO DI DOMINIO: Definisce il ciclo di vita dell'ordine.
    // Avanza secondo il flusso stabilito dai servizi di business.
  },

  totale_importo: {
    type: DataTypes.DECIMAL(10, 2), // Mappa un DECIMAL(10,2) su MySQL per i valori monetari
    allowNull: false,
    defaultValue: 0.00,
    // REQUISITO NON FUNZIONALE: Somma dei prezzi congelati delle righe d'ordine.
    validate: {
      min: {
        args: [0.00],
        msg: "Il totale dell'importo non può essere negativo."
      }
    }
  }
}, {
  // =========================================================================
  // 4. OPZIONI DI CONFIGURAZIONE DEL MODELLO
  // =========================================================================
  
  sequelize,            // Istanza di connessione al database
  modelName: 'Ordine',  // Nome identificativo del modello per Sequelize
  tableName: 'ordini',  // Nome effettivo della tabella nel database MySQL
  underscored: true     // Mappa i campi in snake_case nel database (es. totale_importo, creato_il)
});

// =========================================================================
// 5. ESPORTAZIONE DEL MODELLO
// =========================================================================

module.exports = Ordine;