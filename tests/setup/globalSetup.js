const mysql = require('mysql2/promise')

// crea il database di test se non esiste ancora, cosi' non serve nessun passaggio manuale
module.exports = async () => {
    const connessione = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT
    })

    await connessione.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``)
    await connessione.end()

    // lo schema viene creato una sola volta per l'intera run: i singoli test puliranno
    // solo i dati (TRUNCATE) tra un test e l'altro, senza ricreare tabelle e indici ogni volta
    const { sequelize } = require('../../src/models')
    await sequelize.sync({ force: true })
    await sequelize.close()
}
