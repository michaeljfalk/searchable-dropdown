/**
 * examples/express-mongo/server.js — end-to-end demo.
 *
 * Wires the LiveSelect control to a real MongoDB collection through the
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
  createLiveSelectRouter,
} = require('../../server/liveselect-mongo');

const DB_NAME = process.env.DB_NAME || 'sdd_demo';
const PORT    = process.env.PORT    || 3000;

/**
 * connectMongo — return a connected client, with zero-config fallback.
 *
 * Order of preference:
 *   1. process.env.MONGO_URL (your real cluster / local mongod), if reachable.
 *   2. An in-memory MongoDB via the optional `mongodb-memory-server` dev dep —
 *      lets the demo run with NOTHING installed (`npm install` pulls it in).
 * If neither works we exit with a clear, actionable message.
 */
async function connectMongo() {
  const url = process.env.MONGO_URL;
  if (url) {
    const client = new MongoClient(url, { serverSelectionTimeoutMS: 2000 });
    try {
      await client.connect();
      console.log(`✓ Connected to MONGO_URL (${url})`);
      return client;
    } catch (err) {
      console.warn(`! Could not reach MONGO_URL (${err.message}). Falling back to in-memory MongoDB…`);
    }
  }

  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch (e) {
    console.error(
      '\nNo MongoDB available.\n' +
      '  • Start one and set MONGO_URL, e.g.  MONGO_URL="mongodb://localhost:27017" node server.js\n' +
      '  • Or install the zero-config fallback: npm install   (pulls mongodb-memory-server)\n',
    );
    process.exit(1);
  }

  console.log('… starting in-memory MongoDB (first run downloads a mongod binary)');
  // The very first run downloads + extracts a mongod binary; that can blow past
  // the default 10s start window. If so, retry once — the binary is cached by
  // then, so the second attempt starts in ~1s.
  let mem;
  try {
    mem = await MongoMemoryServer.create();
  } catch (err) {
    console.warn(`! First start failed (${err.message}). Retrying now the binary is cached…`);
    mem = await MongoMemoryServer.create();
  }
  const client = new MongoClient(mem.getUri());
  await client.connect();
  client.__mem = mem; // keep a handle so it isn't GC'd / can be stopped
  console.log('✓ In-memory MongoDB ready');
  return client;
}

async function main() {
  const client = await connectMongo();
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

  // The dropdown API. We pass `Router` explicitly because in this example the
  // library lives in a sibling folder that can't resolve express on its own;
  // when you copy server/ into your own app (where express is installed) you can
  // drop this and just call createLiveSelectRouter({ authorize }).
  app.use(
    '/api/dropdown',
    sameOriginGuard,
    createLiveSelectRouter({ Router: express.Router /* , authorize: requireLogin */ }),
  );

  app.get('/', (req, res) => res.render('index'));

  app.listen(PORT, () => console.log(`▶ http://localhost:${PORT}`));
}

main().catch((err) => { console.error(err); process.exit(1); });
