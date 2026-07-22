const { sequelize } = require('../../src/models')

// isolamento totale tra un test e l'altro: azzeriamo solo i dati (TRUNCATE), lo schema
// e' gia' pronto (creato una sola volta in globalSetup) - molto piu' leggero di un
// DROP+CREATE completo ripetuto ad ogni singolo test.
// SET FOREIGN_KEY_CHECKS e' una variabile di sessione: va eseguita sulla STESSA
// connessione dei TRUNCATE, per questo tutto avviene dentro un'unica transazione
// (che sequelize.query pinna a una singola connessione del pool).
beforeEach(async () => {
    const nomiTabelle = Object.values(sequelize.models).map(modello => modello.getTableName())

    await sequelize.transaction(async (t) => {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t })
        for (const nome of nomiTabelle) {
            await sequelize.query(`TRUNCATE TABLE \`${nome}\``, { transaction: t })
        }
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t })
    })
})

afterAll(async () => {
    await sequelize.close()
})
