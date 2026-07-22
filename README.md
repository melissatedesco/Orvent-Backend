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
2. Copy `.env.example` to `.env` and fill in the variables (your local MySQL credentials, a `JWT_SECRET` of your choice):
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
- `POST /genera` (`{ ordineId }`) — generates the invoice: sequential numbering (table lock), taxable amount/VAT (22%)/total calculation, PDF saved to `output/fatture/`, order moves to `FATTURATO`
- `GET /`, `GET /:id` — history, searchable by `numero`, `ordineId`, `cliente`, `dal`/`al`
- `GET /:id/pdf` — download the PDF

**Security (RBAC)** — `/api/sicurezza`
- `permessi`, `ruoli`, `gruppi` — CRUD (creation via `findOrCreate`, no duplicates)
- `POST`/`DELETE /ruoli/associa-permesso`, `/utenti/assegna-ruolo`, `/permessi/assegna-diretto`, `/gruppi/associa-ruolo`, `/utenti/assegna-gruppo` — grant/revoke RBAC associations

## Persistence and domain rules

- Prices are frozen into the order line at submission time, never recalculated.
- Stock never drops below zero: enforced in a transaction with a row lock, both on fulfillment and on invoicing.
- Invoice numbering is sequential, unique, and gap-free even under concurrent generation (table-level `FOR UPDATE` lock).
- No physical deletion for User/Product (soft delete via the `attivo` field); Role/Permission/Group use `destroy()` (hard delete) instead.

## Tests

```
npm test
```

Runs Jest + Supertest **against a dedicated MySQL database** (`orvent_test`, never the development one), configured in `.env.test` (auto-created if missing via `tests/setup/globalSetup.js`). The schema is created once at the start of the run; tables are cleared (`TRUNCATE`, not `DROP`) between tests for full isolation — essential for making stock and invoice-numbering checks deterministic.

The suites cover: RBAC (direct/role-based/group-based permissions), Orders (transactions, concurrent locks, state transitions), Invoices (calculation, concurrent numbering, PDF), Products, Users, Groups, and the RBAC association-removal routes.
