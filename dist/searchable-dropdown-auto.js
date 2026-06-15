/**
 * searchable-dropdown-auto.js — declarative auto-mount helper (optional).
 *
 * WHAT: Lets server templates (EJS, Blaze, plain HTML) create a dropdown with
 *       NO inline JavaScript — you just render a <div> with data-* attributes
 *       and this script wires it up on DOMContentLoaded. This avoids injecting
 *       server data into <script> tags (an XSS footgun) entirely: all values
 *       travel as HTML-escaped attributes and are read back via dataset.
 *
 * LOAD ORDER: include searchable-dropdown.js first, then this file.
 *
 * MARKUP:
 *   <div data-sdd-mount
 *        data-name="customerId"
 *        data-label="Customer"
 *        data-placeholder="Search customers…"
 *        data-api-base="/api/dropdown"      <!-- async/Mongo source -->
 *        data-api-key="customers"
 *        data-allow-create="true"
 *        data-value="<existing id>"          <!-- optional, edit mode -->
 *        data-value-label="<existing label>"
 *        data-options='[{"value":"a","label":"A"}]'  <!-- OR a static array source -->
 *   ></div>
 *
 * Provide EITHER data-api-base + data-api-key (remote) OR data-options (array).
 * Each mounted element gets `el._sdd` set to its SearchableDropdown instance.
 */
(function () {
  'use strict';

  function bool(v) { return v === '' || v === 'true' || v === '1'; }

  function mountOne(el) {
    if (el._sdd) return; // already mounted
    var SD = (typeof self !== 'undefined' ? self : window).SearchableDropdown;
    if (!SD) { if (typeof console !== 'undefined') console.error('searchable-dropdown.js must load before -auto.js'); return; }

    var d = el.dataset;
    var opts = {
      name:        d.name || '',
      label:       d.label || '',
      placeholder: d.placeholder || 'Search…',
      value:       d.value || '',
      valueLabel:  d.valueLabel || '',
      required:    bool(d.required),
      disabled:    bool(d.disabled),
      allowCreate: bool(d.allowCreate),
    };
    if (d.createLabel) opts.createLabel = function () { return d.createLabel; };

    if (d.apiBase && d.apiKey) {
      // Remote / MongoDB-backed source.
      var api = SD.remoteSource({ baseUrl: d.apiBase, key: d.apiKey, create: opts.allowCreate });
      opts.source   = api.source;
      opts.resolve  = api.resolve;
      if (opts.allowCreate) opts.onCreate = api.onCreate;
    } else if (d.options) {
      // Static array source (JSON in a data attribute — safe, HTML-escaped).
      try { opts.source = JSON.parse(d.options); } catch (e) { opts.source = []; }
    } else {
      opts.source = [];
    }

    el._sdd = new SD(el, opts);
  }

  function mountAll(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-sdd-mount]');
    for (var i = 0; i < nodes.length; i++) mountOne(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mountAll(); });
  } else {
    mountAll();
  }

  // Expose for dynamic content (e.g. after AJAX inserts new markup).
  (typeof self !== 'undefined' ? self : window).SearchableDropdownAuto = { mountAll: mountAll, mountOne: mountOne };
}());
