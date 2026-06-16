# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-06-16

First public release — a framework-agnostic, dependency-free searchable dropdown
extracted and hardened from the Meteor/Blaze `dispatchSelect` picker.

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

[1.0.0]: https://github.com/michaeljfalk/searchable-dropdown/releases/tag/v1.0.0
