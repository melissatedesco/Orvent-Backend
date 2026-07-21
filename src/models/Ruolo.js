const {Model, DataTypes} = require('sequelize');
const sequelize = require('../config/db')

class Ruolo extends Model {
    // classe vuota che eredita i metodi da sequelize. 
}

Ruolo.init({
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Impedisce la creazione di ruoli duplicati (es. due 'ADMIN')
    validate: {
      notEmpty: { msg: "Il nome del ruolo non può essere vuoto." }
    }
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true // La descrizione è facoltativa, serve come promemoria interno
  }
}, {
  // =========================================================================
  // 4. OPZIONI DI CONFIGURAZIONE
  // =========================================================================
  sequelize,
  modelName: 'Ruolo',
  tableName: 'ruoli', // Nome esplicito al plurale in italiano sul DB MySQL
  underscored: true   // Mappa automaticamente i timestamp in created_at e updated_at
});

module.exports = Ruolo;