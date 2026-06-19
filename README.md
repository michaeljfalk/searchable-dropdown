# liveselect

[![CI](https://github.com/michaeljfalk/liveselect/actions/workflows/ci.yml/badge.svg)](https://github.com/michaeljfalk/liveselect/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/michaeljfalk/liveselect?sort=semver)](https://github.com/michaeljfalk/liveselect/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen.svg)](./package.json)

A **framework-agnostic, dependency-free** searchable dropdown / combobox — one
control to replace native `<select>`s so every input looks uniform.

No framework, no build step, no dependencies. The same
`dist/liveselect.js` + `.css` run in **plain HTML + vanilla JS,
Node/Express, EJS templates, and Blaze**.

## Features

- 🔎 **Live search** — debounced, keyboard-navigable (↑/↓/Enter/Esc), touch-friendly two-line options.
- 🗂 **Any data source** — a plain **array** _or_ an **async function** (wire it to **MongoDB** via the included Express backend, or anything else).
- ➕ **`[+ Add new]` row** — appears when the typed text has no match; your `onCreate` can do _anything_ (open a modal, POST to a server, push to an array) and return the new option to auto-select it.
- 🔁 **Drop-in `<select>` replacement** — `LiveSelect.enhance(selectEl)` upgrades an existing `<select>` in place; a hidden `<input name>` means it submits inside a plain `<form>` like a native control. Also upgrades `<select multiple>`.
- 🏷 **Multiple selection** — `multiple: true` for removable chips, array values, `maxItems`, and configurable form submission (`repeat`/`bracket`/`delimited`). See [Multiple selection](#multiple-selection).
- 🎨 **Fully themeable** — restyle with `--liveselect-*` CSS custom properties or target the BEM-ish classes; ships a light and dark theme.
- 🧩 **Custom item templates** — render each result row _and_ the `[+ Add]` row however you like with `renderOption` / `renderCreate`; return a DOM node (XSS-safe) or an HTML string. See [Custom item templates](#custom-item-templates).
- ♿ **Accessible by default** — full ARIA combobox/listbox wiring (`aria-activedescendant`, `aria-selected`, live-region announcements) so keyboard nav is screen-reader friendly. Optional **grouped options** with `<optgroup>`-style headings.
- 🧰 **Polish where it counts** — real `required` form validation, disabled (non-selectable) options, match highlighting, a “Showing N of M” hint, async result caching, and `open`/`close`/`search` lifecycle events.
- 🔒 **Security-hardened server** — registry-gated collection access, field allow-listing, ReDoS-capped regex, scope filters, tenant isolation hook, prototype-pollution guards.
- 📦 **Zero dependencies**, ~14 KB gzipped (JS) + ~2 KB CSS. Works as a `<script>` tag (`window.LiveSelect`), a CommonJS `require`, or an ES module `import`.

## Install

No build step, and **the library has zero runtime dependencies** — there is
nothing to compile. Reference the files directly:

```html
<link rel="stylesheet" href="/dist/liveselect.css">
<script src="/dist/liveselect.js"></script>
<!-- optional declarative auto-mount helper -->
<script src="/dist/liveselect-auto.js"></script>
```

ES module / bundler:

```js
import LiveSelect from './dist/liveselect.mjs';
```

## Consuming it in another project

The npm package name is **`@michaeljfalk/liveselect`** (scoped). Pick whichever path
fits the consuming project — there's nothing to build for the component itself.

> The only thing a host app needs to install is its own `express` + `mongodb`
> **if** you use the MongoDB server helper (`server/liveselect-mongo.js`).
> The browser side needs nothing.

### Option 1 — npm (best for bundler apps)

```bash
npm install @michaeljfalk/liveselect
```

```js
import LiveSelect from '@michaeljfalk/liveselect';                 // → dist/.mjs
import '@michaeljfalk/liveselect/css';                                     // if your bundler imports CSS
// server side:
const { registerEntry, createLiveSelectRouter } = require('@michaeljfalk/liveselect/server');
```

> The class is exported as `LiveSelect` (the package is `@michaeljfalk/liveselect`).

### Option 2 — `npm install` straight from GitHub (no registry needed)

`package.json` declares `main`/`module`/`exports`/`files`, so npm can install it
directly from the public GitHub repo:

```bash
npm install github:michaeljfalk/liveselect
# or pin to a tag/commit for reproducible installs:
npm install github:michaeljfalk/liveselect#v1.0.0
```

### Option 3 — Copy the files (simplest for plain HTML / EJS / Blaze)

The front-end is just `<script>` + `<link>`, so drop the files into your static
assets and reference them. To grab them without cloning the whole repo:

```bash
mkdir -p public/vendor/liveselect
for f in liveselect.js liveselect.mjs liveselect.css liveselect-auto.js; do
  curl -fsSL "https://raw.githubusercontent.com/michaeljfalk/liveselect/main/dist/$f" \
    -o "public/vendor/liveselect/$f"
done
# using the MongoDB backend too? also copy server/liveselect-mongo.js
```

### Option 4 — git submodule (track it and `git pull` updates)

```bash
git submodule add https://github.com/michaeljfalk/liveselect.git vendor/liveselect
git submodule update --remote   # pull updates later
```

## Quick start

### Array source

```js
new LiveSelect('#picker', {
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
  LiveSelect.enhance('#country'); // existing change listeners keep working
</script>
```

### MongoDB-backed (async source)

```js
const api = LiveSelect.remoteSource({
  baseUrl: '/api/dropdown', key: 'customers', create: true,
});
new LiveSelect('#customer', {
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
| `createLabel` | `(q) => string` | `+ Add "q"` | Add-row label (plain text). |
| `renderOption` | `(option, ctx) => Node\|string\|null` | — | Custom template for each result row. See [Custom item templates](#custom-item-templates). |
| `renderCreate` | `(q, ctx) => Node\|string\|null` | — | Custom template for the `[+ Add]` row. |
| `onCreate` | `async (q, ctx) => option\|null` | — | Do anything; return an option to auto-select. |
| `onChange` | `(value, option) => void` | — | Fires on every selection/clear. |
| `groupBy` | `(option) => string` | — | Group results under headings. See [Grouped options](#grouped-options). |
| `highlight` | `boolean` | `false` | Wrap the matched query substring in each result with `<mark>`. Ignored for `renderOption` rows. |
| `cache` | `boolean` | `false` | Cache async results by query+scope+limit so repeats skip the network. Cleared by `setSource()`/`setScope()`. |
| `multiple` | `boolean` | `false` | Multi-select mode — chips, array value. See [Multiple selection](#multiple-selection). |
| `maxItems` | `number` | — | Cap the number of selections (multiple mode). |
| `submitFormat` | `'repeat'`\|`'bracket'`\|`'delimited'` | `'repeat'` | How multiple values submit in a plain form. |
| `delimiter` | `string` | `','` | Joiner for `submitFormat: 'delimited'`. |
| `classPrefix` | `string` | `'liveselect'` | CSS class prefix. |
| `texts` | `object` | — | `{ searching, noResults, searchFailed, required }`, plus optional `more(shown, total) => string`. |

**Option shape:** `{ value, label, sublabel?, group?, disabled?, raw? }`. Loose input
is normalized — a bare string becomes `{ value, label }`; `_id`/`id` map to `value`;
`name`/`title`/`text` map to `label`. `disabled: true` makes a row non-selectable
(dimmed, skipped by keyboard nav).

**Async source `ctx`:** `{ scope, limit, query, signal }`. `signal` is an
`AbortSignal` that fires when a newer search supersedes the current one — pass it
to `fetch` (the built-in `remoteSource` already does) to cancel stale requests. An
async source may resolve to a bare array **or** `{ items, total }` — the `total`
drives the “Showing N of M” footer when results are capped by `limit`.

## Custom item templates

By default each row renders an escaped two-line `label` / `sublabel`. To render
anything else — avatars, badges, multi-column layouts — pass `renderOption`
(for result rows) and/or `renderCreate` (for the `[+ Add]` row). The control
still owns the outer `<button>` (ARIA roles, keyboard navigation, click
handling); your function only supplies the **inner** content.

Each function may return:

- a **DOM `Node`** — appended as-is, **XSS-safe by construction** (recommended);
- a **string** — set as the row's `innerHTML`; **you own escaping** here, so run
  untrusted data through `ctx.escapeHtml` (also exposed as `LiveSelect.escapeHtml`);
- `null` / `undefined` — fall back to the default escaped rendering for that row.

```js
new LiveSelect('#customer', {
  source: customers,                       // options carry the full record on `raw`
  // ctx = { index, query, active, escapeHtml }
  renderOption: (opt, ctx) => {
    const row = document.createElement('div');
    row.className = 'cust-row';
    row.innerHTML =
      `<img class="cust-avatar" src="${ctx.escapeHtml(opt.raw.avatarUrl)}" alt="">` +
      `<span class="cust-name">${ctx.escapeHtml(opt.label)}</span>` +
      `<span class="cust-tier">${ctx.escapeHtml(opt.raw.tier)}</span>`;
    return row;                            // DOM Node → safe
  },
  allowCreate: true,
  onCreate: (q) => ({ value: q, label: q }),
  // ctx = { query, active, escapeHtml }
  renderCreate: (q, ctx) => `➕ Add new customer “<strong>${ctx.escapeHtml(q)}</strong>”`,
});
```

The normalized option passed in is `{ value, label, sublabel, raw }`, where
`raw` is the original source record — use it for any fields beyond
label/sublabel. The `createLabel` option still works for a plain-text add row;
`renderCreate` supersedes it when both are set.

## Multiple selection

Set `multiple: true` for a tags/chips multi-select. Selections render as removable
chips; the value becomes an **array** throughout the API.

```js
const ms = new LiveSelect('#tags', {
  name: 'tags',
  multiple: true,
  source: ['react', 'vue', 'svelte', 'angular', 'solid'],
  maxItems: 3,                 // optional cap
  onChange: (values, options) => console.log(values), // ['react','vue']
});
ms.getValue();   // → ['react', 'vue']   (an array in multiple mode)
ms.setValue(['react', 'svelte']);        // value is an array too
```

- **Add**: click a row, or type + Enter. **Remove**: click a chip’s ×, or press
  Backspace on an empty input. Re-selecting a chosen row toggles it off.
- **Form submission** (`submitFormat`): `'repeat'` (default) emits one hidden
  input per value sharing `name` — exactly like a native `<select multiple>`, so
  Express/most frameworks parse `req.body.tags` as an array. `'bracket'` uses
  `name="tags[]"` (PHP/Rails); `'delimited'` joins into one input via `delimiter`.
- **`enhance()`** auto-upgrades a `<select multiple>` to this mode and keeps the
  original element’s selected options in sync.
- The `liveselect:change` detail carries `{ name, value: string[], options: [] }`.

## Grouped options

Render results under headings (like `<optgroup>`) by giving options a `group`
field, or by passing a `groupBy(option) => string` function (which takes
precedence). Results are **stably reordered** so same-group items sit together,
preserving the order each group was first seen — so your source doesn't have to
pre-sort.

```js
new LiveSelect('#picker', {
  source: [
    { value: 'ca', label: 'California', group: 'US' },
    { value: 'on', label: 'Ontario',    group: 'Canada' },
    { value: 'tx', label: 'Texas',      group: 'US' },
  ],
  // or, instead of per-option group:
  // groupBy: (opt) => opt.raw.country,
});
```

Group headings render as `.liveselect__group` (a non-selectable, sticky label) —
style them like any other token.

## Accessibility

The control implements the [ARIA combobox/listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

- the input is `role="combobox"` with `aria-expanded`, `aria-controls`, and
  `aria-autocomplete="list"`;
- the menu is `role="listbox"`; each row is `role="option"` with a stable `id`;
- the active row carries `aria-selected="true"` and the input's
  `aria-activedescendant` points at it, so arrow-key navigation is announced;
- a visually-hidden `aria-live="polite"` region announces result counts,
  “Searching…”, and the no-matches / create state.

Full keyboard support: ↑/↓ to move, Enter to select (or trigger `[+ Add]`),
Esc to close.

## Instance API

```
getValue() · getOption() · setValue(v, option?) · clear()
focus() · open() · close() · setSource(src) · setScope(obj)
setDisabled(bool) · destroy()
```

In **multiple** mode, `getValue()` returns an array of values, `getOption()` an
array of options, and `setValue()` accepts an array.

## Events

Besides the `onChange` callback, the control dispatches a **bubbling**
`liveselect:change` CustomEvent on its root element:

```js
form.addEventListener('liveselect:change', (e) => {
  console.log(e.detail); // { name, value, option }
});
```

It also emits bubbling lifecycle events for integration hooks:

| Event | Detail | Fires when |
|---|---|---|
| `liveselect:open` | `{ name }` | the menu opens |
| `liveselect:close` | `{ name }` | the menu closes |
| `liveselect:search` | `{ name, query }` | a search runs (after debounce / `minChars`) |
| `liveselect:change` | `{ name, value, option }` | a selection or clear happens (in multiple mode: `{ name, value: [], options: [] }`) |

## Validation

A `required` LiveSelect enforces selection through the **Constraint Validation
API on its visible input** — so an empty required control blocks form submit with
a focusable, on-screen validation bubble (override the message via
`texts.required`). This also fixes `enhance()`: a `display:none` required
`<select>` can’t be focused (browsers reject submit with “An invalid form control
is not focusable”), so `enhance()` moves enforcement to the visible control.

## Theming

Override any token, globally or scoped to one control:

```css
.liveselect { --liveselect-border: #7c3aed; --liveselect-accent: #7c3aed; --liveselect-radius: 14px; }
```

Add `class="liveselect--dark"` for the built-in dark theme. Full token list is at the
top of `dist/liveselect.css`.

## Tests

```bash
npm install   # dev deps only: express, mongodb, mongodb-memory-server, jsdom
npm test      # Node's built-in runner (node --test)
```

The suite (in `test/`) covers the client in jsdom (HTML-escaping/XSS, the hidden
input form mirror, `liveselect:change`, `enhance()`, templates, a11y wiring,
grouping, validation, and multiple selection), the pure server helpers, and the
router against an in-memory MongoDB — including the security regressions from the
audit (no document disclosure, generic errors, NoSQL operator-injection,
allow-listing, dedup). CI runs them on Node 18/20/22/24 (`.github/workflows/ci.yml`).
The library itself ships with **zero runtime dependencies**.

## Releasing

Releases are **tag-driven** — pushing a `vX.Y.Z` git tag is the single action that
publishes to npm and keeps GitHub and the registry in sync. The
[`publish.yml`](./.github/workflows/publish.yml) workflow runs the tests,
verifies the tag matches `package.json`, and runs `npm publish --provenance`
using the `NPM_TOKEN` repository secret (an npm **automation** token, which
bypasses 2FA so CI can publish non-interactively).

To cut a release:

```bash
# 1. Bump the version + add a CHANGELOG entry, land it on main (PR or direct).
npm version 3.2.0 --no-git-tag-version   # or edit package.json by hand
# 2. Commit, push to main, then tag and push the tag:
git tag -a v3.2.0 -m "v3.2.0: <summary>"
git push origin main
git push origin v3.2.0                    # ← this triggers the publish workflow
```

The tag must point at a commit on `main` (clean provenance), and its version
must equal `package.json`'s — CI fails the release if they differ. A plain
`git push` of code (no tag) never publishes; only `v*` tags and the manual
**workflow_dispatch** trigger do.

> **Local publish** is supported too but not the normal path. It needs the
> automation token in `~/.npmrc` (e.g. `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`
> with `NPM_TOKEN` exported). Avoid `npm login` — it overwrites the token with a
> web session that re-introduces the interactive 2FA prompt.

## Repository layout

```
dist/
  liveselect.js        # UMD core (script tag / require)
  liveselect.mjs       # ES-module entry
  liveselect.css       # themeable styles
  liveselect-auto.js   # optional declarative data-* auto-mount
server/
  liveselect-mongo.js  # Express + MongoDB backend (registry + router)
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
