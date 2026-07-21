const {Model, DataTypes} = require('sequelize')
const sequelize = require('../config/db')

class Prodotto extends Model {
    // metodo per verificare la disponibilità di magazzino
    haScortaSufficiente(quantitaRichiesta) {
        return parseFloat(this.scorta) >= parseFloat(quantitaRichiesta)
    }
}

Prodotto.init({
  
    // Stock Keeping Unit (in italiano traducibile come "Unità di Stoccaggio della Scorta")
    sku: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Codice identificativo univoco (es. PROD-123-XYZ)
    validate: {
      notEmpty: { msg: "Il codice SKU è obbligatorio." }
    }
  },

  nome: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Il nome del prodotto è obbligatorio." }
    }
  },

  descrizione: {
    type: DataTypes.TEXT, // Usiamo TEXT anziché STRING per permettere testi lunghi
    allowNull: true
  },

  prezzo: {
    type: DataTypes.DECIMAL(10, 2), // Mappa un DECIMAL(10,2) su MySQL per i valori monetari
    allowNull: false,
    validate: {
      min: {
        args: [0.00],
        msg: "Il prezzo non può essere negativo."
      }
    }
  },

  scorta: {
    type: DataTypes.DECIMAL(10, 3), // Supporta fino a 3 decimali per pesi/misure (es. 15.500 kg di merce)
    allowNull: false,
    defaultValue: 0.000,
    validate: {
      min: {
        args: [0.000],
        msg: "La scorta di magazzino non può scendere sotto lo zero."
      }
    }
  },

  tipo_unita: {
    type: DataTypes.STRING, // Definisce l'unità di misura (es. PEZZO, KG, METRO)
    allowNull: false,
    validate: {
      notEmpty: { msg: "L'unità di misura è obbligatoria." }
    }
  },

  attivo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
    // REQUISITO NON FUNZIONALE: Se un prodotto viene eliminato dall'admin, passa a false.
    // Non facciamo una DELETE fisica per non rompere l'integrità referenziale degli ordini passati.
  }
}, {
  // =========================================================================
  // 4. OPZIONI DI CONFIGURAZIONE DEL MODELLO
  // =========================================================================
  
  sequelize,            // Istanza di connessione al database
  modelName: 'Prodotto',// Nome identificativo del modello per Sequelize
  tableName: 'prodotti',// Nome effettivo della tabella nel database MySQL
  underscored: true     // Mappa i campi in snake_case nel database (es. tipo_unita, creato_il)
});

// =========================================================================
// 5. ESPORTAZIONE DEL MODELLO
// =========================================================================

module.exports = Prodotto;