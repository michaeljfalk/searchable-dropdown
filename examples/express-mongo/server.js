/**
 * examples/express-mongo/server.js — end-to-end demo.
 *
 * Wires the SearchableDropdown control to a real MongoDB collection through the
 * security-hardened router, and renders the page with an EJS template.
 *
 *   npm install express mongodb ejs
 *   MONGO_URL="mongodb://localhost:27017" node server.js
 *   open http://localhost:3000
 *
 * The control on the page reads from /api/dropdown/customers/* and offers a
 * "+ Add" row that POSTs to /api/dropdown/customers/create.
 */
'use strict';

const path = require('path');
const express = require('express');
const { MongoClient } = require('mongodb');

const {
  registerEntry,
  createSearchableDropdownRouter,
} = require('../../server/searchable-dropdown-mongo');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME   = process.env.DB_NAME   || 'sdd_demo';
const PORT      = process.env.PORT      || 3000;

async function main() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const customers = db.collection('customers');

  // Seed a few rows the first time so the demo isn't empty.
  if ((await customers.countDocuments()) === 0) {
    await customers.insertMany([
      { name: 'Acme Corp',      email: 'ops@acme.test',     phone: '555-0100', active: true },
      { name: 'Globex',         email: 'hi@globex.test',    phone: '555-0123', active: true },
      { name: 'Initech',        email: 'tps@initech.test',  phone: '555-0144', active: true },
      { name: 'Umbrella Co',    email: 'sales@umbrella.test', phone: '555-0188', active: true },
    ]);
  }

  // --- Register the collection on the picker allow-list ---------------------
  // In a multi-tenant app, derive tenantId from the authenticated user here.
  registerEntry('customers', {
    collection:     customers,
    displayField:   'name',                 // label + sort + dedup
    searchFields:   ['name', 'email', 'phone'],
    sublabelFields: ['email', 'phone'],      // shown as the second line
    activeFilter:   true,                    // exclude active === false
    // tenantFilter: (req) => ({ tenantId: req.user.tenantId }),
    create: {
      enabled:    true,
      fields:     [{ key: 'name', label: 'Name', required: true }],
      dedupField: 'name',
      build:      (input) => ({ name: input.name, active: true, createdAt: new Date() }),
    },
  });

  const app = express(); // nosemgrep -- demo uses sameOriginGuard (below) for CSRF; production should add csurf + real auth.
  app.use(express.json());
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Serve the library so the EJS page can <script>/<link> it.
  app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));

  /**
   * CSRF protection. The /create route changes state, so we reject cross-origin
   * state-changing requests by comparing the Origin against the Host. This is a
   * minimal, dependency-free guard suitable for the demo; in production prefer a
   * token-based library such as `csurf` (https://github.com/expressjs/csurf) or
   * `csrf`, plus your real auth/session middleware.
   */
  function sameOriginGuard(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const origin = req.headers.origin;
    if (!origin) return next(); // same-origin fetch() omits Origin on some browsers
    let originHost;
    try { originHost = new URL(origin).host; } catch (e) { originHost = null; }
    if (originHost && originHost === req.headers.host) return next();
    return res.status(403).json({ error: 'Cross-origin request rejected.' });
  }

  // The dropdown API. Add an `authorize` middleware in production.
  app.use(
    '/api/dropdown',
    sameOriginGuard,
    createSearchableDropdownRouter(/* { authorize: requireLogin } */),
  );

  app.get('/', (req, res) => res.render('index'));

  app.listen(PORT, () => console.log(`▶ http://localhost:${PORT}`));
}

main().catch((err) => { console.error(err); process.exit(1); });
