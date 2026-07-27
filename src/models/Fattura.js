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
    allowNull: true
    // Memorizza il percorso del file sul server o sul cloud (es. /output/fatture/fattura_1.pdf).
    // NULL = PDF non ancora generato: il numero e gli importi sono gia' committati (la
    // generazione del PDF avviene DOPO, fuori dalla transazione), un fallimento qui non
    // deve mai bruciare il numero ne' bloccare l'ordine in uno stato inconsistente. Un
    // tentativo successivo su un ordine gia' FATTURATO con percorso_pdf nullo completa
    // la generazione riusando la stessa fattura, senza crearne una nuova.
  },

  // dati cliente CONGELATI al momento della generazione: una fattura e' un documento
  // fiscale chiuso, il suo contenuto non deve cambiare se il cliente aggiorna il profilo
  cliente_ragione_sociale: {
    type: DataTypes.STRING,
    allowNull: false
  },

  cliente_partita_iva: {
    type: DataTypes.STRING,
    allowNull: true // clienti B2C: valorizzato invece cliente_codice_fiscale
  },

  cliente_codice_fiscale: {
    type: DataTypes.STRING,
    allowNull: true // clienti B2B: valorizzato invece cliente_partita_iva
  },

  cliente_indirizzo: {
    type: DataTypes.STRING,
    allowNull: false
    // REQUISITO DI DOMINIO: sempre obbligatorio, a differenza di partita_iva/codice_fiscale
    // (di cui basta uno dei due). Una fattura senza indirizzo del destinatario non e' un
    // documento fiscale valido: generaFattura lo valida prima di creare la riga.
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