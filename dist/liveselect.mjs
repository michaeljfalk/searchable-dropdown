/**
 * liveselect.mjs — ES-module entry point.
 *
 * The implementation lives in the dependency-free UMD file so it can also load
 * via a plain <script> tag. When imported as a module here, that file runs and
 * assigns the class to the global; we re-export it as the default + named.
 */
import './liveselect.js';

const LiveSelect = (typeof self !== 'undefined' ? self : globalThis).LiveSelect;

export default LiveSelect;
export { LiveSelect };
