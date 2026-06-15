# Implementation guide

How to drop `searchable-dropdown` into each environment. Every target uses the
**same** `dist/searchable-dropdown.js` + `dist/searchable-dropdown.css` — only
the way you mount it differs.

- [1. Plain HTML + vanilla JS](#1-plain-html--vanilla-js)
- [2. Replacing a native `<select>`](#2-replacing-a-native-select)
- [3. The `[+ Add new]` create flow](#3-the--add-new-create-flow)
- [4. MongoDB data source (Node/Express)](#4-mongodb-data-source-nodeexpress)
- [5. EJS templates](#5-ejs-templates)
- [6. Blaze (Meteor)](#6-blaze-meteor)
- [7. Theming to match your app](#7-theming-to-match-your-app)
- [8. Security model](#8-security-model)

---

## 1. Plain HTML + vanilla JS

```html
<link rel="stylesheet" href="/dist/searchable-dropdown.css">
<form id="f">
  <div id="picker"></div>
  <button type="submit">Save</button>
</form>
<script src="/dist/searchable-dropdown.js"></script>
<script>
  new SearchableDropdown('#picker', {
    name: 'fruit',                    // a hidden <input name="fruit"> is created
    label: 'Fruit',
    source: [{ value: 'apple', label: 'Apple' }, 'banana', 'cherry'],
    onChange: (value, option) => console.log(value, option),
  });
</script>
```

Because the control writes a hidden `<input name="fruit">`, the surrounding
`<form>` serializes it like any native field — no JS wiring needed to submit.

Live demo: open [`examples/vanilla.html`](./examples/vanilla.html) in a browser.

---

## 2. Replacing a native `<select>`

Upgrade an existing select with **no markup changes** — handy for making a whole
form's inputs look uniform:

```js
SearchableDropdown.enhance('#country', { allowCreate: false });
```

`enhance()` reads the `<option>`s into an array source, copies
`name`/`value`/`required`/`disabled`, hides the original `<select>`, and **syncs
the selection back into it** — so any code already listening to that `<select>`'s
`change` event keeps working. An empty-value first option becomes the
placeholder. Add `data-sublabel="…"` on an `<option>` to give it a second line.

---

## 3. The `[+ Add new]` create flow

Set `allowCreate: true` and provide `onCreate`. When the typed text has no exact
match, a **`+ Add "…"`** row appears at the bottom of the menu. Selecting it (or
pressing Enter while it's highlighted) calls your handler. Return an option to
auto-select it; return `null`/`undefined` to cancel.

`onCreate` can do **anything**:

```js
// (a) just add to the local array
onCreate: (query) => { const o = { value: query, label: query }; list.push(o); return o; }

// (b) open your own modal, resolve when the user saves
onCreate: (query) => openMyModal({ name: query }).then(saved =>
  saved ? { value: saved._id, label: saved.name } : null)

// (c) POST to a server and use the created record
onCreate: async (query, ctx) => {
  const res = await fetch('/api/customers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: query, ...ctx.scope }),
  });
  if (!res.ok) throw new Error('Create failed');
  const doc = await res.json();
  return { value: doc._id, label: doc.name };
}
```

Customize the row text with `createLabel: (q) => '+ New customer “' + q + '”'`.

---

## 4. MongoDB data source (Node/Express)

The server backend lives in
[`server/searchable-dropdown-mongo.js`](./server/searchable-dropdown-mongo.js).
It exposes a **registry** and an Express **router** with three routes per key:

```
GET  /:key/search?q=&limit=&scope[x]=   → [ { value, label, sublabel, raw } ]
GET  /:key/option/:id                   → option | null
POST /:key/create   { fields, scope }   → option   (201)
```

### Wire it up

```js
const express = require('express');
const { MongoClient } = require('mongodb');
const { registerEntry, createSearchableDropdownRouter } =
  require('./server/searchable-dropdown-mongo');

const db = (await new MongoClient(process.env.MONGO_URL).connect()).db('app');

registerEntry('customers', {
  collection:     db.collection('customers'),
  displayField:   'name',                  // label + sort + dedup
  searchFields:   ['name', 'email', 'phone'], // ONLY these are ever searched
  sublabelFields: ['email', 'phone'],      // joined " · " into the 2nd line
  activeFilter:   true,                    // exclude active === false
  // Multi-tenant? Derive the tenant server-side, never from the client:
  tenantFilter:   (req) => ({ tenantId: req.user.tenantId }),
  create: {
    fields:     [{ key: 'name', label: 'Name', required: true }],
    dedupField: 'name',                    // case-insensitive exact dedup
    build:      (input, scope, req) => ({ name: input.name, active: true, createdAt: new Date() }),
  },
});

const app = express();
app.use(express.json());
app.use('/api/dropdown', createSearchableDropdownRouter({
  authorize: requireLogin,  // your auth middleware — runs on every route
}));
```

### Client side

```js
const api = SearchableDropdown.remoteSource({ baseUrl: '/api/dropdown', key: 'customers', create: true });
new SearchableDropdown('#customer', {
  name: 'customerId', source: api.source, resolve: api.resolve,
  allowCreate: true, onCreate: api.onCreate,
});
```

Using Mongo `ObjectId`s? Pass `castId: (id) => new ObjectId(id)` in the entry so
`/option/:id` and lookups match. A complete runnable demo is in
[`examples/express-mongo/`](./examples/express-mongo/) (`npm install && node server.js`).

> Not using Mongo? `source` is just `async (query, ctx) => options[]`. Point it
> at SQL, a REST API, ElasticSearch — anything that returns the option shape.

---

## 5. EJS templates

Two ways. **Declarative (recommended)** keeps server data out of `<script>`
tags entirely — it travels as HTML-escaped `data-*` attributes that the
auto-mount helper reads:

```html
<!-- once on the page -->
<link rel="stylesheet" href="/dist/searchable-dropdown.css">
<script src="/dist/searchable-dropdown.js"></script>
<script src="/dist/searchable-dropdown-auto.js"></script>

<!-- anywhere, via the partial -->
<%- include('_dropdown', {
      name: 'customerId', label: 'Customer',
      apiKey: 'customers', allowCreate: true,
      value: customer ? customer._id : '',     // edit mode
      valueLabel: customer ? customer.name : '',
    }) %>
```

The partial ([`examples/express-mongo/views/_dropdown.ejs`](./examples/express-mongo/views/_dropdown.ejs))
emits a single `<div data-sdd-mount …>`; no inline JS, no XSS surface. You can
also hand-author the markup:

```html
<div data-sdd-mount
     data-name="customerId" data-label="Customer"
     data-api-base="/api/dropdown" data-api-key="customers"
     data-allow-create="true"></div>
```

Or, for a static array, `data-options='<%= JSON.stringify(list) %>'`.

---

## 6. Blaze (Meteor)

Use the adapter in [`examples/blaze/`](./examples/blaze/). It mounts the vanilla
class in `onRendered`, so Blaze never reimplements the picker:

```handlebars
{{> searchableDropdown
      name="customerId" label="Customer"
      collectionKey="customers" allowCreate=true
      onSelect=onCustomerSelect }}
```

Provide a reactive `options` array for a local source, or a `collectionKey` to
back it with Meteor methods (`<key>.search` / `<key>.option`). Vendor
`dist/searchable-dropdown.js` somewhere importable and load the `.css` once.

> Migrating from the original `dispatchSelect`? The option shape changed
> `_id → value` (still accepted as input), and the event renamed
> `dispatchselect-change → sdd:change`. The registry concepts (searchFields,
> scopeMap, quickCreate) map 1:1 onto the Express backend's entry config.

---

## 7. Theming to match your app

Everything reads from `--sdd-*` custom properties (see the top of
`searchable-dropdown.css`). The fastest path to "matches our other inputs":

```css
.sdd {
  --sdd-border:       var(--your-input-border);
  --sdd-radius:       var(--your-input-radius);
  --sdd-accent:       var(--your-brand);
  --sdd-border-focus: var(--your-focus-ring);
}
```

Scope overrides to one field by nesting under an ancestor, add `class="sdd--dark"`
for the built-in dark theme, or set `classPrefix` to namespace the classes
entirely.

---

## 8. Security model

Ported from the original `dispatchSelect` doctrine and enforced by the Express
backend:

- **The client only ever sends a registry KEY** — never a collection or field
  name. Unknown keys → `404`.
- **Field allow-listing** — only `searchFields` are searched; only declared
  `create.fields` keys are accepted on create (defeats mass-assignment).
- **ReDoS guard** — search terms are length-capped (120 chars) and regex-escaped
  before they reach Mongo.
- **Tenant isolation** — `tenantFilter(req)` is merged into _every_ selector and
  stamped onto created docs server-side; derive it from the authenticated user,
  never trust it from the wire.
- **Prototype-pollution guards** — config field names are validated to safe
  dotted identifiers at registration; all dynamic key writes refuse
  `__proto__`/`prototype`/`constructor`.
- **Bring your own auth + CSRF** — pass an `authorize` middleware to the router,
  and protect the state-changing `POST /create` with your CSRF strategy (the
  demo ships a minimal same-origin guard; production should use `csurf` or
  equivalent).
