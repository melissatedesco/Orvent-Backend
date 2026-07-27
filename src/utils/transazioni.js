// L'ordinamento dei lock (per id crescente, vedi ordineService.js) elimina i cicli di
// attesa sulla risorsa che si ordina, ma MySQL puo' comunque segnalare un deadlock per
// altre vie (es. next-key/gap lock su un indice secondario coinvolto in un JOIN FOR
// UPDATE, che confligge con un INSERT concorrente su una tabella diversa). Un deadlock
// aborta sempre l'intera transazione: non c'e' nulla da "riparare" a meta', solo da
// rieseguire da capo. MySQL stessa raccomanda questo approccio.
//
// IMPORTANTE: "operazione" deve contenere SOLO la transazione, nessun effetto esterno
// (generazione PDF, invio email, scrittura su filesystem...). Un retry la rieseguirebbe
// per intero: qualunque effetto collaterale al suo interno verrebbe ripetuto ad ogni
// tentativo. Un effetto esterno da eseguire una sola volta va sempre messo FUORI da
// questo wrapper, dopo che la promise restituita si e' risolta con successo.
//
// "contesto" e' solo per il log: un deadlock ogni tanto e' fisiologico con transazioni
// concorrenti, uno frequente sullo stesso percorso e' il sintomo di un problema di
// design (troppe righe per transazione, lock tenuti troppo a lungo...) che altrimenti
// il retry maschererebbe silenziosamente.
const eseguiConRetrySuDeadlock = async (operazione, { contesto, tentativiMax = 3 } = {}) => {
    for (let tentativo = 1; tentativo <= tentativiMax; tentativo += 1) {
        try {
            return await operazione()
        } catch (errore) {
            const isDeadlock = errore?.original?.code === 'ER_LOCK_DEADLOCK' || errore?.parent?.code === 'ER_LOCK_DEADLOCK'
            if (!isDeadlock || tentativo === tentativiMax) throw errore
            console.warn(`Deadlock rilevato (tentativo ${tentativo}/${tentativiMax}) su ${contesto}, ripeto la transazione`)
        }
    }
}

module.exports = { eseguiConRetrySuDeadlock }
