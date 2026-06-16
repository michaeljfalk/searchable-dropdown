/**
 * liveselect.js — framework-agnostic, dependency-free combobox.
 *
 * WHAT: One control that replaces a normal <select> with a searchable,
 *       keyboard-navigable dropdown. It can read options from a plain array OR
 *       from an async source (e.g. a MongoDB-backed HTTP endpoint), shows an
 *       optional "+ Add new…" row when the typed text has no match, and mirrors
 *       its value into a hidden <input> so it submits inside a plain <form> just
 *       like a native select.
 *
 * HOW:  A single vanilla-JS class with zero dependencies. State lives on the
 *       instance; the menu re-renders on change while the <input> persists so
 *       focus/caret are never lost. Selection is emitted two ways: a bubbling
 *       `sdd:change` CustomEvent AND an optional `onChange(value, option)`
 *       callback. The control can be "controlled" (you pass `value`) or
 *       uncontrolled (you omit it and listen for changes).
 *
 * USAGE (script tag):
 *       <script src="liveselect.js"></script>
 *       new LiveSelect('#picker', { source: [...] });
 *
 * USAGE (ES module / bundler):
 *       import LiveSelect from './liveselect.mjs';
 *
 * OPTIONS (all optional unless noted):
 *   source        (required) Array<option|string> OR
 *                 async (query, ctx) => Array<option>.  ctx = { scope, limit, signal }
 *   name          hidden-input name for plain-form usage
 *   value         initial/controlled selected value
 *   valueLabel    label for `value` (skips a resolve round-trip in edit mode)
 *   resolve       async (value, ctx) => option|null — resolve a value to an option
 *                 (used for controlled value with an async source and no valueLabel)
 *   placeholder   placeholder text when empty
 *   label         field label rendered above the control
 *   required      boolean — adds the "*" marker and the hidden input's required attr
 *   disabled      boolean
 *   clearable     show the "×" clear button when something is selected (default true)
 *   openOnFocus   open + run an empty search on focus (default true)
 *   minChars      min query length before searching (default 0)
 *   debounce      ms to debounce async/array search (default 250)
 *   limit         max results requested/shown (default 20)
 *   scope         object passed to the async source / onCreate as ctx.scope
 *   allowCreate   show the "+ Add" row when no exact match (default false)
 *   createLabel   (query) => string for the add row (default: `+ Add "query"`)
 *   onCreate      async (query, ctx) => option|null — do ANYTHING (open a modal,
 *                 POST to a server, push to the array); return the new option to
 *                 auto-select it, or null to cancel.
 *   onChange      (value, option) => void — called on every selection/clear
 *   classPrefix   CSS class prefix (default 'sdd')
 *   texts         { searching, noResults, searchFailed } message overrides
 *
 * The option shape the control works in:  { value, label, sublabel?, raw? }
 * Input options are normalized leniently: a bare string becomes
 * { value: s, label: s }; `_id`/`id` map to `value`; `name`/`title`/`text` map
 * to `label`.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiveSelect = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BLUR_CLOSE_MS = 150;

  var DEFAULT_TEXTS = {
    searching:    'Searching…',
    noResults:    'No matches.',
    searchFailed: 'Search failed.',
  };

  // ---- helpers -------------------------------------------------------------

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Coerce any loose input into the canonical { value, label, sublabel, raw }. */
  function normalizeOption(o) {
    if (o == null) return null;
    if (typeof o === 'string' || typeof o === 'number') {
      return { value: String(o), label: String(o), sublabel: '', raw: o };
    }
    var value = o.value != null ? o.value
      : (o._id != null ? o._id : (o.id != null ? o.id : ''));
    var label = o.label != null ? o.label
      : (o.name != null ? o.name : (o.title != null ? o.title : (o.text != null ? o.text : value)));
    return {
      value:    value == null ? '' : String(value),
      label:    label == null || label === '' ? '(unnamed)' : String(label),
      sublabel: o.sublabel != null ? String(o.sublabel) : '',
      raw:      Object.prototype.hasOwnProperty.call(o, 'raw') ? o.raw : o,
    };
  }

  function normalizeList(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var n = normalizeOption(list[i]);
      if (n) out.push(n);
    }
    return out;
  }

  function resolveEl(elementOrSelector) {
    if (typeof elementOrSelector === 'string') {
      return document.querySelector(elementOrSelector);
    }
    return elementOrSelector || null;
  }

  // ---- class ---------------------------------------------------------------

  function LiveSelect(elementOrSelector, options) {
    var host = resolveEl(elementOrSelector);
    if (!host) throw new Error('LiveSelect: mount element not found.');

    this.opts = options || {};
    this.host = host;
    this.cp   = this.opts.classPrefix || 'sdd';
    this.texts = Object.assign({}, DEFAULT_TEXTS, this.opts.texts || {});

    // state
    this.query       = '';
    this.results     = [];
    this.isOpen      = false;
    this.loading     = false;
    this.error       = '';
    this.activeIndex = -1;
    this.selected    = null;
    this._appliedValue = undefined;
    this._debounce   = null;
    this._blurTimer  = null;
    this._reqSeq     = 0;

    this._build();
    this._bind();

    // Initial / controlled value
    if ('value' in this.opts) {
      this.setValue(this.opts.value, this.opts.valueLabel != null
        ? { value: this.opts.value, label: this.opts.valueLabel, sublabel: this.opts.valueSublabel || '' }
        : undefined);
    }
  }

  LiveSelect.prototype._c = function (suffix) {
    return suffix ? this.cp + '__' + suffix : this.cp;
  };

  // -- DOM construction ------------------------------------------------------

  LiveSelect.prototype._build = function () {
    var cp = this.cp;
    var o  = this.opts;

    var root = document.createElement('div');
    root.className = cp;
    root.setAttribute('data-sdd', '');
    if (o.disabled) root.classList.add(cp + '--disabled');

    var labelHtml = '';
    if (o.label) {
      labelHtml = '<span class="' + cp + '__label">' + escapeHtml(o.label)
        + (o.required ? ' <span class="' + cp + '__req">*</span>' : '') + '</span>';
    }

    root.innerHTML =
      labelHtml +
      '<div class="' + cp + '__control">' +
        '<input type="text" class="' + cp + '__input" autocomplete="off" spellcheck="false"' +
          (o.disabled ? ' disabled' : '') +
          ' placeholder="' + escapeHtml(o.placeholder || 'Search…') + '"' +
          ' role="combobox" aria-expanded="false" aria-autocomplete="list" data-sdd-input>' +
        '<button type="button" class="' + cp + '__clear" data-sdd-clear aria-label="Clear selection" hidden>&times;</button>' +
        '<div class="' + cp + '__menu" role="listbox" data-sdd-menu hidden></div>' +
      '</div>' +
      '<span class="' + cp + '__error" data-sdd-error hidden></span>' +
      '<input type="hidden" data-sdd-hidden' +
        (o.name ? ' name="' + escapeHtml(o.name) + '"' : '') +
        (o.required ? ' required' : '') + ' value="">';

    this.host.appendChild(root);
    this.root    = root;
    this.input   = root.querySelector('[data-sdd-input]');
    this.clearEl = root.querySelector('[data-sdd-clear]');
    this.menu    = root.querySelector('[data-sdd-menu]');
    this.errorEl = root.querySelector('[data-sdd-error]');
    this.hidden  = root.querySelector('[data-sdd-hidden]');
  };

  // -- event binding ---------------------------------------------------------

  LiveSelect.prototype._bind = function () {
    var self = this;

    this._onInput = function (e) {
      self.query = e.target.value;
      self._setOpen(true);
      self._scheduleSearch();
    };
    this._onFocus = function () {
      if (self.opts.disabled) return;
      self._setOpen(true);
      if (self.opts.openOnFocus !== false && !self.results.length) self._runSearch();
    };
    this._onBlur = function () {
      clearTimeout(self._blurTimer);
      self._blurTimer = setTimeout(function () { self._setOpen(false); self._syncInput(); }, BLUR_CLOSE_MS);
    };
    this._onKeydown = function (e) { self._handleKeydown(e); };

    // mousedown (not click) so it fires before the input's blur closes the menu
    this._onMenuDown = function (e) {
      var optEl = e.target.closest('[data-sdd-opt]');
      var createEl = e.target.closest('[data-sdd-create]');
      if (optEl) {
        e.preventDefault();
        var opt = self.results[Number(optEl.getAttribute('data-sdd-index'))];
        if (opt) self._select(opt);
      } else if (createEl) {
        e.preventDefault();
        self._openCreate();
      }
    };
    this._onClearDown = function (e) { e.preventDefault(); self.clear(); };

    this.input.addEventListener('input', this._onInput);
    this.input.addEventListener('focus', this._onFocus);
    this.input.addEventListener('blur', this._onBlur);
    this.input.addEventListener('keydown', this._onKeydown);
    this.menu.addEventListener('mousedown', this._onMenuDown);
    this.clearEl.addEventListener('mousedown', this._onClearDown);
  };

  // -- searching -------------------------------------------------------------

  LiveSelect.prototype._scheduleSearch = function () {
    var self = this;
    if (this._debounce) clearTimeout(this._debounce);
    this._debounce = setTimeout(function () { self._runSearch(); }, this.opts.debounce != null ? this.opts.debounce : 250);
  };

  LiveSelect.prototype._runSearch = function () {
    var self  = this;
    var q     = this.query.trim();
    var limit = this.opts.limit || 20;
    var minChars = this.opts.minChars || 0;

    if (q.length < minChars) {
      this.results = [];
      this.activeIndex = -1;
      this._renderMenu();
      return;
    }

    var src = this.opts.source;

    // Array source → filter locally (synchronous).
    if (Array.isArray(src)) {
      var all = normalizeList(src);
      var ql  = q.toLowerCase();
      var filtered = !ql ? all : all.filter(function (o) {
        return o.label.toLowerCase().indexOf(ql) !== -1
          || (o.sublabel && o.sublabel.toLowerCase().indexOf(ql) !== -1);
      });
      this.error = '';
      this.results = filtered.slice(0, limit);
      this.activeIndex = -1;
      this._renderMenu();
      return;
    }

    // Async source → call function, guard against out-of-order responses.
    if (typeof src === 'function') {
      var seq = ++this._reqSeq;
      this.loading = true;
      this.error = '';
      this._renderMenu();
      var ctx = { scope: this.opts.scope || {}, limit: limit, query: q };
      Promise.resolve(src(q, ctx))
        .then(function (res) {
          if (seq !== self._reqSeq) return; // a newer search superseded this one
          self.loading = false;
          self.results = normalizeList(res).slice(0, limit);
          self.activeIndex = -1;
          self._renderMenu();
        })
        .catch(function (err) {
          if (seq !== self._reqSeq) return;
          self.loading = false;
          self.results = [];
          self.error = (err && (err.message || err.reason)) || self.texts.searchFailed;
          self._renderMenu();
          self._renderError();
        });
      return;
    }

    // No usable source.
    this.results = [];
    this._renderMenu();
  };

  // -- create row ------------------------------------------------------------

  LiveSelect.prototype._canCreate = function () {
    if (!this.opts.allowCreate || typeof this.opts.onCreate !== 'function') return false;
    var q = this.query.trim();
    if (!q) return false;
    var ql = q.toLowerCase();
    var exact = this.results.some(function (o) {
      return o.label.trim().toLowerCase() === ql || (o.sublabel || '').trim().toLowerCase() === ql;
    });
    return !exact;
  };

  LiveSelect.prototype._openCreate = function () {
    var self = this;
    var q = this.query.trim();
    var ctx = { scope: this.opts.scope || {}, query: q };
    Promise.resolve(this.opts.onCreate(q, ctx))
      .then(function (created) {
        if (created) self._select(normalizeOption(created));
        else self.input.focus();
      })
      .catch(function (err) {
        self.error = (err && (err.message || err.reason)) || 'Create failed.';
        self._renderError();
        self.input.focus();
      });
  };

  // -- keyboard --------------------------------------------------------------

  LiveSelect.prototype._handleKeydown = function (e) {
    var canCreate = this._canCreate();
    var max = this.results.length + (canCreate ? 1 : 0) - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._setOpen(true);
      if (max < 0) return;
      var d = this.activeIndex + 1; if (d > max) d = 0;
      this.activeIndex = d; this._renderMenu();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (max < 0) return;
      var u = this.activeIndex - 1; if (u < 0) u = max;
      this.activeIndex = u; this._renderMenu();
    } else if (e.key === 'Enter') {
      if (!this.isOpen) return;
      e.preventDefault();
      var i = this.activeIndex;
      if (canCreate && i === this.results.length) this._openCreate();
      else if (i >= 0 && this.results[i]) this._select(this.results[i]);
    } else if (e.key === 'Escape') {
      this._setOpen(false);
      this.activeIndex = -1;
      this._syncInput();
    }
  };

  // -- selection / value -----------------------------------------------------

  LiveSelect.prototype._select = function (opt) {
    this.selected = opt;
    this.query = '';
    this._setOpen(false);
    this.activeIndex = -1;
    this._appliedValue = opt ? opt.value : '';
    this._syncInput();
    this._syncHidden();
    this._emit(opt);
  };

  LiveSelect.prototype._emit = function (opt) {
    var value = opt ? opt.value : '';
    if (typeof this.opts.onChange === 'function') {
      try { this.opts.onChange(value, opt || null); } catch (e) { /* swallow */ }
    }
    this.root.dispatchEvent(new CustomEvent('sdd:change', {
      bubbles: true,
      detail: { name: this.opts.name || '', value: value, option: opt || null },
    }));
  };

  // -- rendering -------------------------------------------------------------

  LiveSelect.prototype._setOpen = function (open) {
    this.isOpen = open;
    this.root.classList.toggle(this.cp + '--open', open);
    this.input.setAttribute('aria-expanded', open ? 'true' : 'false');
    this.menu.hidden = !open;
    if (open) {
      // Show the live query (empty when freshly opened); placeholder hints the
      // current selection so the user knows what they're replacing.
      this.input.value = this.query;
      if (this.selected) this.input.placeholder = this.selected.label;
      this._renderMenu();
    }
  };

  LiveSelect.prototype._syncInput = function () {
    if (this.isOpen) { this.input.value = this.query; return; }
    this.input.value = this.selected ? this.selected.label : '';
    this.input.placeholder = this.opts.placeholder || 'Search…';
    this.clearEl.hidden = !(this.selected && this.opts.clearable !== false && !this.opts.disabled);
  };

  LiveSelect.prototype._syncHidden = function () {
    this.hidden.value = this.selected ? this.selected.value : '';
    this.clearEl.hidden = !(this.selected && this.opts.clearable !== false && !this.opts.disabled);
    // Fire a native change so plain-form listeners / validators react.
    this.hidden.dispatchEvent(new Event('change', { bubbles: true }));
  };

  LiveSelect.prototype._renderError = function () {
    this.errorEl.textContent = this.error || '';
    this.errorEl.hidden = !this.error;
  };

  LiveSelect.prototype._renderMenu = function () {
    var cp = this.cp;
    if (!this.isOpen) { this.menu.hidden = true; return; }

    var html = '';
    if (this.loading) {
      html = '<div class="' + cp + '__msg">' + escapeHtml(this.texts.searching) + '</div>';
    } else {
      for (var i = 0; i < this.results.length; i++) {
        var o = this.results[i];
        var active = this.activeIndex === i ? (' ' + cp + '__opt--active') : '';
        html += '<button type="button" role="option" class="' + cp + '__opt' + active + '"'
          + ' data-sdd-opt data-sdd-index="' + i + '">'
          + '<span class="' + cp + '__opt-label">' + escapeHtml(o.label) + '</span>'
          + (o.sublabel ? '<span class="' + cp + '__opt-sub">' + escapeHtml(o.sublabel) + '</span>' : '')
          + '</button>';
      }

      var canCreate = this._canCreate();
      if (!this.results.length && !canCreate) {
        html += '<div class="' + cp + '__msg">' + escapeHtml(this.texts.noResults) + '</div>';
      }
      if (canCreate) {
        var createActive = this.activeIndex === this.results.length ? (' ' + cp + '__opt--active') : '';
        var label = typeof this.opts.createLabel === 'function'
          ? this.opts.createLabel(this.query.trim())
          : '+ Add “' + this.query.trim() + '”';
        html += '<button type="button" class="' + cp + '__opt ' + cp + '__opt--create' + createActive + '"'
          + ' data-sdd-create>' + escapeHtml(label) + '</button>';
      }
    }
    this.menu.innerHTML = html;
    this.menu.hidden = false;
    this._renderError();
  };

  // -- public API ------------------------------------------------------------

  /** Current selected value (the string that submits in a form). */
  LiveSelect.prototype.getValue = function () { return this.selected ? this.selected.value : ''; };

  /** Current selected option object, or null. */
  LiveSelect.prototype.getOption = function () { return this.selected; };

  /**
   * setValue — select by value. Pass `option` to set the label without a lookup;
   * otherwise we try the array source, then opts.resolve, to find the label.
   */
  LiveSelect.prototype.setValue = function (value, option) {
    var self = this;
    var v = value == null ? '' : String(value);
    this._appliedValue = v;

    if (!v) { this.selected = null; this._syncInput(); this._syncHidden(); return; }
    if (option) { this.selected = normalizeOption(option); this._syncInput(); this._syncHidden(); return; }

    // Resolve from an array source locally.
    if (Array.isArray(this.opts.source)) {
      var hit = normalizeList(this.opts.source).find(function (o) { return o.value === v; });
      if (hit) { this.selected = hit; this._syncInput(); this._syncHidden(); return; }
    }
    // Resolve via an async resolver (e.g. GET /option/:id).
    if (typeof this.opts.resolve === 'function') {
      Promise.resolve(this.opts.resolve(v, { scope: this.opts.scope || {} }))
        .then(function (opt) {
          if (opt && self._appliedValue === v) { self.selected = normalizeOption(opt); self._syncInput(); self._syncHidden(); }
        })
        .catch(function () { /* leave unresolved; user can re-pick */ });
      return;
    }
    // Unknown label: keep the value, show it raw.
    this.selected = { value: v, label: v, sublabel: '', raw: null };
    this._syncInput();
    this._syncHidden();
  };

  LiveSelect.prototype.clear = function () {
    this.selected = null;
    this.query = '';
    this.results = [];
    this.activeIndex = -1;
    this._appliedValue = '';
    this._syncInput();
    this._syncHidden();
    this._emit(null);
    this.input.focus();
  };

  LiveSelect.prototype.focus = function () { this.input.focus(); };
  LiveSelect.prototype.open  = function () { this.input.focus(); this._setOpen(true); };
  LiveSelect.prototype.close = function () { this._setOpen(false); this._syncInput(); };

  /** Swap the data source (e.g. after pushing a new item to an array). */
  LiveSelect.prototype.setSource = function (source) {
    this.opts.source = source;
    if (this.isOpen) this._runSearch();
  };

  /** Update the parent-scope filter passed to async source / onCreate. */
  LiveSelect.prototype.setScope = function (scope) {
    this.opts.scope = scope || {};
    this.results = [];
    if (this.isOpen) this._runSearch();
  };

  LiveSelect.prototype.setDisabled = function (disabled) {
    this.opts.disabled = !!disabled;
    this.input.disabled = !!disabled;
    this.root.classList.toggle(this.cp + '--disabled', !!disabled);
    this.clearEl.hidden = !(this.selected && this.opts.clearable !== false && !disabled);
  };

  LiveSelect.prototype.destroy = function () {
    clearTimeout(this._debounce);
    clearTimeout(this._blurTimer);
    this.input.removeEventListener('input', this._onInput);
    this.input.removeEventListener('focus', this._onFocus);
    this.input.removeEventListener('blur', this._onBlur);
    this.input.removeEventListener('keydown', this._onKeydown);
    this.menu.removeEventListener('mousedown', this._onMenuDown);
    this.clearEl.removeEventListener('mousedown', this._onClearDown);
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
  };

  // -- static: enhance an existing <select> ----------------------------------

  /**
   * enhance — progressively replace a native <select> with a LiveSelect
   * so existing forms get the uniform look with zero markup changes.
   *
   * It reads the <option>s into an array source, copies name/value/required/
   * disabled, hides the original <select>, and syncs the selection BACK into it
   * on change — so any code already listening to the <select> keeps working.
   *
   * @param {HTMLSelectElement|string} selectElOrSelector
   * @param {object} [extra] — extra LiveSelect options (allowCreate, etc.)
   * @returns {LiveSelect}
   */
  LiveSelect.enhance = function (selectElOrSelector, extra) {
    var sel = resolveEl(selectElOrSelector);
    if (!sel || sel.tagName !== 'SELECT') throw new Error('LiveSelect.enhance: a <select> is required.');

    var source = [];
    var initial = '', initialLabel = '';
    var placeholder = '';
    for (var i = 0; i < sel.options.length; i++) {
      var op = sel.options[i];
      if (op.value === '' && !placeholder) { placeholder = op.textContent.trim(); continue; }
      source.push({ value: op.value, label: op.textContent.trim(), sublabel: op.getAttribute('data-sublabel') || '' });
      if (op.selected) { initial = op.value; initialLabel = op.textContent.trim(); }
    }

    var wasRequired = sel.required;

    var mount = document.createElement('div');
    sel.parentNode.insertBefore(mount, sel);
    sel.style.display = 'none';
    sel.setAttribute('data-sdd-enhanced', '');
    // A `required` control that is display:none is NOT focusable, which makes
    // browsers (e.g. Chrome) silently block form submit with "An invalid form
    // control is not focusable." Drop required from the now-hidden select; we
    // keep the `*` marker on the visible control and recommend validating via
    // the sdd:change event or on the server.
    if (wasRequired) sel.required = false;

    var opts = Object.assign({
      source: source,
      name: sel.getAttribute('name') || '',
      value: initial,
      valueLabel: initialLabel,
      placeholder: placeholder || (extra && extra.placeholder) || 'Search…',
      required: wasRequired,
      disabled: sel.disabled,
    }, extra || {});

    var userOnChange = opts.onChange;
    opts.onChange = function (value, option) {
      // Reflect into the hidden <select> + fire its native change.
      if (option && !Array.prototype.some.call(sel.options, function (o) { return o.value === value; })) {
        var newOpt = document.createElement('option');
        newOpt.value = value; newOpt.textContent = option.label;
        sel.appendChild(newOpt);
      }
      sel.value = value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof userOnChange === 'function') userOnChange(value, option);
    };

    // The original <select> still carries the form value (we sync into it on
    // change), so blank the control's own hidden-input name to avoid submitting
    // the same field twice.
    opts.name = '';

    return new LiveSelect(mount, opts);
  };

  /**
   * remoteSource — build { source, resolve, onCreate } wired to a
   * liveselect HTTP endpoint (see server/liveselect-mongo.js).
   *
   * @param {object} cfg
   * @param {string} cfg.baseUrl   e.g. '/api/dropdown'
   * @param {string} cfg.key       registry key, e.g. 'customers'
   * @param {function} [cfg.fetch] custom fetch (defaults to window.fetch)
   * @param {object} [cfg.headers] extra headers (auth, CSRF token, …)
   * @param {boolean} [cfg.create] also return an onCreate that POSTs to /create
   * @returns {{source:function, resolve:function, onCreate?:function}}
   */
  LiveSelect.remoteSource = function (cfg) {
    cfg = cfg || {};
    var f = cfg.fetch || (typeof fetch !== 'undefined' ? fetch.bind(window) : null);
    if (!f) throw new Error('LiveSelect.remoteSource: no fetch available.');
    var base = cfg.baseUrl.replace(/\/$/, '') + '/' + encodeURIComponent(cfg.key);
    var headers = Object.assign({ 'Content-Type': 'application/json' }, cfg.headers || {});

    function qs(query, ctx) {
      var p = new URLSearchParams();
      if (query) p.set('q', query);
      if (ctx && ctx.limit) p.set('limit', String(ctx.limit));
      var scope = ctx && ctx.scope;
      if (scope) Object.keys(scope).forEach(function (k) {
        if (scope[k]) p.set('scope[' + k + ']', String(scope[k]));
      });
      return p.toString();
    }

    var api = {
      source: function (query, ctx) {
        return f(base + '/search?' + qs(query, ctx), { headers: headers, credentials: 'same-origin' })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      },
      resolve: function (value) {
        return f(base + '/option/' + encodeURIComponent(value), { headers: headers, credentials: 'same-origin' })
          .then(function (r) { return r.ok ? r.json() : null; });
      },
    };
    if (cfg.create) {
      api.onCreate = function (query, ctx) {
        return f(base + '/create', {
          method: 'POST', headers: headers, credentials: 'same-origin',
          body: JSON.stringify({ fields: { name: query }, scope: (ctx && ctx.scope) || {} }),
        }).then(function (r) {
          if (!r.ok) return r.json().then(function (j) { throw new Error((j && j.error) || ('HTTP ' + r.status)); });
          return r.json();
        });
      };
    }
    return api;
  };

  LiveSelect.normalizeOption = normalizeOption;

  return LiveSelect;
}));
