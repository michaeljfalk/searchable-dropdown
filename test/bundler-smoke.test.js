/**
 * bundler-smoke.test.js — proves the library is consumable through every entry
 * point, and specifically that the ESM/bundler path yields the real class.
 *
 * THE BUG THIS GUARDS AGAINST (was shipped in 4.0.3): the `exports.import`
 * target was a shim that re-read `globalThis.LiveSelect`. Under any bundler
 * (rspack/webpack/Vite/Meteor) `import LiveSelect from '@michaeljfalk/liveselect'`
 * resolved to `undefined`, so `new LiveSelect(...)` threw "not a constructor".
 *
 * Strategy: bundle a trivial `import LiveSelect from '@michaeljfalk/liveselect'`
 * entry with esbuild in `--bundle --format=esm` mode. esbuild resolving the
 * package by name and honoring the `exports.import` condition is a faithful
 * stand-in for a real bundler — if the ESM target is a global-alias shim, the
 * bundled output's default export is `undefined` and the construct assert fails.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const PKG = require(path.join(ROOT, 'package.json'));

// jsdom lets the constructed control touch document.* like a browser does.
let domAvailable = true;
try {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
} catch (e) {
  domAvailable = false;
}

function mount() {
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  return el;
}

// Make `@michaeljfalk/liveselect` resolvable to THIS checkout, so esbuild (and
// require below) walk the published `exports` map exactly as a consumer would.
function ensureSelfLink() {
  const scope = path.join(ROOT, 'node_modules', '@michaeljfalk');
  const link = path.join(scope, 'liveselect');
  fs.mkdirSync(scope, { recursive: true });
  try {
    const cur = fs.readlinkSync(link);
    if (path.resolve(scope, cur) === ROOT) return; // already correct
    fs.unlinkSync(link);
  } catch (e) { /* missing or not a symlink */ }
  try { fs.rmSync(link, { recursive: true, force: true }); } catch (e) {}
  fs.symlinkSync(ROOT, link, 'dir');
}

test('exports.import resolves to a real ESM class under a bundler', async (t) => {
  if (!domAvailable) return t.skip('jsdom not available');

  const esbuild = require('esbuild');
  ensureSelfLink();

  // Entry must live inside the package tree so node_modules resolution applies.
  const tmp = fs.mkdtempSync(path.join(ROOT, 'test', '.smoke-'));
  const entry = path.join(tmp, 'entry.mjs');
  const outfile = path.join(tmp, 'out.mjs');
  // Reference the statics off the default export so the bundler treats them as
  // used (a consumer who calls LiveSelect.normalizeOption keeps them; one who
  // never touches them lets the bundler tree-shake them away — both correct).
  fs.writeFileSync(
    entry,
    `import LiveSelect, { LiveSelect as Named, normalizeOption, escapeHtml } ` +
    `from '${PKG.name}';\n` +
    `export const staticNormalize = LiveSelect.normalizeOption;\n` +
    `export const staticEscape = LiveSelect.escapeHtml;\n` +
    `export default LiveSelect;\n` +
    `export { Named, normalizeOption, escapeHtml };\n`,
  );

  try {
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      // Default conditions already include "import"; be explicit for clarity.
      conditions: ['import'],
      outfile,
      logLevel: 'silent',
    });

    const mod = await import(pathToFileURL(outfile).href);

    assert.equal(typeof mod.default, 'function', 'default export must be the class');
    assert.equal(mod.Named, mod.default, 'named LiveSelect === default');
    assert.equal(typeof mod.normalizeOption, 'function', 'named normalizeOption export present');
    assert.equal(typeof mod.escapeHtml, 'function', 'named escapeHtml export present');

    // The actual symptom of the bug: this throws "not a constructor" on the shim.
    const inst = new mod.default(mount(), { source: [{ value: 'a', label: 'A' }] });
    assert.ok(inst, 'new LiveSelect(...) constructs');
    assert.equal(typeof mod.staticNormalize, 'function', 'static normalizeOption survives bundling when used');
    assert.equal(typeof mod.staticEscape, 'function', 'static escapeHtml survives bundling when used');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('shipped dist/liveselect.mjs is a real module that carries the statics', () => {
  // Guards the published artifact directly (independent of any re-bundling DCE):
  // it must define the implementation and attach the static helpers, not alias
  // a global the way the 4.0.3 shim did.
  const mjs = fs.readFileSync(path.join(ROOT, 'dist', 'liveselect.mjs'), 'utf8');
  assert.match(mjs, /LiveSelect\.normalizeOption\s*=/, 'static normalizeOption present');
  assert.match(mjs, /LiveSelect\.escapeHtml\s*=/, 'static escapeHtml present');
  assert.match(mjs, /export\s*\{[\s\S]*default[\s\S]*\}/, 'has a default export');
  assert.doesNotMatch(mjs, /globalThis\)\.LiveSelect|self\s*:\s*globalThis\)\.LiveSelect/, 'must not alias a global');
});

test('require() (CJS / exports.require) yields the class', () => {
  // Fresh require off the resolved package name walks exports.require → UMD.
  ensureSelfLink();
  const required = require(PKG.name);
  assert.equal(typeof required, 'function', 'require() returns the class');
  assert.equal(typeof required.normalizeOption, 'function');
  assert.equal(typeof required.escapeHtml, 'function');
  assert.equal(typeof required.remoteSource, 'function');
});

test('<script> tag (UMD global) sets window.LiveSelect to the class', () => {
  // Simulate a browser <script>: no CommonJS `module`/`define` in scope, so the
  // UMD wrapper takes the `root.LiveSelect = factory()` branch.
  const vm = require('node:vm');
  const code = fs.readFileSync(path.join(ROOT, 'dist', 'liveselect.js'), 'utf8');
  const root = {};
  const sandbox = { self: root, window: root, document: global.document };
  vm.runInNewContext(code, sandbox);
  assert.equal(typeof root.LiveSelect, 'function', 'window.LiveSelect is the class');
  assert.equal(typeof root.LiveSelect.normalizeOption, 'function');
});
