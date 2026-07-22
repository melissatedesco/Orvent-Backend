const {Sequelize} = require('sequelize')
require('dotenv').config()

// configurazione dell'istanza di connessione

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
host: process.env.DB_HOST,
port: process.env.DB_PORT,
dialect: 'mysql',
logging: false,

// configurazione delpool di connessioni per gestire le richieste simultanee
pool: {
    // numero massimo di connessioni simultanee aperte
    max: 5,
    // numero minimo di connessioni aperte
    min:0, 
    // tempo massimo in millisecondi, di attesa prima di dare errore di timeout
    acquire: 30000,
    // tempo massimo dopo il quale una connessione inattiva viene chiusa
    idle: 10000
}
})

module.exports = sequelize