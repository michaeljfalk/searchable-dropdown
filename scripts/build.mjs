/**
 * build.mjs — produces the distributable dist/ artifacts from a single source
 * of truth (src/liveselect.js) using esbuild. esbuild is a dev-only tool; the
 * shipped library keeps ZERO runtime dependencies.
 *
 * Outputs (in dist/):
 *   liveselect.mjs   real ES module — `export default` the class directly.
 *                    This is what the package `exports.import` condition points
 *                    at, so bundlers (rspack/webpack/Vite) and browser-native
 *                    ESM get the actual class, never `undefined`.
 *   liveselect.js    UMD — works as a <script> tag (sets window.LiveSelect) AND
 *                    via require() (module.exports = class). Single file, the
 *                    `exports.require` + `main` target.
 *
 * NOT generated here (hand-authored static assets that ship as-is):
 *   liveselect.css        the stylesheet
 *   liveselect-auto.js    script-tag-only declarative auto-mounter (it reads the
 *                         global by design — its contract is "load liveselect.js
 *                         first"; it is not part of the dual ESM/CJS surface).
 */

import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'src', 'liveselect.js');
const dist = join(root, 'dist');

const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const credit = `/*! @michaeljfalk/liveselect v${version} | MIT License | https://github.com/michaeljfalk/liveselect */`;

const common = {
  entryPoints: [entry],
  bundle: true,
  logLevel: 'info',
  target: ['es2017'],
};

// --- ESM: a genuine module whose default export IS the class. -------------
await build({
  ...common,
  format: 'esm',
  banner: { js: credit },
  outfile: join(dist, 'liveselect.mjs'),
});

// --- UMD: <script> global + require(), one self-contained file. -----------
// esbuild has no native UMD format, so we build an IIFE that captures every
// export on a temporary global and wrap it in the classic UMD preamble. The
// factory returns the namespace's default (the class, which already carries
// its own static helpers normalizeOption/escapeHtml/remoteSource).
const GLOBAL = '__liveselect__';
await build({
  ...common,
  format: 'iife',
  globalName: GLOBAL,
  banner: {
    js: `${credit}
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiveSelect = factory();
}(typeof self !== 'undefined' ? self : this, function () {`,
  },
  footer: {
    js: `  return ${GLOBAL}.default;
}));`,
  },
  outfile: join(dist, 'liveselect.js'),
});

console.log('\nBuilt dist/liveselect.mjs (ESM) and dist/liveselect.js (UMD) from src/liveselect.js');
