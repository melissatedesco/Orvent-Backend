const {Model, DataTypes} = require('sequelize');
const sequelize = require('../config/db');

class Utente extends Model {

    // metodo custom dell'istanza: unisce nome e cogngnome
    // potrai usarlo ovunque nel backend scrivendo semplicemente: utente.getFullName()
    getNomeCompleto() {
        return `${this.nome} ${this.cognome}`;
    }
}

// inizializzazione dei campi (colonne della tabella mysql)

Utente.init({
    // id auto-increment 

    email: {
        type :DataTypes.STRING,
        // il campo non può essere NOT NULL
        allowNull: false, 
        unique: true,
        validate: {
            isEmail: {
                msg: "Inserisci un email valido"
            }
        }
    },

    password_hash: {
        type: DataTypes.STRING,
        allowNull: false
    },

    nome: {
        type: DataTypes.STRING,
        allowNull: false
    },

    cognome: {
        type: DataTypes.STRING,
        allowNull: false
    },

    attivo: {
        type:DataTypes.BOOLEAN,
        allowNull: false,
        // se un utente viene eliminato, questo campo passa a false.
        // nessuna riga viene cancellata per preservare lo storico fiscale e degli ordini
        defaultValue:true
    }

}, {
    // opzioni di configurazione del modello
// istanza di connessione al database
    sequelize,
    modelName: 'Utente',
    underscored:true
})

module.exports = Utente