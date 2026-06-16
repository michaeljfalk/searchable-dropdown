/**
 * server.test.js — unit + integration tests for the Express/MongoDB backend.
 *
 * Run with:  npm test   (uses Node's built-in test runner, node --test)
 *
 * Covers the security guarantees from the audit as regression tests:
 *   - no full-document disclosure (raw is opt-in)
 *   - projection limits fields read
 *   - generic error responses (no internal-message leakage)
 *   - NoSQL operator-injection in scope is ignored
 *   - regex escaping / field-name validation / prototype-key rejection
 *   - create allow-listing, required, dedup; create-disabled → 403; unknown → 404
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const {
  registerEntry,
  toOption,
  createLiveSelectRouter,
  _internal,
} = require('../server/liveselect-mongo.js');

// --------------------------------------------------------------------------
// Pure-function unit tests (no Mongo needed)
// --------------------------------------------------------------------------

test('escapeRegExp escapes metacharacters and caps length', () => {
  assert.equal(_internal.escapeRegExp('a.b*c(d)'), 'a\\.b\\*c\\(d\\)');
  const long = 'x'.repeat(500);
  assert.equal(_internal.escapeRegExp(long).length, 120);
});

test('assertSafeField accepts dotted identifiers, rejects junk and prototype keys', () => {
  assert.doesNotThrow(() => _internal.assertSafeField('customerSnapshot.name', 't'));
  assert.throws(() => _internal.assertSafeField('name; drop', 't'));
  assert.throws(() => _internal.assertSafeField('__proto__', 't'));
  assert.throws(() => _internal.assertSafeField('a.constructor', 't'));
});

test('applyScope only maps allow-listed keys and ignores operator objects', () => {
  const entry = { scopeMap: { region: 'region' } };
  const sel = {};
  _internal.applyScope(sel, entry, { region: 'west', evil: 'x', other: 'y' });
  assert.deepEqual(sel, { region: 'west' }); // evil/other dropped (not in scopeMap)

  const sel2 = {};
  _internal.applyScope(sel2, entry, { region: { $ne: 'x' } }); // operator injection
  assert.deepEqual(sel2, {}); // object value ignored — not a string/array
});

test('setField refuses prototype keys', () => {
  const o = {};
  _internal.setField(o, '__proto__', { polluted: true });
  assert.equal(({}).polluted, undefined); // no global prototype pollution
  assert.equal(Object.prototype.hasOwnProperty.call(o, '__proto__'), false);
});

test('toOption omits raw by default and includes it (only) with exposeRaw', () => {
  const entry = { displayField: 'name', sublabelFields: ['email'], idField: '_id' };
  const doc = { _id: 'a1', name: 'Acme', email: 'a@b.c', secret: 'HASH' };
  const off = toOption(entry, doc);
  assert.deepEqual(off, { value: 'a1', label: 'Acme', sublabel: 'a@b.c' });
  assert.equal('raw' in off, false);

  const on = toOption({ ...entry, exposeRaw: true }, doc);
  assert.equal(on.raw.secret, 'HASH');
});

test('toOption falls back to (unnamed) for empty label', () => {
  const entry = { displayField: 'name', idField: '_id' };
  assert.equal(toOption(entry, { _id: 'x', name: '' }).label, '(unnamed)');
});

test('registerEntry rejects unsafe config field names', () => {
  assert.throws(() => registerEntry('bad1', { collection: {}, displayField: 'a;b', searchFields: ['name'] }));
  assert.throws(() => registerEntry('bad2', { collection: {}, displayField: 'name', searchFields: [] }));
  assert.throws(() => registerEntry('bad3', { collection: {}, displayField: 'name', searchFields: ['__proto__'] }));
});

// --------------------------------------------------------------------------
// Router integration — generic error (no Mongo; collection stub throws)
// --------------------------------------------------------------------------

test('search returns a generic error and never leaks internal messages', async () => {
  registerEntry('boom', {
    collection: { find() { throw new Error('SECRET-INTERNAL-DETAIL'); } },
    displayField: 'name',
    searchFields: ['name'],
  });
  const app = express(); // nosemgrep -- ephemeral in-process test harness, not a network-facing server
  app.use(express.json());
  app.use('/d', createLiveSelectRouter({ Router: express.Router }));

  const { server, port } = await listen(app);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/d/boom/search?q=x`);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.error, 'Search failed.');
    assert.equal(JSON.stringify(body).includes('SECRET-INTERNAL-DETAIL'), false);
  } finally {
    server.close();
  }
});

// --------------------------------------------------------------------------
// Router integration — real in-memory MongoDB
// --------------------------------------------------------------------------

test('router against in-memory MongoDB', async (t) => {
  let MongoMemoryServer, MongoClient, ObjectId;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
    ({ MongoClient, ObjectId } = require('mongodb'));
  } catch (e) {
    t.skip('mongodb / mongodb-memory-server not installed');
    return;
  }

  const mem = await MongoMemoryServer.create();
  const client = new MongoClient(mem.getUri());
  await client.connect();
  const db = client.db('test');
  const customers = db.collection('customers');
  await customers.insertMany([
    { name: 'Acme Corp', email: 'ops@acme.test', region: 'west', secret: 'HASH', active: true },
    { name: 'Globex', email: 'hi@globex.test', region: 'east', secret: 'HASH', active: true },
    { name: 'Initech', email: 'tps@initech.test', region: 'west', secret: 'HASH', active: false },
  ]);

  registerEntry('cust', {
    collection: customers,
    displayField: 'name',
    searchFields: ['name', 'email'],
    sublabelFields: ['email'],
    scopeMap: { region: 'region' },
    activeFilter: true,
    castId: (id) => new ObjectId(id), // _id is an ObjectId → must cast for /option/:id
    create: {
      fields: [{ key: 'name', label: 'Name', required: true }],
      dedupField: 'name',
      build: (input) => ({ name: input.name, active: true }),
    },
  });
  // A second entry that opts into raw but projects to safe fields only.
  registerEntry('custRaw', {
    collection: customers,
    displayField: 'name',
    searchFields: ['name'],
    exposeRaw: true,
    projection: { name: 1, email: 1 }, // secret excluded
  });

  const app = express(); // nosemgrep -- ephemeral in-process test harness, not a network-facing server
  app.use(express.json());
  app.use('/d', createLiveSelectRouter({ Router: express.Router }));
  const { server, port } = await listen(app);
  const base = `http://127.0.0.1:${port}/d`;
  const get = async (u) => (await fetch(base + u)).json();
  const post = async (u, b) => fetch(base + u, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
  });

  try {
    await t.test('search returns matches without raw and excludes inactive', async () => {
      const out = await get('/cust/search?q=ac');
      assert.equal(out.length, 1);
      assert.equal(out[0].label, 'Acme Corp');
      assert.equal('raw' in out[0], false);
      // Initech is active:false → excluded even though it has no match for "ac"
      const all = await get('/cust/search');
      assert.deepEqual(all.map((o) => o.label).sort(), ['Acme Corp', 'Globex']);
    });

    await t.test('scope filter works; operator-injection in scope is ignored', async () => {
      const west = await get('/cust/search?scope[region]=west');
      assert.deepEqual(west.map((o) => o.label), ['Acme Corp']);
      // Injecting an operator must NOT filter — value isn't a string, so ignored,
      // returning the full active set rather than erroring or leaking.
      const inj = await get('/cust/search?scope[region][$ne]=west');
      assert.deepEqual(inj.map((o) => o.label).sort(), ['Acme Corp', 'Globex']);
    });

    await t.test('exposeRaw + projection limits fields (secret never leaves DB)', async () => {
      const out = await get('/custRaw/search?q=acme');
      assert.equal(out[0].raw.name, 'Acme Corp');
      assert.equal('secret' in out[0].raw, false);
    });

    await t.test('unknown key → 404', async () => {
      const res = await fetch(base + '/nope/search?q=x');
      assert.equal(res.status, 404);
    });

    await t.test('option/:id resolves valid id and returns null for junk', async () => {
      const one = await get('/cust/search?q=globex');
      const resolved = await get(`/cust/option/${one[0].value}`);
      assert.equal(resolved.label, 'Globex');
      const junk = await get('/cust/option/zzz%0Ainjection');
      assert.equal(junk, null);
    });

    await t.test('create: allow-lists fields, drops extras and prototype keys', async () => {
      const res = await post('/cust/create', {
        fields: { name: 'Wayne Enterprises', isAdmin: true, __proto__: { x: 1 } },
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.label, 'Wayne Enterprises');
      const doc = await customers.findOne({ name: 'Wayne Enterprises' });
      assert.equal(doc.isAdmin, undefined); // extra field rejected
    });

    await t.test('create: required enforced, dedup returns existing', async () => {
      const missing = await post('/cust/create', { fields: {} });
      assert.equal(missing.status, 400);
      const dup = await post('/cust/create', { fields: { name: 'wayne enterprises' } });
      const body = await dup.json();
      assert.equal(body.deduped, true);
      assert.equal(await customers.countDocuments({ name: /wayne enterprises/i }), 1);
    });

    await t.test('create disabled → 403', async () => {
      const res = await post('/custRaw/create', { fields: { name: 'x' } });
      assert.equal(res.status, 403);
    });
  } finally {
    server.close();
    await client.close();
    await mem.stop();
  }
});

// --------------------------------------------------------------------------
function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
