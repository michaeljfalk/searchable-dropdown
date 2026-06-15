/**
 * searchable-dropdown.mjs — ES-module entry point.
 *
 * The implementation lives in the dependency-free UMD file so it can also load
 * via a plain <script> tag. When imported as a module here, that file runs and
 * assigns the class to the global; we re-export it as the default + named.
 */
import './searchable-dropdown.js';

const SearchableDropdown = (typeof self !== 'undefined' ? self : globalThis).SearchableDropdown;

export default SearchableDropdown;
export { SearchableDropdown };
