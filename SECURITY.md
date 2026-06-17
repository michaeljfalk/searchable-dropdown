# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for
anything exploitable.

- Preferred: open a [GitHub private security advisory](https://github.com/michaeljfalk/liveselect/security/advisories/new).
- Or email **michael@co-pilot.ca** with details and, ideally, a reproduction.

You can expect an initial acknowledgement within a few business days. Once a fix
is available we'll credit you (unless you prefer otherwise) in the release notes.

## Supported versions

| Version | Supported |
|---------|-----------|
| 4.x     | ✅        |
| < 4.0   | ❌        |

## Security model (what this library does and doesn't guarantee)

The browser control escapes all data-derived content it renders (option labels,
sublabels, the typed query, messages) and never injects untrusted HTML.

The MongoDB/Express backend (`server/liveselect-mongo.js`) enforces:

- registry-gated access — the client sends a **key**, never a collection or
  field name; unknown keys → 404;
- field allow-listing for search and create (defeats mass-assignment);
- regex escaping + length cap on search terms (ReDoS guard);
- scope filters limited to declared keys; non-string/array scope values (e.g.
  injected operators) are ignored;
- prototype-pollution guards on every dynamic key write;
- no full-document disclosure — responses contain only `{ value, label,
  sublabel }` unless you opt into `exposeRaw` (pair it with `projection`);
- generic client error messages (internals are logged server-side only).

**The consumer is responsible for** authentication (`authorize` middleware),
CSRF protection on `POST /create`, rate limiting on `/search`, transport
security (HTTPS), and appropriate database indexes. See `IMPLEMENTATION.md §9`.
Mounting the router without `authorize` and without `tenantFilter` exposes the
whole collection by design — opt into protection deliberately.
