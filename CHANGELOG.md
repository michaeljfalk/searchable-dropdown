# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [3.1.0] - 2026-06-17

### Added
- **Custom item templates.** New `renderOption(option, ctx)` and
  `renderCreate(query, ctx)` options let you render arbitrary content for each
  result row and for the `[+ Add]` row. Each may return a DOM `Node` (XSS-safe),
  an HTML string (you own escaping — `ctx.escapeHtml` / `LiveSelect.escapeHtml`
  provided), or `null` to fall back to the default escaped label/sublabel. The
  control still owns the outer `<button>`, so ARIA roles, keyboard navigation,
  and click handling are unchanged.
- Exposed `LiveSelect.escapeHtml` for use inside string-returning templates.

### Changed
- The dropdown menu now builds its rows as DOM nodes rather than one `innerHTML`
  string. Behavior and the default escaped rendering are unchanged.

## [3.0.0] - 2026-06-16

### Changed (breaking)
- **Renamed the CSS class prefix `sdd` → `liveselect`.** All BEM classes change
  (e.g. `sdd__opt` → `liveselect__opt`, `sdd--open` → `liveselect--open`,
  `sdd--dark` → `liveselect--dark`). Update any custom stylesheets. The
  `classPrefix` option default is now `'liveselect'`.
- **Renamed the CSS custom properties `--sdd-*` → `--liveselect-*`** (e.g.
  `--sdd-border` → `--liveselect-border`). Update theme overrides.
- **Renamed the change event `sdd:change` → `liveselect:change`.** Update
  `addEventListener` calls.
- **Renamed the declarative auto-mount attribute `data-sdd-mount` →
  `data-liveselect-mount`** (and the internal `data-sdd-*` selectors). The
  config attributes (`data-name`, `data-label`, `data-api-*`, …) are unchanged.

With this the package is fully consistent under the `liveselect` name — no
`sdd`/`SearchableDropdown` identifiers remain in the public surface.

## [2.0.0] - 2026-06-16

### Changed (breaking)
- **Renamed the exported class / global `SearchableDropdown` → `LiveSelect`.**
  Update call sites: `new LiveSelect(...)`, `LiveSelect.enhance(...)`,
  `LiveSelect.remoteSource(...)`, and `window.LiveSelect` for the script-tag
  global. There is no backward-compatible alias.
- **Renamed the server router factory `createSearchableDropdownRouter` →
  `createLiveSelectRouter`** and the auto-mount global
  `SearchableDropdownAuto` → `LiveSelectAuto`.
- **Renamed the distributed files** for brand consistency:
  - `dist/searchable-dropdown.js` → `dist/liveselect.js`
  - `dist/searchable-dropdown.mjs` → `dist/liveselect.mjs`
  - `dist/searchable-dropdown.css` → `dist/liveselect.css`
  - `dist/searchable-dropdown-auto.js` → `dist/liveselect-auto.js`
  - `server/searchable-dropdown-mongo.js` → `server/liveselect-mongo.js`

  Package consumers importing `@michaeljfalk/liveselect` (and its `/css`,
  `/auto`, `/server` subpaths) are unaffected — the `exports` map is updated.
  Script-tag / copy-the-file users must update their `src`/`href` paths.

### Unchanged
- The CSS class prefix (`sdd`) and the `sdd:change` event name are kept, so
  existing stylesheets and event listeners continue to work.

## [1.0.0] - 2026-06-16

First public release — a framework-agnostic, dependency-free searchable dropdown
/ combobox.

### Added
- **Browser control** (`dist/searchable-dropdown.js`, UMD + `.mjs` ESM entry):
  live debounced search, keyboard navigation, two-line options, clear button,
  controlled/uncontrolled value, hidden-input form mirroring, and a bubbling
  `sdd:change` event.
- **Data sources** — plain arrays (filtered locally) or an async function
  (`(query, ctx) => options[]`) for MongoDB/REST/anything.
- **`[+ Add new]` create flow** via `allowCreate` + `onCreate` (open a modal,
  POST to a server, push to an array — return an option to auto-select it).
- **`SearchableDropdown.enhance(selectEl)`** — drop-in upgrade of a native
  `<select>` with selection synced back into the original element.
- **`SearchableDropdown.remoteSource(...)`** — wires `source`/`resolve`/`onCreate`
  to the HTTP backend.
- **Declarative auto-mount** (`dist/searchable-dropdown-auto.js`) — build a
  control from `data-*` attributes with no inline JS (XSS-safe in templates).
- **Themeable CSS** (`dist/searchable-dropdown.css`) — `--sdd-*` custom
  properties + a built-in dark theme.
- **Security-hardened MongoDB/Express backend**
  (`server/searchable-dropdown-mongo.js`): registry + router with field
  allow-listing, ReDoS-capped regex, scope filters, tenant-isolation hook,
  prototype-pollution guards, opt-in `exposeRaw` + `projection`, and generic
  error responses.
- **Examples** — vanilla HTML, Express + MongoDB + EJS (zero-setup via in-memory
  MongoDB fallback), and a Blaze adapter.
- **Test suite** (`test/`, Node `--test`): client (jsdom) + server (in-memory
  MongoDB) covering the audited security guarantees. CI on Node 18/20/22.
- Documentation: `README.md`, `IMPLEMENTATION.md`, `SECURITY.md`.

[3.0.0]: https://github.com/michaeljfalk/liveselect/releases/tag/v3.0.0
[2.0.0]: https://github.com/michaeljfalk/liveselect/releases/tag/v2.0.0
[1.0.0]: https://github.com/michaeljfalk/liveselect/releases/tag/v1.0.0
