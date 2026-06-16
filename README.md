# searchable-dropdown

[![CI](https://github.com/michaeljfalk/searchable-dropdown/actions/workflows/ci.yml/badge.svg)](https://github.com/michaeljfalk/searchable-dropdown/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/michaeljfalk/searchable-dropdown?sort=semver)](https://github.com/michaeljfalk/searchable-dropdown/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen.svg)](./package.json)

A **framework-agnostic, dependency-free** searchable dropdown / combobox — one
control to replace native `<select>`s so every input looks uniform.

It is a portable rewrite of the Meteor/Blaze `dispatchSelect` picker, with the
framework coupling stripped out. The same `dist/searchable-dropdown.js` + `.css`
run in **plain HTML + vanilla JS, Node/Express, EJS templates, and Blaze**.

## Features

- 🔎 **Live search** — debounced, keyboard-navigable (↑/↓/Enter/Esc), touch-friendly two-line options.
- 🗂 **Any data source** — a plain **array** _or_ an **async function** (wire it to **MongoDB** via the included Express backend, or anything else).
- ➕ **`[+ Add new]` row** — appears when the typed text has no match; your `onCreate` can do _anything_ (open a modal, POST to a server, push to an array) and return the new option to auto-select it.
- 🔁 **Drop-in `<select>` replacement** — `SearchableDropdown.enhance(selectEl)` upgrades an existing `<select>` in place; a hidden `<input name>` means it submits inside a plain `<form>` like a native control.
- 🎨 **Fully themeable** — restyle with `--sdd-*` CSS custom properties or target the BEM-ish classes; ships a light and dark theme.
- 🔒 **Security-hardened server** — registry-gated collection access, field allow-listing, ReDoS-capped regex, scope filters, tenant isolation hook, prototype-pollution guards.
- 📦 **Zero dependencies**, ~12 KB. Works as a `<script>` tag (`window.SearchableDropdown`), a CommonJS `require`, or an ES module `import`.

## Install

No build step, and **the library has zero runtime dependencies** — there is
nothing to compile. Reference the files directly:

```html
<link rel="stylesheet" href="/dist/searchable-dropdown.css">
<script src="/dist/searchable-dropdown.js"></script>
<!-- optional declarative auto-mount helper -->
<script src="/dist/searchable-dropdown-auto.js"></script>
```

ES module / bundler:

```js
import SearchableDropdown from './dist/searchable-dropdown.mjs';
```

## Consuming it in another project

This repo is **private** and **not published to npm**, so
`npm install searchable-dropdown` (public registry) won't find it. Pick whichever
of these fits the consuming project — a plain `git pull`/clone is enough, there's
nothing to build for the component itself.

> The only thing a host app needs to install is its own `express` + `mongodb`
> **if** you use the MongoDB server helper (`server/searchable-dropdown-mongo.js`).
> The browser side needs nothing.

### Option 1 — Copy the files (simplest for plain HTML / EJS / Blaze)

The front-end is just `<script>` + `<link>`, so drop the files into your static
assets and reference them. To grab them without cloning the whole repo:

```bash
mkdir -p public/vendor/searchable-dropdown
for f in searchable-dropdown.js searchable-dropdown.mjs searchable-dropdown.css searchable-dropdown-auto.js; do
  curl -fsSL "https://raw.githubusercontent.com/michaeljfalk/searchable-dropdown/main/dist/$f" \
    -o "public/vendor/searchable-dropdown/$f"
done
# using the MongoDB backend too? also copy server/searchable-dropdown-mongo.js
```

### Option 2 — `npm install` straight from GitHub (best for bundler apps)

`package.json` declares `main`/`module`/`exports`/`files`, so npm can install it
directly from the git repo — no registry required (it clones over your existing
GitHub/SSH auth):

```bash
npm install github:michaeljfalk/searchable-dropdown
# or pin to a tag/commit for reproducible installs:
npm install github:michaeljfalk/searchable-dropdown#v1.0.0
```

Then import via the package name:

```js
import SearchableDropdown from 'searchable-dropdown';          // → dist/.mjs
import 'searchable-dropdown/css';                              // if your bundler imports CSS
// server side:
const { registerEntry, createSearchableDropdownRouter } = require('searchable-dropdown/server');
```

### Option 3 — git submodule (track it and `git pull` updates)

```bash
git submodule add https://github.com/michaeljfalk/searchable-dropdown.git vendor/searchable-dropdown
git submodule update --remote   # pull updates later
```

## Quick start

### Array source

```js
new SearchableDropdown('#picker', {
  name: 'fruit',                 // hidden input name → submits in a form
  label: 'Favourite fruit',
  source: [
    { value: 'apple',  label: 'Apple',  sublabel: 'Pomaceous' },
    { value: 'banana', label: 'Banana' },
    'cherry',                    // bare strings are accepted too
  ],
  allowCreate: true,
  onCreate: (query) => ({ value: query, label: query }), // return option → auto-selects
  onChange: (value, option) => console.log(value, option),
});
```

### Replace an existing `<select>`

```html
<select id="country" name="country">
  <option value="">Choose…</option>
  <option value="ca">Canada</option>
  <option value="us">United States</option>
</select>
<script>
  SearchableDropdown.enhance('#country'); // existing change listeners keep working
</script>
```

### MongoDB-backed (async source)

```js
const api = SearchableDropdown.remoteSource({
  baseUrl: '/api/dropdown', key: 'customers', create: true,
});
new SearchableDropdown('#customer', {
  name: 'customerId',
  source: api.source,      // GET /api/dropdown/customers/search?q=
  resolve: api.resolve,    // GET .../option/:id  (edit-mode label lookup)
  allowCreate: true,
  onCreate: api.onCreate,  // POST .../create
});
```

See **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** for the full server setup and
per-framework integration (HTML, Express, EJS, Blaze).

## Options

| Option | Type | Default | Notes |
|---|---|---|---|
| `source` *(required)* | `Array` \| `async (q, ctx) => options[]` | — | Array filters locally; function = async source. |
| `name` | `string` | `''` | Hidden-input name for plain-form submission. |
| `value` | `string` | — | Initial/controlled selected value. |
| `valueLabel` | `string` | — | Label for `value` (skips a resolve round-trip). |
| `resolve` | `async (value, ctx) => option` | — | Resolve a value → option (async sources, edit mode). |
| `label` | `string` | — | Field label above the control. |
| `placeholder` | `string` | `'Search…'` | |
| `required` | `boolean` | `false` | Adds `*` marker + hidden input `required`. |
| `disabled` | `boolean` | `false` | |
| `clearable` | `boolean` | `true` | Show the `×` clear button. |
| `openOnFocus` | `boolean` | `true` | Run an empty search on focus. |
| `minChars` | `number` | `0` | Min query length before searching. |
| `debounce` | `number` | `250` | ms. |
| `limit` | `number` | `20` | Max results shown/requested. |
| `scope` | `object` | `{}` | Passed to async source / `onCreate` as `ctx.scope`. |
| `allowCreate` | `boolean` | `false` | Show the `[+ Add]` row when no exact match. |
| `createLabel` | `(q) => string` | `+ Add "q"` | Add-row label. |
| `onCreate` | `async (q, ctx) => option\|null` | — | Do anything; return an option to auto-select. |
| `onChange` | `(value, option) => void` | — | Fires on every selection/clear. |
| `classPrefix` | `string` | `'sdd'` | CSS class prefix. |
| `texts` | `object` | — | `{ searching, noResults, searchFailed }`. |

**Option shape:** `{ value, label, sublabel?, raw? }`. Loose input is normalized —
a bare string becomes `{ value, label }`; `_id`/`id` map to `value`;
`name`/`title`/`text` map to `label`.

## Instance API

```
getValue() · getOption() · setValue(v, option?) · clear()
focus() · open() · close() · setSource(src) · setScope(obj)
setDisabled(bool) · destroy()
```

## Events

Besides the `onChange` callback, the control dispatches a **bubbling**
`sdd:change` CustomEvent on its root element:

```js
form.addEventListener('sdd:change', (e) => {
  console.log(e.detail); // { name, value, option }
});
```

## Theming

Override any token, globally or scoped to one control:

```css
.sdd { --sdd-border: #7c3aed; --sdd-accent: #7c3aed; --sdd-radius: 14px; }
```

Add `class="sdd--dark"` for the built-in dark theme. Full token list is at the
top of `dist/searchable-dropdown.css`.

## Tests

```bash
npm install   # dev deps only: express, mongodb, mongodb-memory-server, jsdom
npm test      # Node's built-in runner (node --test)
```

The suite (in `test/`) covers the client in jsdom (HTML-escaping/XSS, the hidden
input form mirror, `sdd:change`, `enhance()`), the pure server helpers, and the
router against an in-memory MongoDB — including the security regressions from the
audit (no document disclosure, generic errors, NoSQL operator-injection,
allow-listing, dedup). CI runs them on Node 18/20/22 (`.github/workflows/ci.yml`).
The library itself ships with **zero runtime dependencies**.

## Repository layout

```
dist/
  searchable-dropdown.js        # UMD core (script tag / require)
  searchable-dropdown.mjs       # ES-module entry
  searchable-dropdown.css       # themeable styles
  searchable-dropdown-auto.js   # optional declarative data-* auto-mount
server/
  searchable-dropdown-mongo.js  # Express + MongoDB backend (registry + router)
examples/
  vanilla.html                  # array source · theming · <select> enhance
  express-mongo/                # Node/Express + MongoDB + EJS demo
  blaze/                        # Meteor/Blaze adapter template
test/
  server.test.js                # pure helpers + router vs in-memory MongoDB
  client.test.js                # client behavior under jsdom
IMPLEMENTATION.md               # full integration guide
```

## License

MIT
