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

class RigaOrdine extends Model {
  // Metodo personalizzato per calcolare il totale parziale di questa riga
  getTotaleRiga() {
    return parseFloat(this.quantita) * parseFloat(this.prezzo_congelato);
  }
}

// =========================================================================
// 3. INIZIALIZZAZIONE DEI CAMPI (Le colonne della tabella MySQL)
// =========================================================================

RigaOrdine.init({
  // Nota: Gli ID di collegamento (ordine_id, prodotto_id) verranno inseriti 
  // automaticamente da Sequelize tramite le associazioni nel file index.js

  quantita: {
    type: DataTypes.DECIMAL(10, 3), // Supporta fino a 3 decimali per pesi o misure (es. 1.550 kg)
    allowNull: false,
    validate: {
      min: {
        args: [0.001],
        msg: "La quantità deve essere maggiore di zero."
      }
    }
  },

  prezzo_congelato: {
    type: DataTypes.DECIMAL(10, 2), // Mappa un DECIMAL(10,2) su MySQL per i valori monetari
    allowNull: false,
    // REQUISITO NON FUNZIONALE: Memorizza il prezzo del prodotto nell'esatto momento 
    // in cui l'ordine viene inviato. Non verrà mai ricalcolato sul prezzo corrente del catalogo.
    validate: {
      min: {
        args: [0.00],
        msg: "Il prezzo congelato non può essere negativo."
      }
    }
  },

  unita_misura_congelata: {
    type: DataTypes.STRING,
    allowNull: false
    // REQUISITO DI DOMINIO: Salva l'unità di misura (es. PEZZO, KG, METRO) al momento dell'ordine.
    // Se l'azienda cambia l'unità nel catalogo in futuro, l'ordine storico resta integro.
  }
}, {
  // =========================================================================
  // 4. OPZIONI DI CONFIGURAZIONE DEL MODELLO
  // =========================================================================
  
  sequelize,                // Istanza di connessione al database
  modelName: 'RigaOrdine',  // Nome identificativo del modello per Sequelize
  tableName: 'righe_ordine',// Nome effettivo della tabella nel database MySQL
  underscored: true         // Mappa i campi in snake_case nel database (es. prezzo_congelato)
});

// =========================================================================
// 5. ESPORTAZIONE DEL MODELLO
// =========================================================================

module.exports = RigaOrdine;