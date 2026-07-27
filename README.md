# Orvent-Backend

REST API for a catalog, order, warehouse, and invoicing management system. A customer browses the catalog and places orders; a warehouse operator fulfills them, decrementing stock; accounting generates invoices (PDF, sequential numbering, VAT); an admin has full oversight and control, including RBAC (users, roles, permissions, groups).

## Stack

- Node.js + Express
- Sequelize on MySQL
- JWT authentication (`jsonwebtoken`) + permission-based authorization middleware
- `pdfkit` for invoice generation
- Jest + Supertest for testing, against a dedicated MySQL database

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the variables (your local MySQL credentials, a `JWT_SECRET` of your choice — `server.js` refuses to start without one; there is no hardcoded fallback):
   ```
   PORT=3000
   NODE_ENV=development

   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=...
   DB_NAME=orvent_db
   DB_PORT=3306

   JWT_SECRET=...
   JWT_EXPIRES_IN=8h
   ```
3. Create the database named in `DB_NAME` on MySQL (Sequelize does not create it for you):
   ```sql
   CREATE DATABASE orvent_db;
   ```
4. Run the seed script: creates/aligns the tables, system permissions, standard roles, and an admin user.
   ```
   node src/seed/inizializzatore.js
   ```
   Default admin account: `admin@orvent.it` / `Admin123!` (change the password after first login).
5. Start the server:
   ```
   npm run dev    # with nodemon, for development
   npm start      # plain start
   ```

`src/app.js` only exports the Express app (no `listen()`); `src/server.js` is the actual entry point (DB sync + startup) — this split lets Supertest mount the app in tests without opening a port.

## RBAC: user → (group) → role → permission

A user can have roles assigned directly and/or inherited from the groups they belong to; each role groups together several atomic permissions; a user's effective permissions are the union of all of these. Every protected endpoint requires a specific permission (`hasPermission('permission:name')`).

Roles created by the seed:

| Role | Permissions | Purpose |
|---|---|---|
| `AMMINISTRATORE` | all | full management (catalog, users, roles, permissions, groups, orders, invoices) |
| `CLIENTE` | `ordini:creare` | assigned by default to anyone who registers via `/api/utenti/registrati` |
| `OPERATORE_MAGAZZINO` | `ordini:evadere` | order listing/fulfillment, no access to prices or invoices |
| `CONTABILITA` | `fatture:gestione` | invoice generation and lookup, no access to the warehouse |

New users with a specific role (e.g. a second admin, an operator) are created via `POST /api/utenti` (requires `utenti:gestione`), which also accepts a `gruppi` array.

**Verified, not just designed this way**: every route in every route file is gated by `hasPermission('permission:name')`, never by a check on the role's name — confirmed by grepping the entire `src/` tree for `ruolo.name ===`, `hasRole`, and hardcoded role names in authorization logic: zero matches. This is the negative proof that usually goes undocumented: it says there's no shortcut anywhere that checks "is this user an admin" instead of "does this user have the permission this specific action requires" — which is what makes the group→role→permission chain above actually load-bearing, rather than a diagram that the code quietly bypasses in a few places.

A JWT is a bearer credential with no server-side revocation by default, which creates a real gap: `verificaToken` re-reads `utente.attivo` from the database on every single authenticated request (not just at login) specifically to close it — deactivating an account takes effect on the *next* request, not up to 8 hours later when the token would otherwise expire on its own. This is a deliberate trade-off (one extra lookup per request, in exchange for immediate revocation) rather than a default; if that cost ever mattered under real load, the middle ground is a short-lived (30–60s) cache of the active/inactive flag rather than reverting to trusting the token alone.

## Endpoint overview

All protected routes require the `Authorization: Bearer <token>` header obtained from `POST /api/auth/login`.

**Auth** — `/api/auth`
- `POST /login`

**Users** — `/api/utenti`
- `POST /registrati` — public registration (default role `CLIENTE`)
- `GET /profilo`, `PUT /profilo` — the authenticated user's own profile
- `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` — user administration (requires `utenti:gestione`; `DELETE` is a soft delete, `attivo=false`)

**Products** — `/api/prodotti`
- `GET /`, `GET /:id` — catalog (authentication only)
- `POST /` (`prodotti:creare`), `PUT /:id` (`prodotti:modificare`), `DELETE /:id` (`prodotti:eliminare`, soft delete)

**Orders** — `/api/ordini`
- `POST /` (`ordini:creare`) — creates an order from the cart; freezes price and unit of measure, checks availability (does not decrement stock)
- `GET /` — the caller's own order history
- `GET /tutti?stato=` (`ordini:evadere`) — full list filterable by status; prices are hidden from anyone without `ordini:gestione`
- `GET /:id` — detail (owner or staff)
- `POST /:id/annulla` — a customer cancels their own order, only while still `NUOVO`
- `POST /:id/prendi-in-carico`, `POST /:id/evadi` (`ordini:evadere`) — the operator fulfills the order; stock is decremented only here, inside a transaction with a row lock

Statuses: `NUOVO → IN_EVASIONE → EVASO → FATTURATO`, plus `ANNULLATO` (terminal, reachable only from `NUOVO`).

**Invoices** — `/api/fatture` (all require `fatture:gestione`)
- `GET /coda` — `EVASO` orders awaiting invoicing
- `POST /genera` (`{ ordineId }`) — generates the invoice: fiscal-profile validation, sequential numbering (table lock), per-line taxable amount/VAT/total, then the PDF (see [Design decisions](#design-decisions-and-reasoning) below for why this is two separate steps and what happens if the second one fails)
- `GET /`, `GET /:id` — history, searchable by `numero`, `ordineId`, `cliente`, `dal`/`al`
- `GET /:id/pdf` — download the PDF

**Security (RBAC)** — `/api/sicurezza`
- `permessi`, `ruoli`, `gruppi` — CRUD (creation via `findOrCreate`, no duplicates)
- `POST`/`DELETE /ruoli/associa-permesso`, `/utenti/assegna-ruolo`, `/permessi/assegna-diretto`, `/gruppi/associa-ruolo`, `/utenti/assegna-gruppo` — grant/revoke RBAC associations

## Design decisions and reasoning

Each item below opens with the decision and the reason for it in one sentence, for anyone skimming; the rest of the entry is the path that led there — several of these were wrong on the first pass and only turned out correct after being measured against an actual concurrency test or a real MySQL error message, not just by inspection.

### Data freezing: an order/invoice is a snapshot, not a live view

An order line and an invoice each store their own copy of everything that matters — price, unit, code, description, VAT rate, customer identity and address — at the moment they're created, never a live join back to the current catalog or user profile, because a product or a customer's profile can change afterward and none of that should retroactively alter a document that already exists.

The failure mode this avoids is subtle: a naive implementation (joining to `Prodotto`/`Utente` when *displaying* an order or invoice, rather than copying at *creation* time) looks correct in every manual check, because nothing changes the underlying rows during a quick test. It only breaks the moment two independent operations — placing an order and renaming a product, or invoicing and updating a profile — happen in either order relative to each other. `tests/congelamento.test.js` reproduces exactly that: it creates an order, deliberately renames the product (or updates the customer's surname) *after* the order/invoice exists, then asserts the already-generated PDF still contains the original value — not just the database row, the actual bytes on disk.

A customer can be invoiced as either a business (VAT number) or a private individual (fiscal code): the invoice always requires an address, plus at least one of the two identifiers, never both — because both categories of customer are legitimate and requiring a VAT number alone would exclude private buyers entirely. This mirrors a real modeling gap: the schema this project was ported from had these fields on the user profile; the Node rewrite initially dropped them, which meant the freezing logic had real fields to copy *from* but the underlying data didn't exist. Adding `codice_fiscale` next to `partita_iva` on `Utente`, and validating "address + at least one identifier" before generating rather than after, turns a silent gap (an invoice with blank fields) into an explicit 400 the accounting user can act on immediately.

### Stock: decremented only at fulfillment, never at order creation

Placing an order locks the product row (`SELECT ... FOR UPDATE`) and checks availability, but never writes to `scorta`; the warehouse operator's fulfillment step is what actually commits to reducing stock, inside its own transaction with its own row lock — because an order can sit unfulfilled, get cancelled, or wait for restock, and none of that should reserve inventory it might not end up needing.

### Lock ordering: necessary, but not sufficient on its own

Both order creation and fulfillment lock every product row they touch in the same fixed order — sorted by product ID ascending, never in whatever order the client happened to list them in the cart — because two transactions touching the same two products in opposite sequence (`[7, 3]` vs. `[3, 7]`) can otherwise each hold one lock while waiting for the other: a genuine deadlock, not just contention.

This was verified, not assumed — a test creates two orders referencing the same two products with their line items in reversed order, fires both fulfillments concurrently, and checks neither fails. It initially passed even *before* the fix was applied to both code paths, which is the trap with concurrency bugs: they're timing-dependent, so a green test run proves nothing about the fix that isn't there yet. The fix had to be applied identically in both `creaOrdine` and `evadiOrdine` — ordering the lock acquisition in only one of the two paths still leaves the other free to acquire locks in client-supplied order, and the cycle can form across the two different code paths just as easily as within one of them twice.

Both transactions are also wrapped in a bounded retry-on-deadlock (`src/utils/transazioni.js`, max 3 attempts, each retry logged with its context), because matching lock order on the product rows turned out not to be the whole story: a real `ER_LOCK_DEADLOCK` still surfaced under concurrent load. `evadiOrdine` locks the existing order via a `JOIN` on `RigaOrdine` (`FOR UPDATE` on a secondary index, `ordine_id`), which takes next-key/gap locks beyond the specific rows returned; a concurrent `INSERT` into `righe_ordine` for a *different* order can conflict with that gap through an insert-intention lock — a mechanism entirely independent of the primary-key ordering on `prodotti`, and not something resource ordering alone can eliminate once secondary indexes are involved (MySQL's own documentation is explicit that applications should be prepared to retry a transaction on deadlock). The retry wraps only the transaction itself, deliberately nothing with a side effect outside the database, since a retry re-executes everything inside it; the logging exists on the theory that an occasional deadlock under load is expected, while a *frequent* one on the same code path is a symptom (too much work per transaction, locks held too long) that a silent retry would otherwise hide.

### Invoice numbering and PDF generation: correctness first, then a request to not hold locks longer than needed

Invoice numbers are assigned inside a short transaction using `SELECT MAX(numero_fattura) FOR UPDATE`, which serializes concurrent generations against the same table — verified with a 25-way concurrent stress test (all 25 succeed, numbers 1–25, no duplicates, no gaps) rather than trusted on the strength of "InnoDB should do this."

The actual PDF (filesystem I/O, slow and non-transactional) is generated *after* that transaction commits, not inside it, so a disk write never holds the table lock that guards the entire numbering sequence hostage for everyone else. The trade-off this creates: once the number and the totals are committed, a PDF failure can no longer be undone by a rollback — it leaves an invoice row that exists, is correctly numbered, but has `percorso_pdf = null`. `generaFattura` treats that state as a resumable job, not an error: a later call for the same order recognizes the pending invoice and completes the PDF using the *already-frozen* row, rather than rejecting the request or minting a second invoice for the same order.

`generaPdf` reads every value it prints — amounts, customer identity, line items, and the issue date — exclusively from the already-frozen `Fattura`/`RigaOrdine` records, never from `Ordine`, `Utente`, or `Prodotto`, because the recovery path above only holds up if a regenerated PDF can never disagree with the one that would have been produced the first time; two PDFs sharing one invoice number diverging from each other is exactly the kind of drift all the freezing above exists to prevent. The one place this didn't hold on first pass was the printed date, which read the wall-clock time at the moment the file was written (`new Date()`) — indistinguishable from the correct value on the very first attempt, but printing a *different* date on a later, successful retry. It now reads `fattura.createdAt`, fixed once at the original commit. Testing this without mocking global timers (real MySQL I/O runs in the same test, and faking `Date` globally risks the driver's own internal timers) meant back-dating `createdAt` directly after a simulated failure, then letting the retry happen in real time, and checking the regenerated PDF still shows the back-dated date.

Two more values are deliberately double-checked rather than assumed, for the same reason: that `createdAt` genuinely maps to a `created_at` column under `underscored: true` instead of silently being `undefined` (confirmed by reading the column directly with a raw connection, bypassing Sequelize, then cross-checking that back-dating it through Sequelize actually changed what that raw connection sees — a no-op mapping would have made the retry test above pass for the wrong reason), and that per-line VAT is rounded once per line before summing, rather than summed raw and rounded once at the end (two arithmetically different results whenever a line's raw subtotal isn't already a clean number of cents — the sum of the individually-rounded lines is what both the total and the printed detail lines must agree on).

### Everything else

- Invoice numbering is a single global sequence, never reset per calendar year — both are legally valid conventions in Italy; this project deliberately keeps the simpler one rather than introducing a composite `(numero_fattura, anno)` key that isn't needed yet.
- No physical deletion for User/Product (soft delete via the `attivo` field, preserving referential integrity for historical orders/invoices); Role/Permission/Group use `destroy()` (hard delete) instead, since nothing references them for a historical record the way an order references a product.
- Every route under `/api/sicurezza` (role/permission/group management, including assigning a role to a user) requires `verificaToken` + `hasPermission('utenti:gestione')` — these are the endpoints that can grant privileges, so leaving even one of them unauthenticated is a privilege-escalation path, not a minor oversight.

## Tests

```
npm test
```

Runs Jest + Supertest **against a dedicated MySQL database** (`orvent_test`, never the development one), configured in `.env.test` (auto-created if missing via `tests/setup/globalSetup.js`). The schema is created once at the start of the run; tables are cleared (`TRUNCATE`, not `DROP`) between tests for full isolation — essential for making stock and invoice-numbering checks deterministic.

The suites cover: RBAC (direct/role-based/group-based permissions), Orders (transactions, concurrent locks, state transitions), Invoices (calculation, concurrent numbering, PDF, the deadlock/recovery/date-freezing paths described above), data freezing (order/invoice content surviving a catalog or profile change made afterward), Products, Users, Groups, and the RBAC association-removal routes.
