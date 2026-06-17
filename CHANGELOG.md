# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [4.0.2] - 2026-06-17

### Docs
- SECURITY.md: updated the supported-versions table to 4.x and fixed the
  cross-reference to the security model (now `IMPLEMENTATION.md §9`). No code changes.

## [4.0.1] - 2026-06-17

### Docs
- End-to-end consistency pass for the v4 API. No code changes.
- IMPLEMENTATION.md: added a "Multiple selection" section (chips, array value,
  `submitFormat` table); noted `enhance()`'s `<select multiple>` auto-upgrade;
  corrected the search-route response shape to `{ value, label, sublabel }`
  (raw is opt-in via `exposeRaw`); documented automatic `AbortSignal`
  cancellation and `cache: true`; and rewrote the "required" note — required now
  blocks submit via the Constraint Validation API (since 3.3.0), not cosmetic.
- README.md: corrected the bundle-size figure (~14 KB gzipped JS + ~2 KB CSS)
  and the CI Node matrix (18/20/22/24).

## [4.0.0] - 2026-06-17

Headline feature release — **multiple selection**. The major version marks the
size of the addition; **there are no breaking changes to single-select usage**
(everything new is gated behind `multiple: true`).

### Added
- **Multiple selection (`multiple: true`).** Selections render as removable chips:
  - **Add** by clicking a row or typing + Enter; **remove** via a chip’s × or
    Backspace on an empty input; re-selecting a chosen row toggles it off.
  - The value is an **array** throughout: `getValue()` → `string[]`,
    `getOption()` → `option[]`, `onChange(values, options)`, `setValue([...])`,
    and `liveselect:change` detail `{ name, value: [], options: [] }`.
  - **`maxItems`** caps selections (and suppresses the create row at the cap).
  - **`submitFormat`** controls plain-form submission: `'repeat'` (default — one
    hidden input per value sharing the name, like native `<select multiple>`),
    `'bracket'` (`name[]`), or `'delimited'` (one input joined by `delimiter`).
  - Chosen rows are marked `aria-selected` + `.liveselect__opt--chosen`; the
    listbox is `aria-multiselectable`.
  - **`enhance()`** auto-detects `<select multiple>`, upgrades to multi mode, and
    keeps the original element’s selected options in sync.

### Changed
- `normalizeOption` output is unchanged; no API removed. Single-select code paths
  are byte-for-byte compatible.

## [3.3.0] - 2026-06-17

### Added
- **Disabled options.** A per-option `disabled: true` makes a row non-selectable:
  dimmed, `aria-disabled`, skipped by keyboard navigation, and ignored on click/Enter.
- **`required` form validation.** Required controls now enforce selection via the
  Constraint Validation API on the *visible* input, so an empty required control
  blocks form submit with a focusable, on-screen validation bubble (message via
  `texts.required`). This also makes `enhance()`’s `required` actually enforce —
  previously it was dropped because a `display:none` `<select>` isn’t focusable.
- **Match highlighting.** `highlight: true` wraps the matched query substring in
  each result’s label/sublabel with `<mark class="liveselect__mark">` (built from
  text nodes — still XSS-safe). Ignored for `renderOption` rows.
- **“Showing N of M” footer.** When results are capped by `limit`, a footer shows
  the count. Array sources compute the total automatically; async sources can
  return `{ items, total }`. Customize via `texts.more(shown, total)`.
- **Lifecycle events.** Bubbling `liveselect:open`, `liveselect:close`, and
  `liveselect:search` ({ query }) CustomEvents, alongside `liveselect:change`.
- **Async result caching.** `cache: true` memoizes async results by
  query+scope+limit so repeat queries skip the network. Cleared by
  `setSource()` / `setScope()`.

### Changed
- `normalizeOption` output now includes a `disabled` field (`false` when absent).

## [3.2.0] - 2026-06-17

### Added
- **Accessibility (ARIA combobox/listbox pattern).** Options now get stable `id`s;
  the active row carries `aria-selected` and is referenced by the input's
  `aria-activedescendant`; the input gains `aria-controls` / `aria-haspopup`; and a
  visually-hidden `aria-live="polite"` region announces result counts, “Searching…”,
  and the no-matches/create state. Keyboard nav is now announced to screen readers.
- **AbortSignal for async sources.** The async `source` `ctx` now includes a real
  `signal` (`{ scope, limit, query, signal }`). A newer search aborts the previous
  one's signal, and the built-in `remoteSource` passes it to `fetch`, so stale
  in-flight requests are cancelled rather than merely ignored. (`destroy()` also
  aborts any in-flight request.)
- **Grouped options.** Pass a `groupBy(option) => string` function or a per-option
  `group` field to render `<optgroup>`-style headings (`.liveselect__group`).
  Results are stably reordered so same-group items sit together.

### Changed
- `normalizeOption` output now includes a `group` field (`''` when absent).

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
