const path = require('path')

// carica le variabili del database di test PRIMA che qualsiasi altro modulo
// (es. src/config/db.js) legga process.env, cosi' l'app punta sempre a orvent_test
require('dotenv').config({ path: path.resolve(__dirname, '.env.test'), override: true })

module.exports = {
    testEnvironment: 'node',
    globalSetup: '<rootDir>/tests/setup/globalSetup.js',
    setupFilesAfterEnv: ['<rootDir>/tests/setup/setupFilesAfterEnv.js'],
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true
}
