/**
 * searchable-dropdown-mongo.js — security-hardened Express + MongoDB backend.
 *
 * WHAT: A small registry + Express router that powers the SearchableDropdown
 *       control's async source. Three routes per registered key:
 *         GET  /:key/search?q=&limit=&scope[x]=   → live, scoped search
 *         GET  /:key/option/:id                   → resolve one id → option
 *         POST /:key/create                        → quick-create + return option
 *
 * WHY:  Ported from the original Meteor `dispatchSelect` registry model. Most
 *       collection-backed pickers need the SAME guarantees, so they live here
 *       once: the client only ever sends a registry KEY (never a collection or
 *       field name), searchable fields are allow-listed, user input is regex-
 *       escaped and length-capped (ReDoS guard), scope filters are allow-listed,
 *       and an optional per-request tenant filter is merged into every selector.
 *
 * DRIVER: Works with the official `mongodb` Node driver (Collection instances).
 *         Pass each collection in when you register its key.
 *
 * SECURITY DOCTRINE:
 *   - collectionKey is validated against the registry; unknown keys → 404.
 *   - Every DB FIELD NAME comes from registry config (validated to a safe
 *     dotted-identifier at registerEntry time), never from the request. Only
 *     VALUES derive from user input, and those are regex-escaped / type-checked.
 *   - Computed-key writes go through setField(), which refuses prototype keys.
 *   - tenantFilter(req) is merged into every selector — derive tenant server-side
 *     from the authenticated user, NEVER trust it from the wire.
 *   - create allow-lists input keys, enforces required, and dedupes.
 */
'use strict';

const MAX_TERM_LEN = 120;
const HARD_LIMIT   = 50;

const _registry = new Map();

// A DB field reference we accept in config: dotted identifiers only
// (e.g. "name", "customerSnapshot.name"). Anything else is rejected up front,
// which is what makes the later computed-key access provably safe.
const SAFE_FIELD = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function assertSafeField(field, where) {
  if (typeof field !== 'string' || !SAFE_FIELD.test(field)) {
    throw new Error(`registerEntry(${where}): "${field}" is not a valid field name`);
  }
  for (const part of field.split('.')) {
    if (FORBIDDEN_KEYS.has(part)) throw new Error(`registerEntry(${where}): "${field}" is a forbidden key`);
  }
  return field;
}

/** Guarded computed-key write — the only place we set a dynamic property. */
function setField(obj, field, value) {
  const top = String(field).split('.')[0];
  if (FORBIDDEN_KEYS.has(top)) return obj; // never write a prototype key
  // nosemgrep: field is a registry-config name validated by SAFE_FIELD; value is escaped/typed.
  obj[field] = value;
  return obj;
}

function escapeRegExp(s) {
  return String(s).slice(0, MAX_TERM_LEN).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function joinParts(parts) {
  return parts.map((p) => (p == null ? '' : String(p)).trim()).filter(Boolean).join(' · ');
}

/**
 * registerEntry — add one collection to the picker allow-list.
 *
 * @param {string} key — stable key the client sends, e.g. 'customers'
 * @param {object} cfg
 *   collection       {Collection}  (required) mongodb driver Collection
 *   displayField     {string}      (required) field used for label + sort + dedup (dot-path ok)
 *   displayLabel     {function}    optional (doc) => string; overrides displayField for the label
 *   searchFields     {string[]}    (required) allow-listed searchable fields
 *   sublabelFields   {string[]}    optional dot-paths joined with " · " into the sublabel
 *   sublabel         {function}    optional (doc) => string; overrides sublabelFields
 *   scopeMap         {object}      optional { friendlyKey: 'db.field' } allow-list for scope filters
 *   activeFilter     {boolean}     optional if true, adds active: { $ne: false }
 *   archivedField    {string}      optional field excluded when truthy (default 'archived'; '' to disable)
 *   searchLimit      {number}      optional default result cap (server hard-caps at 50)
 *   tenantFilter     {function}    optional (req) => selectorFragment merged into every query
 *   idField          {string}      optional id field for /option/:id (default '_id')
 *   castId           {function}    optional (idString) => castedId (e.g. new ObjectId(id))
 *   create           {object|null} optional quick-create config:
 *     fields         {object[]}    [{ key, label, required }]
 *     dedupField     {string}      input key checked against displayField for dedup
 *     build          {function}    (input, scope, req) => document to insert
 *     transformId    {function}    optional (insertResult) => id (default insertedId)
 */
function registerEntry(key, cfg) {
  if (typeof key !== 'string' || !key) throw new Error('registerEntry: key must be a non-empty string');
  if (!cfg || !cfg.collection) throw new Error(`registerEntry("${key}"): collection is required`);
  assertSafeField(cfg.displayField, `"${key}".displayField`);
  if (!Array.isArray(cfg.searchFields) || !cfg.searchFields.length) {
    throw new Error(`registerEntry("${key}"): searchFields must be a non-empty array`);
  }
  cfg.searchFields.forEach((f) => assertSafeField(f, `"${key}".searchFields`));
  (cfg.sublabelFields || []).forEach((f) => assertSafeField(f, `"${key}".sublabelFields`));
  Object.values(cfg.scopeMap || {}).forEach((f) => assertSafeField(f, `"${key}".scopeMap`));
  if (cfg.idField) assertSafeField(cfg.idField, `"${key}".idField`);
  if (cfg.archivedField) assertSafeField(cfg.archivedField, `"${key}".archivedField`);
  _registry.set(key, cfg);
}

function getEntry(key) { return _registry.get(key) || null; }

function toOption(entry, doc) {
  if (!doc) return null;
  const rawLabel = typeof entry.displayLabel === 'function'
    ? entry.displayLabel(doc)
    : getByPath(doc, entry.displayField);
  let sublabel = '';
  if (typeof entry.sublabel === 'function') sublabel = entry.sublabel(doc) || '';
  else if (Array.isArray(entry.sublabelFields)) sublabel = joinParts(entry.sublabelFields.map((p) => getByPath(doc, p)));
  const idField = entry.idField || '_id';
  return {
    value:    String(getByPath(doc, idField)),
    label:    rawLabel == null || rawLabel === '' ? '(unnamed)' : String(rawLabel),
    sublabel,
    raw:      doc,
  };
}

function baseSelector(entry, req) {
  const sel = {};
  const archivedField = entry.archivedField == null ? 'archived' : entry.archivedField;
  if (archivedField) setField(sel, archivedField, { $ne: true });
  if (entry.activeFilter) sel.active = { $ne: false };
  if (typeof entry.tenantFilter === 'function') {
    const t = entry.tenantFilter(req);
    if (t && typeof t === 'object') for (const [k, v] of Object.entries(t)) setField(sel, k, v);
  }
  return sel;
}

function applyScope(selector, entry, scope) {
  if (!scope || typeof scope !== 'object') return;
  for (const [incoming, dbField] of Object.entries(entry.scopeMap || {})) {
    const v = scope[incoming];
    if (typeof v === 'string' && v) setField(selector, dbField, v);
    else if (Array.isArray(v)) {
      const vals = v.filter((x) => typeof x === 'string' && x);
      if (vals.length) setField(selector, dbField, { $in: vals });
    }
  }
}

/** Parse Express's `scope[x]=y` query params into a flat { x: y } object. */
function readScopeFromQuery(query) {
  if (query && typeof query.scope === 'object') return query.scope; // express qs parser
  return {};
}

/**
 * createSearchableDropdownRouter — build an Express Router with the three
 * routes wired to the registry.
 *
 * @param {object} [opts]
 * @param {function} [opts.Router] — express.Router (auto-required if omitted)
 * @param {function} [opts.authorize] — (req, res, next) middleware run on every route
 * @returns {import('express').Router}
 */
function createSearchableDropdownRouter(opts = {}) {
  // Lazy require so the client side never needs express installed.
  const Router = opts.Router || require('express').Router;
  const router = Router();

  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  if (typeof opts.authorize === 'function') router.use(opts.authorize);

  function entryOr404(req, res) {
    const entry = getEntry(req.params.key);
    if (!entry) { res.status(404).json({ error: `Unknown selector "${req.params.key}".` }); return null; }
    return entry;
  }

  // ---- search -------------------------------------------------------------
  router.get('/:key/search', async (req, res) => {
    const entry = entryOr404(req, res); if (!entry) return;
    try {
      const selector = baseSelector(entry, req);
      applyScope(selector, entry, readScopeFromQuery(req.query));

      const q = String(req.query.q || '').trim();
      if (q) {
        const pattern = escapeRegExp(q);
        selector.$or = entry.searchFields.map((f) => setField({}, f, { $regex: pattern, $options: 'i' }));
      }
      const limit = Math.min(Math.max(1, Number(req.query.limit) || entry.searchLimit || 20), HARD_LIMIT);

      const docs = await entry.collection
        .find(selector)
        .sort(setField({}, entry.displayField, 1))
        .limit(limit)
        .toArray();

      res.json(docs.map((d) => toOption(entry, d)));
    } catch (err) {
      res.status(500).json({ error: err.message || 'Search failed.' });
    }
  });

  // ---- resolve one id -----------------------------------------------------
  router.get('/:key/option/:id', async (req, res) => {
    const entry = entryOr404(req, res); if (!entry) return;
    try {
      const idField = entry.idField || '_id';
      const selector = baseSelector(entry, req);
      setField(selector, idField, entry.castId ? entry.castId(req.params.id) : String(req.params.id));
      const doc = await entry.collection.findOne(selector);
      res.json(doc ? toOption(entry, doc) : null);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Lookup failed.' });
    }
  });

  // ---- quick-create -------------------------------------------------------
  router.post('/:key/create', async (req, res) => {
    const entry = entryOr404(req, res); if (!entry) return;
    const qc = entry.create;
    if (!qc) { res.status(403).json({ error: 'Quick-create is disabled for this selector.' }); return; }
    try {
      const body  = req.body || {};
      const scope = body.scope && typeof body.scope === 'object' ? body.scope : {};

      // Allow-list + trim input keys (defeats mass-assignment: only declared keys survive).
      const allowed = new Set((qc.fields || []).map((f) => f.key));
      const input = {};
      for (const [k, v] of Object.entries(body.fields || {})) {
        if (allowed.has(k) && !FORBIDDEN_KEYS.has(k) && typeof v === 'string') input[k] = v.trim();
      }
      // Required check.
      for (const f of (qc.fields || [])) {
        if (f.required && !input[f.key]) { res.status(400).json({ error: `${f.label || f.key} is required.` }); return; }
      }

      // Dedup against displayField (case-insensitive exact).
      const dedupVal = qc.dedupField ? input[qc.dedupField] : null;
      if (dedupVal) {
        const dupSel = baseSelector(entry, req);
        applyScope(dupSel, entry, scope);
        setField(dupSel, entry.displayField, { $regex: `^${escapeRegExp(dedupVal)}$`, $options: 'i' });
        const existing = await entry.collection.findOne(dupSel);
        if (existing) { res.json(Object.assign(toOption(entry, existing), { deduped: true })); return; }
      }

      // Build the insert document from developer code, then stamp tenant fields
      // server-side so they cannot be forged through the request body.
      const doc = typeof qc.build === 'function' ? qc.build(input, scope, req) : { ...input };
      if (typeof entry.tenantFilter === 'function') {
        const t = entry.tenantFilter(req);
        if (t && typeof t === 'object') for (const [k, v] of Object.entries(t)) setField(doc, k, v);
      }

      const result = await entry.collection.insertOne(doc);
      const id = typeof qc.transformId === 'function' ? qc.transformId(result) : result.insertedId;

      const idField = entry.idField || '_id';
      const fresh = await entry.collection.findOne(setField({}, idField, id));
      res.status(201).json(toOption(entry, fresh || setField({ ...doc }, idField, id)));
    } catch (err) {
      res.status(500).json({ error: err.message || 'Create failed.' });
    }
  });

  return router;
}

module.exports = {
  registerEntry,
  getEntry,
  toOption,
  createSearchableDropdownRouter,
  // exported for testing / reuse
  _internal: { escapeRegExp, getByPath, applyScope, setField, assertSafeField },
};
