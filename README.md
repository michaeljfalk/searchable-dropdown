# searchable-dropdown

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

No build step. Copy the `dist/` folder into your project and reference the files:

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
IMPLEMENTATION.md               # full integration guide
```

## License

MIT
