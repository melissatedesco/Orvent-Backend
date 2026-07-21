// =========================================================================
// 1. IMPORT DEGLI STRUMENTI
// =========================================================================
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// =========================================================================
// 2. DEFINIZIONE DELLA CLASSE
// =========================================================================
class Permesso extends Model {}

// =========================================================================
// 3. INIZIALIZZAZIONE DEI CAMPI (Colonne della tabella 'permessi')
// =========================================================================
Permesso.init({
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Ogni permesso deve essere univoco (es. 'catalog:write')
    validate: {
      notEmpty: { msg: "Il nome del permesso non può essere vuoto." }
    }
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true // Spiega cosa permette di fare questa specifica stringa
  }
}, {
  // =========================================================================
  // 4. OPZIONI DI CONFIGURAZIONE
  // =========================================================================
  sequelize,
  modelName: 'Permesso',
  tableName: 'permessi',
  underscored: true
});

module.exports = Permesso;