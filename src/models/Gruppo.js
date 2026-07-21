// =========================================================================
// 1. IMPORT DEGLI STRUMENTI
// =========================================================================
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// =========================================================================
// 2. DEFINIZIONE DELLA CLASSE
// =========================================================================
class Gruppo extends Model {}

// =========================================================================
// 3. INIZIALIZZAZIONE DEI CAMPI (Colonne della tabella 'gruppi')
// =========================================================================
Gruppo.init({
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Evita gruppi con lo stesso nome
    validate: {
      notEmpty: { msg: "Il nome del gruppo non può essere vuoto." }
    }
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  // =========================================================================
  // 4. OPZIONI DI CONFIGURAZIONE
  // =========================================================================
  sequelize,
  modelName: 'Gruppo',
  tableName: 'gruppi',
  underscored: true
});

module.exports = Gruppo;