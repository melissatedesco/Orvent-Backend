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

class Fattura extends Model {
  // Classe pronta per ospitare metodi relativi alla fattura se necessario
}

// =========================================================================
// 3. INIZIALIZZAZIONE DEI CAMPI (Le colonne della tabella MySQL)
// =========================================================================

Fattura.init({
  // Nota: L'ID di collegamento con l'ordine (ordine_id) verrà aggiunto 
  // automaticamente da Sequelize tramite le associazioni nel file index.js

  numero_fattura: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true, // REQUISITO NON FUNZIONALE: Garantisce l'univocità del numero fiscale
    validate: {
      min: {
        args: [1],
        msg: "Il numero di fattura deve essere maggiore di zero."
      }
    }
  },

  importo_imponibile: {
    type: DataTypes.DECIMAL(10, 2), // Valore dei prodotti al netto dell'IVA
    allowNull: false,
    validate: {
      min: {
        args: [0.00],
        msg: "L'importo imponibile non può essere negativo."
      }
    }
  },

  importo_iva: {
    type: DataTypes.DECIMAL(10, 2), // Valore dell'imposta calcolata automaticamente
    allowNull: false,
    validate: {
      min: {
        args: [0.00],
        msg: "L'importo IVA non può essere negativo."
      }
    }
  },

  importo_totale: {
    type: DataTypes.DECIMAL(10, 2), // Imponibile + IVA (deve corrispondere al totale dell'ordine)
    allowNull: false,
    validate: {
      min: {
        args: [0.00],
        msg: "L'importo totale non può essere negativo."
      }
    }
  },

  percorso_pdf: {
    type: DataTypes.STRING,
    allowNull: false
    // Memorizza il percorso del file sul server o sul cloud (es. /output/fatture/fattura_1.pdf)
  }
}, {
  // =========================================================================
  // 4. OPZIONI DI CONFIGURAZIONE DEL MODELLO
  // =========================================================================
  
  sequelize,            // Istanza di connessione al database
  modelName: 'Fattura', // Nome identificativo del modello per Sequelize
  tableName: 'fatture', // Nome effettivo della tabella nel database MySQL
  underscored: true     // Mappa i campi in snake_case nel database (es. numero_fattura)
});

// =========================================================================
// 5. ESPORTAZIONE DEL MODELLO
// =========================================================================

module.exports = Fattura;