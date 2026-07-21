const sequelize= require('../config/db')
const Utente = require('./Utente');
const Ruolo = require('./Ruolo');
const Permesso= require('./Permesso');
const Gruppo= require('./Gruppo')
const Prodotto = require('./Prodotto')
const RigaOrdine = require('./RigaOrdine')
const Fattura = require('./Fattura')
const Ordine = require('./Ordine')

// configurazione delle relazioni

// area sicurezza (RBAC)

// utente => ruoli (molti-a-molti: ruoli assegnati direttamente all'utente)
Utente.belongsToMany(Ruolo, {
    through: 'utente_ruolo', foreignKey: 'utente_id', otherKey:'ruolo_id', as: 'ruoli_diretti'
})
Ruolo.belongsToMany(Utente, {
    through: 'utente_ruolo', foreignKey:'ruolo_id', otherKey: 'utente_id'
})

// utente => gruppi (molti a molti: un utente può far parte di più gruppi)
Utente.belongsToMany(Gruppo, {
    through: 'utente_gruppo', foreignKey:'utente_id', otherKey:'gruppo_id', as:'gruppi'
})
Gruppo.belongsToMany(Utente, {
    through: 'utente_gruppo', foreignKey: 'gruppo_id', otherKey: 'utente_id'
})

// utente => permessi (uno a molti)
Utente.belongsToMany(Permesso, {
    through:'utente_permesso',
    foreignKey: 'utente_id',
    otherKey: 'permesso_id',
    as:'permessi_diretti'
})
Permesso.belongsToMany(Utente, {
    through: 'utente_permesso',
    foreignKey: 'permesso_id',
    otherKey: 'utente_id'
})

// gruppo => ruoli (molti a molti: i ruoli che il gruppo trasmette agli utenti menbri)
Gruppo.belongsToMany(Ruolo, {
    through: 'gruppo_ruolo', foreignKey:'gruppo_id', otherKey: 'ruolo_id', as: 'ruoli_gruppo'
})
Ruolo.belongsToMany(Gruppo, { 
    through: 'gruppo_ruolo', foreignKey: 'ruolo_id', otherKey: 'gruppo_id' 
})

// Ruolo <-> Permessi (Molti-a-Molti: Quali azioni granulari può fare un ruolo)
Ruolo.belongsToMany(Permesso, { 
    through: 'ruolo_permesso', foreignKey: 'ruolo_id', otherKey: 'permesso_id', as: 'permessi' 
})
Permesso.belongsToMany(Ruolo, { 
    through: 'ruolo_permesso', foreignKey: 'permesso_id', otherKey: 'ruolo_id' 
})

// user => ordini (uno a molti: un user può fare più ordini)
Utente.hasMany(Ordine, {
    foreignKey: 'user_id', as:'ordini'
})
Ordine.belongsTo(Utente, {
    foreignKey: 'user_id', as: 'user'
})

// ordine => righe ordine (uno a molti: un ordine contiene più prodotti/righe)
Ordine.hasMany(RigaOrdine, {
    foreignKey:'ordine_id', as:'righe'
})
RigaOrdine.belongsTo(Ordine, {
    foreignKey: 'ordine_id', as: 'ordine'
})

// prodotto => righe (uno a molti: un prodotto può essere in più righe di ordini diversi)
Prodotto.hasMany(RigaOrdine, 
    { foreignKey: 'prodotto_id', as: 'righe_ordine' 
    })
RigaOrdine.belongsTo(Prodotto, { 
    foreignKey: 'prodotto_id', as: 'prodotto' })

// Ordine <-> Fattura (Uno-a-Uno: Un ordine evaso genera esattamente una fattura)
Ordine.hasOne(Fattura, { 
    foreignKey: 'ordine_id', as: 'fattura' });
Fattura.belongsTo(Ordine, { 
    foreignKey: 'ordine_id', as: 'ordine' });



module.exports = {
    sequelize,
    Utente,
    Ruolo,
    Permesso, 
    Gruppo,
    Prodotto,
    Ordine,
    RigaOrdine,
    Fattura
}
