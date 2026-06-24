/*! @michaeljfalk/liveselect v4.0.4 | MIT License | https://github.com/michaeljfalk/liveselect */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiveSelect = factory();
}(typeof self !== 'undefined' ? self : this, function () {
"use strict";
var __liveselect__ = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/liveselect.js
  var liveselect_exports = {};
  __export(liveselect_exports, {
    LiveSelect: () => LiveSelect,
    default: () => liveselect_default,
    escapeHtml: () => escapeHtml,
    normalizeOption: () => normalizeOption
  });
  var BLUR_CLOSE_MS = 150;
  var uidSeq = 0;
  var DEFAULT_TEXTS = {
    searching: "Searching\u2026",
    noResults: "No matches.",
    searchFailed: "Search failed.",
    required: "Please select an option."
    // more: (shown, total) => string — overridable "Showing N of M" footer text.
  };
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function normalizeOption(o) {
    if (o == null) return null;
    if (typeof o === "string" || typeof o === "number") {
      return { value: String(o), label: String(o), sublabel: "", group: "", disabled: false, raw: o };
    }
    var value = o.value != null ? o.value : o._id != null ? o._id : o.id != null ? o.id : "";
    var label = o.label != null ? o.label : o.name != null ? o.name : o.title != null ? o.title : o.text != null ? o.text : value;
    return {
      value: value == null ? "" : String(value),
      label: label == null || label === "" ? "(unnamed)" : String(label),
      sublabel: o.sublabel != null ? String(o.sublabel) : "",
      group: o.group != null ? String(o.group) : "",
      disabled: !!o.disabled,
      raw: Object.prototype.hasOwnProperty.call(o, "raw") ? o.raw : o
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
    if (typeof elementOrSelector === "string") {
      return document.querySelector(elementOrSelector);
    }
    return elementOrSelector || null;
  }
  function LiveSelect(elementOrSelector, options) {
    var host = resolveEl(elementOrSelector);
    if (!host) throw new Error("LiveSelect: mount element not found.");
    this.opts = options || {};
    this.host = host;
    this.cp = this.opts.classPrefix || "liveselect";
    this.uid = this.cp + "-" + ++uidSeq;
    this.texts = Object.assign({}, DEFAULT_TEXTS, this.opts.texts || {});
    this.multi = !!this.opts.multiple;
    this.query = "";
    this.results = [];
    this.isOpen = false;
    this.loading = false;
    this.error = "";
    this.activeIndex = -1;
    this.selected = null;
    this.selectedList = [];
    this._appliedValue = void 0;
    this._debounce = null;
    this._blurTimer = null;
    this._reqSeq = 0;
    this._abort = null;
    this._total = null;
    this._cache = {};
    this._build();
    this._bind();
    if ("value" in this.opts) {
      if (this.multi) {
        this.setValue(this.opts.value, this.opts.valueLabel);
      } else {
        this.setValue(this.opts.value, this.opts.valueLabel != null ? { value: this.opts.value, label: this.opts.valueLabel, sublabel: this.opts.valueSublabel || "" } : void 0);
      }
    }
    this._syncValidity();
  }
  LiveSelect.prototype._c = function(suffix) {
    return suffix ? this.cp + "__" + suffix : this.cp;
  };
  LiveSelect.prototype._build = function() {
    var cp = this.cp;
    var o = this.opts;
    var root = document.createElement("div");
    root.className = cp;
    root.setAttribute("data-liveselect", "");
    if (o.disabled) root.classList.add(cp + "--disabled");
    if (this.multi) root.classList.add(cp + "--multi");
    var labelHtml = "";
    if (o.label) {
      labelHtml = '<span class="' + cp + '__label">' + escapeHtml(o.label) + (o.required ? ' <span class="' + cp + '__req">*</span>' : "") + "</span>";
    }
    root.innerHTML = labelHtml + '<div class="' + cp + '__control"><span class="' + cp + '__tags" data-liveselect-tags' + (this.multi ? "" : " hidden") + '></span><input type="text" class="' + cp + '__input" autocomplete="off" spellcheck="false"' + (o.disabled ? " disabled" : "") + ' placeholder="' + escapeHtml(o.placeholder || "Search\u2026") + '" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="' + this.uid + '-menu" data-liveselect-input><button type="button" class="' + cp + '__clear" data-liveselect-clear aria-label="Clear selection" hidden>&times;</button><div class="' + cp + '__menu" id="' + this.uid + '-menu" role="listbox"' + (this.multi ? ' aria-multiselectable="true"' : "") + ' data-liveselect-menu hidden></div></div><span class="' + cp + '__error" data-liveselect-error hidden></span><span class="' + cp + '__sr" data-liveselect-live aria-live="polite" role="status" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0"></span><input type="hidden" data-liveselect-hidden' + (o.name && !this.multi ? ' name="' + escapeHtml(o.name) + '"' : "") + (o.required && !this.multi ? " required" : "") + ' value=""><span data-liveselect-hidden-list></span>';
    this.host.appendChild(root);
    this.root = root;
    this.input = root.querySelector("[data-liveselect-input]");
    this.clearEl = root.querySelector("[data-liveselect-clear]");
    this.menu = root.querySelector("[data-liveselect-menu]");
    this.errorEl = root.querySelector("[data-liveselect-error]");
    this.liveEl = root.querySelector("[data-liveselect-live]");
    this.hidden = root.querySelector("[data-liveselect-hidden]");
    this.tagsEl = root.querySelector("[data-liveselect-tags]");
    this.hiddenList = root.querySelector("[data-liveselect-hidden-list]");
  };
  LiveSelect.prototype._bind = function() {
    var self = this;
    this._onInput = function(e) {
      self.query = e.target.value;
      self._setOpen(true);
      self._scheduleSearch();
    };
    this._onFocus = function() {
      if (self.opts.disabled) return;
      self._setOpen(true);
      if (self.opts.openOnFocus !== false && !self.results.length) self._runSearch();
    };
    this._onBlur = function() {
      clearTimeout(self._blurTimer);
      self._blurTimer = setTimeout(function() {
        self._setOpen(false);
        self._syncInput();
      }, BLUR_CLOSE_MS);
    };
    this._onKeydown = function(e) {
      self._handleKeydown(e);
    };
    this._onMenuDown = function(e) {
      var optEl = e.target.closest("[data-liveselect-opt]");
      var createEl = e.target.closest("[data-liveselect-create]");
      if (optEl) {
        e.preventDefault();
        var opt = self.results[Number(optEl.getAttribute("data-liveselect-index"))];
        if (opt) self._select(opt);
      } else if (createEl) {
        e.preventDefault();
        self._openCreate();
      }
    };
    this._onClearDown = function(e) {
      e.preventDefault();
      self.clear();
    };
    this._onTagsDown = function(e) {
      var rm = e.target.closest("[data-liveselect-remove]");
      if (!rm) return;
      e.preventDefault();
      self._deselect(rm.getAttribute("data-liveselect-remove"));
    };
    this.input.addEventListener("input", this._onInput);
    this.input.addEventListener("focus", this._onFocus);
    this.input.addEventListener("blur", this._onBlur);
    this.input.addEventListener("keydown", this._onKeydown);
    this.menu.addEventListener("mousedown", this._onMenuDown);
    this.clearEl.addEventListener("mousedown", this._onClearDown);
    this.tagsEl.addEventListener("mousedown", this._onTagsDown);
  };
  LiveSelect.prototype._scheduleSearch = function() {
    var self = this;
    if (this._debounce) clearTimeout(this._debounce);
    this._debounce = setTimeout(function() {
      self._runSearch();
    }, this.opts.debounce != null ? this.opts.debounce : 250);
  };
  LiveSelect.prototype._runSearch = function() {
    var self = this;
    var q = this.query.trim();
    var limit = this.opts.limit || 20;
    var minChars = this.opts.minChars || 0;
    if (q.length < minChars) {
      this.results = [];
      this._total = null;
      this.activeIndex = -1;
      this._renderMenu();
      return;
    }
    this._dispatch("search", { query: q });
    var src = this.opts.source;
    if (Array.isArray(src)) {
      var all = normalizeList(src);
      var ql = q.toLowerCase();
      var filtered = !ql ? all : all.filter(function(o) {
        return o.label.toLowerCase().indexOf(ql) !== -1 || o.sublabel && o.sublabel.toLowerCase().indexOf(ql) !== -1;
      });
      this.error = "";
      this._total = filtered.length;
      this.results = this._group(filtered.slice(0, limit));
      this.activeIndex = -1;
      this._renderMenu();
      return;
    }
    if (typeof src === "function") {
      var key = this._cacheKey(q, limit);
      if (this.opts.cache && this._cache[key]) {
        this._reqSeq++;
        if (this._abort) {
          this._abort.abort();
          this._abort = null;
        }
        var c = this._cache[key];
        this.loading = false;
        this.error = "";
        this._total = c.total;
        this.results = this._group(c.items.slice(0, limit));
        this.activeIndex = -1;
        this._renderMenu();
        return;
      }
      var seq = ++this._reqSeq;
      if (this._abort) this._abort.abort();
      this._abort = typeof AbortController !== "undefined" ? new AbortController() : null;
      this.loading = true;
      this.error = "";
      this._renderMenu();
      var ctx = {
        scope: this.opts.scope || {},
        limit,
        query: q,
        signal: this._abort ? this._abort.signal : void 0
      };
      Promise.resolve(src(q, ctx)).then(function(res) {
        var arr = Array.isArray(res) ? res : res && res.items || [];
        var norm = normalizeList(arr);
        var total = res && typeof res.total === "number" ? res.total : norm.length > limit ? norm.length : null;
        if (self.opts.cache) self._cache[key] = { items: norm, total };
        if (seq !== self._reqSeq) return;
        self.loading = false;
        self._total = total;
        self.results = self._group(norm.slice(0, limit));
        self.activeIndex = -1;
        self._renderMenu();
      }).catch(function(err) {
        if (seq !== self._reqSeq) return;
        if (err && err.name === "AbortError") return;
        self.loading = false;
        self.results = [];
        self._total = null;
        self.error = err && (err.message || err.reason) || self.texts.searchFailed;
        self._renderMenu();
        self._renderError();
      });
      return;
    }
    this.results = [];
    this._total = null;
    this._renderMenu();
  };
  LiveSelect.prototype._cacheKey = function(q, limit) {
    return JSON.stringify([q, this.opts.scope || {}, limit]);
  };
  LiveSelect.prototype._groupOf = function(o) {
    if (typeof this.opts.groupBy === "function") {
      var g = this.opts.groupBy(o);
      return g == null ? "" : String(g);
    }
    return o.group || "";
  };
  LiveSelect.prototype._group = function(list) {
    var grouped = typeof this.opts.groupBy === "function";
    if (!grouped) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].group) {
          grouped = true;
          break;
        }
      }
    }
    if (!grouped) return list;
    var order = [], buckets = {}, self = this;
    list.forEach(function(o) {
      var g = self._groupOf(o);
      if (!buckets[g]) {
        buckets[g] = [];
        order.push(g);
      }
      buckets[g].push(o);
    });
    var out = [];
    order.forEach(function(g) {
      out.push.apply(out, buckets[g]);
    });
    return out;
  };
  LiveSelect.prototype._canCreate = function() {
    if (!this.opts.allowCreate || typeof this.opts.onCreate !== "function") return false;
    if (this.multi && this.opts.maxItems != null && this.selectedList.length >= this.opts.maxItems) return false;
    var q = this.query.trim();
    if (!q) return false;
    var ql = q.toLowerCase();
    var exact = this.results.some(function(o) {
      return o.label.trim().toLowerCase() === ql || (o.sublabel || "").trim().toLowerCase() === ql;
    });
    if (exact) return false;
    if (this.multi) {
      var chosen = this.selectedList.some(function(o) {
        return o.label.trim().toLowerCase() === ql;
      });
      if (chosen) return false;
    }
    return true;
  };
  LiveSelect.prototype._openCreate = function() {
    var self = this;
    var q = this.query.trim();
    var ctx = { scope: this.opts.scope || {}, query: q };
    Promise.resolve(this.opts.onCreate(q, ctx)).then(function(created) {
      if (created) self._select(normalizeOption(created));
      else self.input.focus();
    }).catch(function(err) {
      self.error = err && (err.message || err.reason) || "Create failed.";
      self._renderError();
      self.input.focus();
    });
  };
  LiveSelect.prototype._isEnabled = function(idx) {
    if (idx < 0) return false;
    if (idx >= this.results.length) return true;
    return !this.results[idx].disabled;
  };
  LiveSelect.prototype._step = function(from, dir, max) {
    if (max < 0) return -1;
    var idx = from;
    for (var n = 0; n <= max; n++) {
      idx += dir;
      if (idx > max) idx = 0;
      else if (idx < 0) idx = max;
      if (this._isEnabled(idx)) return idx;
    }
    return -1;
  };
  LiveSelect.prototype._handleKeydown = function(e) {
    if (this.multi && e.key === "Backspace" && this.query === "" && this.selectedList.length) {
      e.preventDefault();
      this._deselect(this.selectedList[this.selectedList.length - 1].value);
      return;
    }
    var canCreate = this._canCreate();
    var max = this.results.length + (canCreate ? 1 : 0) - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this._setOpen(true);
      var d = this._step(this.activeIndex, 1, max);
      if (d >= 0) {
        this.activeIndex = d;
        this._renderMenu();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      var u = this._step(this.activeIndex, -1, max);
      if (u >= 0) {
        this.activeIndex = u;
        this._renderMenu();
      }
    } else if (e.key === "Enter") {
      if (!this.isOpen) return;
      e.preventDefault();
      var i = this.activeIndex;
      if (canCreate && i === this.results.length) this._openCreate();
      else if (i >= 0 && this.results[i] && !this.results[i].disabled) this._select(this.results[i]);
    } else if (e.key === "Escape") {
      this._setOpen(false);
      this.activeIndex = -1;
      this._syncInput();
    }
  };
  LiveSelect.prototype._select = function(opt) {
    if (opt && opt.disabled) {
      this.input.focus();
      return;
    }
    if (this.multi) return this._toggle(opt);
    this.selected = opt;
    this.query = "";
    this._setOpen(false);
    this.activeIndex = -1;
    this._appliedValue = opt ? opt.value : "";
    this._syncInput();
    this._syncHidden();
    this._emit(opt);
  };
  LiveSelect.prototype._indexOfValue = function(value) {
    var v = String(value);
    for (var i = 0; i < this.selectedList.length; i++) {
      if (this.selectedList[i].value === v) return i;
    }
    return -1;
  };
  LiveSelect.prototype._isChosen = function(value) {
    return this._indexOfValue(value) >= 0;
  };
  LiveSelect.prototype._toggle = function(opt) {
    if (!opt) return;
    var i = this._indexOfValue(opt.value);
    if (i >= 0) {
      this.selectedList.splice(i, 1);
    } else {
      var max = this.opts.maxItems;
      if (max != null && this.selectedList.length >= max) {
        this._announce("Maximum of " + max + " reached.");
        this.input.focus();
        return;
      }
      this.selectedList.push(opt);
    }
    this._afterMultiChange(true);
  };
  LiveSelect.prototype._deselect = function(value) {
    var i = this._indexOfValue(value);
    if (i < 0) return;
    this.selectedList.splice(i, 1);
    this._afterMultiChange(this.isOpen);
  };
  LiveSelect.prototype._afterMultiChange = function(keepOpen) {
    clearTimeout(this._blurTimer);
    this.query = "";
    this.activeIndex = -1;
    this._renderTags();
    this._syncInput();
    this._syncHidden();
    this._emit();
    this.input.focus();
    if (keepOpen) {
      this._setOpen(true);
      this._runSearch();
    } else this._renderMenu();
  };
  LiveSelect.prototype._renderTags = function() {
    if (!this.multi) return;
    var cp = this.cp, self = this;
    this.tagsEl.textContent = "";
    this.selectedList.forEach(function(o) {
      var chip = document.createElement("span");
      chip.className = cp + "__tag";
      var lab = document.createElement("span");
      lab.className = cp + "__tag-label";
      lab.textContent = o.label;
      chip.appendChild(lab);
      if (!self.opts.disabled) {
        var rm = document.createElement("button");
        rm.type = "button";
        rm.className = cp + "__tag-remove";
        rm.setAttribute("data-liveselect-remove", o.value);
        rm.setAttribute("aria-label", "Remove " + o.label);
        rm.innerHTML = "&times;";
        chip.appendChild(rm);
      }
      self.tagsEl.appendChild(chip);
    });
    this.tagsEl.hidden = this.selectedList.length === 0;
  };
  LiveSelect.prototype._emit = function(opt) {
    if (this.multi) {
      var values = this.selectedList.map(function(o) {
        return o.value;
      });
      var options = this.selectedList.slice();
      if (typeof this.opts.onChange === "function") {
        try {
          this.opts.onChange(values, options);
        } catch (e) {
        }
      }
      this.root.dispatchEvent(new CustomEvent("liveselect:change", {
        bubbles: true,
        detail: { name: this.opts.name || "", value: values, options, option: null }
      }));
      return;
    }
    var value = opt ? opt.value : "";
    if (typeof this.opts.onChange === "function") {
      try {
        this.opts.onChange(value, opt || null);
      } catch (e) {
      }
    }
    this.root.dispatchEvent(new CustomEvent("liveselect:change", {
      bubbles: true,
      detail: { name: this.opts.name || "", value, option: opt || null }
    }));
  };
  LiveSelect.prototype._dispatch = function(type, detail) {
    this.root.dispatchEvent(new CustomEvent("liveselect:" + type, {
      bubbles: true,
      detail: Object.assign({ name: this.opts.name || "" }, detail || {})
    }));
  };
  LiveSelect.prototype._setOpen = function(open) {
    var was = this.isOpen;
    this.isOpen = open;
    this.root.classList.toggle(this.cp + "--open", open);
    this.input.setAttribute("aria-expanded", open ? "true" : "false");
    this.menu.hidden = !open;
    if (open && !was) this._dispatch("open");
    if (!open && was) this._dispatch("close");
    if (open) {
      this.input.value = this.query;
      if (this.selected) this.input.placeholder = this.selected.label;
      this._renderMenu();
    }
  };
  LiveSelect.prototype._syncInput = function() {
    if (this.isOpen) {
      this.input.value = this.query;
      return;
    }
    if (this.multi) {
      this.input.value = "";
      this.input.placeholder = this.opts.placeholder || "Search\u2026";
      this.clearEl.hidden = !(this.selectedList.length && this.opts.clearable !== false && !this.opts.disabled);
      return;
    }
    this.input.value = this.selected ? this.selected.label : "";
    this.input.placeholder = this.opts.placeholder || "Search\u2026";
    this.clearEl.hidden = !(this.selected && this.opts.clearable !== false && !this.opts.disabled);
  };
  LiveSelect.prototype._syncHidden = function() {
    if (this.multi) {
      this._syncHiddenMulti();
      this.clearEl.hidden = !(this.selectedList.length && this.opts.clearable !== false && !this.opts.disabled);
    } else {
      this.hidden.value = this.selected ? this.selected.value : "";
      this.clearEl.hidden = !(this.selected && this.opts.clearable !== false && !this.opts.disabled);
    }
    this._syncValidity();
    this.hidden.dispatchEvent(new Event("change", { bubbles: true }));
  };
  LiveSelect.prototype._syncHiddenMulti = function() {
    this.hiddenList.textContent = "";
    var name = this.opts.name;
    if (!name) return;
    var values = this.selectedList.map(function(o) {
      return o.value;
    });
    var fmt = this.opts.submitFormat || "repeat";
    if (fmt === "delimited") {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = values.join(this.opts.delimiter != null ? this.opts.delimiter : ",");
      this.hiddenList.appendChild(input);
      return;
    }
    var fieldName = fmt === "bracket" ? name + "[]" : name;
    for (var i = 0; i < values.length; i++) {
      var inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = fieldName;
      inp.value = values[i];
      this.hiddenList.appendChild(inp);
    }
  };
  LiveSelect.prototype._syncValidity = function() {
    if (!this.input || typeof this.input.setCustomValidity !== "function") return;
    var empty = this.multi ? this.selectedList.length === 0 : !this.selected;
    var enforce = this.opts.required && !this.opts.disabled && empty;
    this.input.setCustomValidity(enforce ? this.texts.required || "Please select an option." : "");
  };
  LiveSelect.prototype._renderError = function() {
    this.errorEl.textContent = this.error || "";
    this.errorEl.hidden = !this.error;
  };
  LiveSelect.prototype._msgEl = function(text) {
    var el = document.createElement("div");
    el.className = this.cp + "__msg";
    el.textContent = text;
    return el;
  };
  LiveSelect.prototype._announce = function(msg) {
    if (this.liveEl) this.liveEl.textContent = msg || "";
  };
  LiveSelect.prototype._announceResults = function(canCreate) {
    var n = this.results.length;
    if (n > 0) {
      this._announce(n + (n === 1 ? " result available." : " results available."));
    } else if (canCreate) {
      this._announce(this.texts.noResults + " Press Enter to add.");
    } else {
      this._announce(this.texts.noResults);
    }
  };
  LiveSelect.prototype._applyRendered = function(el, out) {
    if (out == null) return false;
    if (typeof out === "string") {
      el.innerHTML = out;
      return true;
    }
    if (out.nodeType) {
      el.appendChild(out);
      return true;
    }
    return false;
  };
  LiveSelect.prototype._highlightInto = function(el, text, q) {
    var i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (i < 0) {
      el.textContent = text;
      return;
    }
    el.appendChild(document.createTextNode(text.slice(0, i)));
    var mark = document.createElement("mark");
    mark.className = this.cp + "__mark";
    mark.textContent = text.slice(i, i + q.length);
    el.appendChild(mark);
    el.appendChild(document.createTextNode(text.slice(i + q.length)));
  };
  LiveSelect.prototype._fillOption = function(btn, o, index) {
    var cp = this.cp;
    if (typeof this.opts.renderOption === "function") {
      var ctx = {
        index,
        query: this.query.trim(),
        active: this.activeIndex === index,
        escapeHtml
      };
      if (this._applyRendered(btn, this.opts.renderOption(o, ctx))) return;
    }
    var q = this.opts.highlight ? this.query.trim() : "";
    var lab = document.createElement("span");
    lab.className = cp + "__opt-label";
    this._highlightInto(lab, o.label, q);
    btn.appendChild(lab);
    if (o.sublabel) {
      var sub = document.createElement("span");
      sub.className = cp + "__opt-sub";
      this._highlightInto(sub, o.sublabel, q);
      btn.appendChild(sub);
    }
  };
  LiveSelect.prototype._fillCreate = function(btn, q) {
    if (typeof this.opts.renderCreate === "function") {
      var ctx = {
        query: q,
        active: this.activeIndex === this.results.length,
        escapeHtml
      };
      if (this._applyRendered(btn, this.opts.renderCreate(q, ctx))) return;
    }
    btn.textContent = typeof this.opts.createLabel === "function" ? this.opts.createLabel(q) : "+ Add \u201C" + q + "\u201D";
  };
  LiveSelect.prototype._renderMenu = function() {
    var cp = this.cp;
    if (!this.isOpen) {
      this.menu.hidden = true;
      return;
    }
    this.menu.textContent = "";
    this.input.removeAttribute("aria-activedescendant");
    if (this.loading) {
      this.menu.appendChild(this._msgEl(this.texts.searching));
      this.menu.hidden = false;
      this._announce(this.texts.searching);
      this._renderError();
      return;
    }
    var lastGroup = null, activeId = null;
    for (var i = 0; i < this.results.length; i++) {
      var o = this.results[i];
      var g = this._groupOf(o);
      if (g && g !== lastGroup) {
        var head = document.createElement("div");
        head.className = cp + "__group";
        head.setAttribute("role", "presentation");
        head.textContent = g;
        this.menu.appendChild(head);
      }
      lastGroup = g;
      var isActive = this.activeIndex === i;
      var isChosen = this.multi && this._isChosen(o.value);
      var optId = this.uid + "-opt-" + i;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = optId;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", (this.multi ? isChosen : isActive) ? "true" : "false");
      btn.className = cp + "__opt" + (isActive ? " " + cp + "__opt--active" : "") + (isChosen ? " " + cp + "__opt--chosen" : "") + (o.disabled ? " " + cp + "__opt--disabled" : "");
      btn.setAttribute("data-liveselect-opt", "");
      btn.setAttribute("data-liveselect-index", String(i));
      if (o.disabled) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
      }
      this._fillOption(btn, o, i);
      this.menu.appendChild(btn);
      if (isActive) activeId = optId;
    }
    var canCreate = this._canCreate();
    if (!this.results.length && !canCreate) {
      this.menu.appendChild(this._msgEl(this.texts.noResults));
    }
    if (canCreate) {
      var createOn = this.activeIndex === this.results.length;
      var createId = this.uid + "-create";
      var cbtn = document.createElement("button");
      cbtn.type = "button";
      cbtn.id = createId;
      cbtn.setAttribute("role", "option");
      cbtn.setAttribute("aria-selected", createOn ? "true" : "false");
      cbtn.className = cp + "__opt " + cp + "__opt--create" + (createOn ? " " + cp + "__opt--active" : "");
      cbtn.setAttribute("data-liveselect-create", "");
      this._fillCreate(cbtn, this.query.trim());
      this.menu.appendChild(cbtn);
      if (createOn) activeId = createId;
    }
    var shown = this.results.length;
    if (this._total != null && this._total > shown) {
      var more = document.createElement("div");
      more.className = cp + "__more";
      more.setAttribute("role", "presentation");
      more.textContent = typeof this.texts.more === "function" ? this.texts.more(shown, this._total) : "Showing " + shown + " of " + this._total;
      this.menu.appendChild(more);
    }
    if (activeId) this.input.setAttribute("aria-activedescendant", activeId);
    this.menu.hidden = false;
    this._announceResults(canCreate);
    this._renderError();
  };
  LiveSelect.prototype.getValue = function() {
    if (this.multi) return this.selectedList.map(function(o) {
      return o.value;
    });
    return this.selected ? this.selected.value : "";
  };
  LiveSelect.prototype.getOption = function() {
    return this.multi ? this.selectedList.slice() : this.selected;
  };
  LiveSelect.prototype.setValue = function(value, option) {
    var self = this;
    if (this.multi) {
      var values = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
      var labels = Array.isArray(option) ? option : null;
      this.selectedList = [];
      values.forEach(function(raw, idx) {
        var vv = String(raw);
        var lbl = labels && labels[idx];
        if (lbl != null && typeof lbl === "object") {
          self.selectedList.push(normalizeOption(lbl));
          return;
        }
        if (lbl != null) {
          self.selectedList.push(normalizeOption({ value: vv, label: lbl }));
          return;
        }
        if (Array.isArray(self.opts.source)) {
          var hit2 = normalizeList(self.opts.source).find(function(o) {
            return o.value === vv;
          });
          if (hit2) {
            self.selectedList.push(hit2);
            return;
          }
        }
        if (typeof self.opts.resolve === "function") {
          Promise.resolve(self.opts.resolve(vv, { scope: self.opts.scope || {} })).then(function(opt) {
            if (opt) {
              self.selectedList.push(normalizeOption(opt));
              self._renderTags();
              self._syncHidden();
            }
          }).catch(function() {
          });
          return;
        }
        self.selectedList.push(normalizeOption({ value: vv, label: vv }));
      });
      this._renderTags();
      this._syncInput();
      this._syncHidden();
      return;
    }
    var v = value == null ? "" : String(value);
    this._appliedValue = v;
    if (!v) {
      this.selected = null;
      this._syncInput();
      this._syncHidden();
      return;
    }
    if (option) {
      this.selected = normalizeOption(option);
      this._syncInput();
      this._syncHidden();
      return;
    }
    if (Array.isArray(this.opts.source)) {
      var hit = normalizeList(this.opts.source).find(function(o) {
        return o.value === v;
      });
      if (hit) {
        this.selected = hit;
        this._syncInput();
        this._syncHidden();
        return;
      }
    }
    if (typeof this.opts.resolve === "function") {
      Promise.resolve(this.opts.resolve(v, { scope: this.opts.scope || {} })).then(function(opt) {
        if (opt && self._appliedValue === v) {
          self.selected = normalizeOption(opt);
          self._syncInput();
          self._syncHidden();
        }
      }).catch(function() {
      });
      return;
    }
    this.selected = { value: v, label: v, sublabel: "", raw: null };
    this._syncInput();
    this._syncHidden();
  };
  LiveSelect.prototype.clear = function() {
    this.selected = null;
    this.selectedList = [];
    this.query = "";
    this.results = [];
    this.activeIndex = -1;
    this._appliedValue = "";
    if (this.multi) this._renderTags();
    this._syncInput();
    this._syncHidden();
    this._emit(null);
    this.input.focus();
  };
  LiveSelect.prototype.focus = function() {
    this.input.focus();
  };
  LiveSelect.prototype.open = function() {
    this.input.focus();
    this._setOpen(true);
  };
  LiveSelect.prototype.close = function() {
    this._setOpen(false);
    this._syncInput();
  };
  LiveSelect.prototype.setSource = function(source) {
    this.opts.source = source;
    this.results = [];
    this._total = null;
    this.activeIndex = -1;
    this._cache = {};
    if (this.isOpen) this._runSearch();
  };
  LiveSelect.prototype.setScope = function(scope) {
    this.opts.scope = scope || {};
    this.results = [];
    this._cache = {};
    if (this.isOpen) this._runSearch();
  };
  LiveSelect.prototype.setDisabled = function(disabled) {
    this.opts.disabled = !!disabled;
    this.input.disabled = !!disabled;
    this.root.classList.toggle(this.cp + "--disabled", !!disabled);
    this.clearEl.hidden = !(this.selected && this.opts.clearable !== false && !disabled);
    this._syncValidity();
  };
  LiveSelect.prototype.destroy = function() {
    clearTimeout(this._debounce);
    clearTimeout(this._blurTimer);
    if (this._abort) {
      this._abort.abort();
      this._abort = null;
    }
    this.input.removeEventListener("input", this._onInput);
    this.input.removeEventListener("focus", this._onFocus);
    this.input.removeEventListener("blur", this._onBlur);
    this.input.removeEventListener("keydown", this._onKeydown);
    this.menu.removeEventListener("mousedown", this._onMenuDown);
    this.clearEl.removeEventListener("mousedown", this._onClearDown);
    this.tagsEl.removeEventListener("mousedown", this._onTagsDown);
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
  };
  LiveSelect.enhance = function(selectElOrSelector, extra) {
    var sel = resolveEl(selectElOrSelector);
    if (!sel || sel.tagName !== "SELECT") throw new Error("LiveSelect.enhance: a <select> is required.");
    var isMulti = sel.multiple;
    var source = [];
    var initial = "", initialLabel = "";
    var initialValues = [], initialLabels = [];
    var placeholder = "";
    for (var i = 0; i < sel.options.length; i++) {
      var op = sel.options[i];
      if (op.value === "" && !placeholder) {
        placeholder = op.textContent.trim();
        continue;
      }
      source.push({ value: op.value, label: op.textContent.trim(), sublabel: op.getAttribute("data-sublabel") || "" });
      if (op.selected) {
        initial = op.value;
        initialLabel = op.textContent.trim();
        initialValues.push(op.value);
        initialLabels.push(op.textContent.trim());
      }
    }
    var wasRequired = sel.required;
    var mount = document.createElement("div");
    sel.parentNode.insertBefore(mount, sel);
    sel.style.display = "none";
    sel.setAttribute("data-liveselect-enhanced", "");
    if (wasRequired) sel.required = false;
    var opts = Object.assign({
      source,
      name: sel.getAttribute("name") || "",
      value: isMulti ? initialValues : initial,
      valueLabel: isMulti ? initialLabels : initialLabel,
      multiple: isMulti,
      placeholder: placeholder || extra && extra.placeholder || "Search\u2026",
      required: wasRequired,
      disabled: sel.disabled
    }, extra || {});
    var userOnChange = opts.onChange;
    opts.onChange = function(value, option) {
      if (isMulti) {
        var set = {};
        value.forEach(function(v) {
          set[v] = true;
        });
        value.forEach(function(v) {
          if (!Array.prototype.some.call(sel.options, function(o) {
            return o.value === v;
          })) {
            var added = document.createElement("option");
            added.value = v;
            added.textContent = v;
            sel.appendChild(added);
          }
        });
        Array.prototype.forEach.call(sel.options, function(o) {
          o.selected = !!set[o.value];
        });
      } else {
        if (option && !Array.prototype.some.call(sel.options, function(o) {
          return o.value === value;
        })) {
          var newOpt = document.createElement("option");
          newOpt.value = value;
          newOpt.textContent = option.label;
          sel.appendChild(newOpt);
        }
        sel.value = value;
      }
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      if (typeof userOnChange === "function") userOnChange(value, option);
    };
    opts.name = "";
    return new LiveSelect(mount, opts);
  };
  LiveSelect.remoteSource = function(cfg) {
    cfg = cfg || {};
    var f = cfg.fetch || (typeof fetch !== "undefined" ? fetch.bind(window) : null);
    if (!f) throw new Error("LiveSelect.remoteSource: no fetch available.");
    var base = cfg.baseUrl.replace(/\/$/, "") + "/" + encodeURIComponent(cfg.key);
    var headers = Object.assign({ "Content-Type": "application/json" }, cfg.headers || {});
    function qs(query, ctx) {
      var p = new URLSearchParams();
      if (query) p.set("q", query);
      if (ctx && ctx.limit) p.set("limit", String(ctx.limit));
      var scope = ctx && ctx.scope;
      if (scope) Object.keys(scope).forEach(function(k) {
        if (scope[k]) p.set("scope[" + k + "]", String(scope[k]));
      });
      return p.toString();
    }
    var api = {
      source: function(query, ctx) {
        return f(base + "/search?" + qs(query, ctx), {
          headers,
          credentials: "same-origin",
          signal: ctx && ctx.signal
          // cancels when a newer search supersedes this one
        }).then(function(r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });
      },
      resolve: function(value) {
        return f(base + "/option/" + encodeURIComponent(value), { headers, credentials: "same-origin" }).then(function(r) {
          return r.ok ? r.json() : null;
        });
      }
    };
    if (cfg.create) {
      api.onCreate = function(query, ctx) {
        return f(base + "/create", {
          method: "POST",
          headers,
          credentials: "same-origin",
          body: JSON.stringify({ fields: { name: query }, scope: ctx && ctx.scope || {} })
        }).then(function(r) {
          if (!r.ok) return r.json().then(function(j) {
            throw new Error(j && j.error || "HTTP " + r.status);
          });
          return r.json();
        });
      };
    }
    return api;
  };
  LiveSelect.normalizeOption = normalizeOption;
  LiveSelect.escapeHtml = escapeHtml;
  var liveselect_default = LiveSelect;
  return __toCommonJS(liveselect_exports);
})();
  return __liveselect__.default;
}));
