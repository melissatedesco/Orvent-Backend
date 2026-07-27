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

    // dati fiscali/anagrafici: necessari per congelare un destinatario fattura valido
    // (senza indirizzo e un identificativo fiscale il PDF generato non è un documento
    // fiscale completo). Nullable perché un cliente può registrarsi e ordinare prima di
    // completare il profilo; la generazione fattura valida la loro presenza a parte.
    // partita_iva per i clienti aziendali (B2B), codice_fiscale per i privati (B2C):
    // ne serve almeno uno, non necessariamente entrambi.
    partita_iva: {
        type: DataTypes.STRING,
        allowNull: true
    },

    codice_fiscale: {
        type: DataTypes.STRING,
        allowNull: true
    },

    indirizzo: {
        type: DataTypes.STRING,
        allowNull: true
    },

    cap: {
        type: DataTypes.STRING,
        allowNull: true
    },

    citta: {
        type: DataTypes.STRING,
        allowNull: true
    },

    provincia: {
        type: DataTypes.STRING,
        allowNull: true
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
    tableName: 'utenti',
    underscored:true
})

module.exports = Utente