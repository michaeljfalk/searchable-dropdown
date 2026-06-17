/**
 * client.test.js — DOM tests for the browser control (run under jsdom).
 *
 * Covers the audit-relevant client behavior as regression tests:
 *   - option label/sublabel are HTML-escaped (no XSS from data sources)
 *   - the hidden input mirrors the selected value (plain-form submission)
 *   - liveselect:change bubbles with the right detail
 *   - enhance() removes `required` from the hidden <select> (focusability bug)
 *   - normalizeOption coerces loose input
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

let LiveSelect;
let domAvailable = true;
try {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  // NB: don't assign global.navigator — it's read-only on Node 20+ and the
  // control doesn't use it.
  LiveSelect = require('../dist/liveselect.js');
} catch (e) {
  domAvailable = false;
  // eslint-disable-next-line no-console
  console.error('[client.test] DOM setup failed, skipping client tests:', e.message);
}

function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

test('normalizeOption coerces strings and id/name shapes', { skip: !domAvailable }, () => {
  assert.deepEqual(LiveSelect.normalizeOption('apple'),
    { value: 'apple', label: 'apple', sublabel: '', group: '', disabled: false, raw: 'apple' });
  const n = LiveSelect.normalizeOption({ _id: 'x1', name: 'Acme' });
  assert.equal(n.value, 'x1');
  assert.equal(n.label, 'Acme');
});

test('menu escapes HTML in labels/sublabels (no XSS injection)', { skip: !domAvailable }, () => {
  const host = mount();
  const dd = new LiveSelect(host, {
    source: [{ value: '1', label: '<img src=x onerror="alert(1)">', sublabel: '<b>x</b>' }],
  });
  dd.query = '';
  dd.isOpen = true;
  dd._runSearch();   // array source filters synchronously
  dd._renderMenu();

  const html = dd.menu.innerHTML;
  assert.ok(html.includes('&lt;img'), 'tag should be escaped');
  assert.equal(dd.menu.querySelector('img'), null, 'no live <img> element injected');
  assert.equal(dd.menu.querySelector('b'), null, 'no live <b> element from sublabel');
  dd.destroy();
});

test('hidden input mirrors selected value and liveselect:change bubbles', { skip: !domAvailable }, () => {
  const host = mount();
  let detail = null;
  host.addEventListener('liveselect:change', (e) => { detail = e.detail; });

  const dd = new LiveSelect(host, {
    name: 'fruit',
    source: [{ value: 'apple', label: 'Apple' }],
  });
  dd._select({ value: 'apple', label: 'Apple', sublabel: '' });

  const hidden = host.querySelector('input[type=hidden][name=fruit]');
  assert.equal(hidden.value, 'apple');
  assert.equal(dd.getValue(), 'apple');
  assert.ok(detail && detail.value === 'apple' && detail.name === 'fruit');

  dd.clear();
  assert.equal(hidden.value, '');
  assert.equal(dd.getValue(), '');
  dd.destroy();
});

test('enhance() removes required from the hidden <select> (focusability bug)', { skip: !domAvailable }, () => {
  const host = mount();
  const sel = document.createElement('select');
  sel.name = 'country';
  sel.required = true;
  sel.innerHTML = '<option value="">Choose…</option><option value="ca">Canada</option>';
  host.appendChild(sel);

  const dd = LiveSelect.enhance(sel);

  assert.equal(sel.required, false, 'required dropped so a hidden control cannot block submit');
  assert.equal(sel.style.display, 'none', 'original select hidden');
  assert.equal(dd.opts.required, true, 'visible control keeps the * marker');

  // Selecting in the control syncs back into the original <select>.
  let nativeChange = false;
  sel.addEventListener('change', () => { nativeChange = true; });
  dd._select({ value: 'ca', label: 'Canada', sublabel: '' });
  assert.equal(sel.value, 'ca');
  assert.equal(nativeChange, true, 'native change re-fired so legacy listeners keep working');
  dd.destroy();
});

test('enhance() can create a brand-new option and reflect it into the select', { skip: !domAvailable }, () => {
  const host = mount();
  const sel = document.createElement('select');
  sel.name = 'city';
  sel.innerHTML = '<option value="">Choose…</option>';
  host.appendChild(sel);

  const dd = LiveSelect.enhance(sel);
  dd._select({ value: 'yyz', label: 'Toronto', sublabel: '' }); // value not originally in select
  assert.equal(sel.value, 'yyz');
  assert.ok(Array.prototype.some.call(sel.options, (o) => o.value === 'yyz'));
  dd.destroy();
});

test('renderOption: DOM-node template controls each row, nav hooks preserved', { skip: !domAvailable }, () => {
  const host = mount();
  const dd = new LiveSelect(host, {
    source: [{ value: 'ca', label: 'Canada', sublabel: 'CA', raw: { flag: '🇨🇦' } }],
    renderOption: (o, ctx) => {
      const span = document.createElement('span');
      span.className = 'flagrow';
      span.textContent = o.raw.flag + ' ' + o.label + ' #' + ctx.index;
      return span;
    },
  });
  dd.query = '';
  dd.isOpen = true;
  dd._runSearch();
  dd._renderMenu();

  const btn = dd.menu.querySelector('[data-liveselect-opt]');
  assert.ok(btn, 'outer button still owns the data-liveselect-opt hook');
  assert.equal(btn.getAttribute('data-liveselect-index'), '0');
  assert.equal(btn.querySelector('.flagrow').textContent, '🇨🇦 Canada #0');
  // Default label/sublabel spans are NOT emitted when a template renders.
  assert.equal(btn.querySelector('.liveselect__opt-label'), null);
  dd.destroy();
});

test('renderOption: string return is injected as HTML (caller owns escaping)', { skip: !domAvailable }, () => {
  const host = mount();
  const dd = new LiveSelect(host, {
    source: [{ value: '1', label: 'Acme', sublabel: 'corp' }],
    renderOption: (o, ctx) => '<em class="tmpl">' + ctx.escapeHtml(o.label) + '</em>',
  });
  dd.query = ''; dd.isOpen = true; dd._runSearch(); dd._renderMenu();
  const em = dd.menu.querySelector('.tmpl');
  assert.ok(em, 'string template HTML is parsed into the row');
  assert.equal(em.textContent, 'Acme');
  dd.destroy();
});

test('renderOption: returning null falls back to default escaped rendering', { skip: !domAvailable }, () => {
  const host = mount();
  const dd = new LiveSelect(host, {
    source: [{ value: '1', label: '<b>x</b>', sublabel: 'sub' }],
    renderOption: () => null,   // opt out per-row → default render
  });
  dd.query = ''; dd.isOpen = true; dd._runSearch(); dd._renderMenu();
  assert.ok(dd.menu.querySelector('.liveselect__opt-label'), 'default label span present');
  assert.equal(dd.menu.querySelector('b'), null, 'default render still escapes markup');
  dd.destroy();
});

test('renderCreate: custom template for the [+ Add] row', { skip: !domAvailable }, () => {
  const host = mount();
  const dd = new LiveSelect(host, {
    source: [],
    allowCreate: true,
    onCreate: (q) => ({ value: q, label: q }),
    renderCreate: (q) => {
      const b = document.createElement('strong');
      b.className = 'mk';
      b.textContent = 'Create “' + q + '”';
      return b;
    },
  });
  dd.query = 'Zeta'; dd.isOpen = true; dd.results = []; dd._renderMenu();
  const createBtn = dd.menu.querySelector('[data-liveselect-create]');
  assert.ok(createBtn, 'create button keeps its data-liveselect-create hook');
  assert.equal(createBtn.querySelector('.mk').textContent, 'Create “Zeta”');
  dd.destroy();
});

test('a11y: options get ids, aria-selected + input aria-activedescendant track the active row', { skip: !domAvailable }, () => {
  const host = mount();
  const dd = new LiveSelect(host, {
    source: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Bravo' }],
  });
  // input is wired to the listbox
  assert.equal(dd.input.getAttribute('role'), 'combobox');
  assert.equal(dd.input.getAttribute('aria-controls'), dd.menu.id);
  assert.ok(dd.menu.id, 'menu has an id for aria-controls');

  dd.query = ''; dd.isOpen = true; dd._runSearch();
  dd.activeIndex = 1; dd._renderMenu();

  const opts = dd.menu.querySelectorAll('[data-liveselect-opt]');
  assert.equal(opts.length, 2);
  assert.ok(opts[0].id && opts[1].id, 'each option has an id');
  assert.equal(opts[1].getAttribute('aria-selected'), 'true');
  assert.equal(opts[0].getAttribute('aria-selected'), 'false');
  assert.equal(dd.input.getAttribute('aria-activedescendant'), opts[1].id);

  // live region announces the result count
  assert.match(dd.liveEl.textContent, /2 results available/);
  dd.destroy();
});

test('AbortSignal: a superseding search aborts the previous request signal', { skip: !domAvailable }, () => {
  if (typeof AbortController === 'undefined') return; // older runtime: feature absent by design
  const host = mount();
  let firstSignal = null;
  const dd = new LiveSelect(host, {
    debounce: 0,
    source: (q, ctx) => {
      if (firstSignal === null) firstSignal = ctx.signal;
      return new Promise(() => {});   // never resolves → stays in-flight
    },
  });
  dd.query = 'a';  dd._runSearch();   // first request
  assert.ok(firstSignal, 'source received an AbortSignal in ctx');
  assert.equal(firstSignal.aborted, false);

  dd.query = 'ab'; dd._runSearch();   // supersedes → must abort the first
  assert.equal(firstSignal.aborted, true);
  dd.destroy();
});

test('grouped options: results are stably reordered and group headers rendered', { skip: !domAvailable }, () => {
  const host = mount();
  const dd = new LiveSelect(host, {
    source: [
      { value: '1', label: 'Apple',  group: 'Fruit' },
      { value: '2', label: 'Carrot', group: 'Veg' },
      { value: '3', label: 'Banana', group: 'Fruit' },
    ],
  });
  dd.query = ''; dd.isOpen = true; dd._runSearch(); dd._renderMenu();

  // Fruit items grouped together first (first-seen order), Veg after.
  assert.deepEqual(dd.results.map((o) => o.value), ['1', '3', '2']);
  const heads = Array.from(dd.menu.querySelectorAll('.liveselect__group')).map((h) => h.textContent);
  assert.deepEqual(heads, ['Fruit', 'Veg']);
  // Active-index navigation still maps to the (reordered) results array.
  assert.equal(dd.menu.querySelectorAll('[data-liveselect-opt]').length, 3);
  dd.destroy();
});

test('groupBy function takes precedence over option.group', { skip: !domAvailable }, () => {
  const host = mount();
  const dd = new LiveSelect(host, {
    source: [{ value: 'a', label: 'Ann' }, { value: 'b', label: 'Bob' }, { value: 'c', label: 'Amy' }],
    groupBy: (o) => o.label[0],   // group by first letter
  });
  dd.query = ''; dd.isOpen = true; dd._runSearch(); dd._renderMenu();
  assert.deepEqual(dd.results.map((o) => o.value), ['a', 'c', 'b']); // A-group (Ann, Amy) then B (Bob)
  const heads = Array.from(dd.menu.querySelectorAll('.liveselect__group')).map((h) => h.textContent);
  assert.deepEqual(heads, ['A', 'B']);
  dd.destroy();
});

test('disabled option: not selectable by click/Enter, skipped by keyboard nav', { skip: !domAvailable }, () => {
  const host = mount();
  let changed = 0;
  const dd = new LiveSelect(host, {
    source: [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Bravo', disabled: true },
      { value: 'c', label: 'Charlie' },
    ],
    onChange: () => { changed++; },
  });
  dd.query = ''; dd.isOpen = true; dd._runSearch(); dd._renderMenu();

  const rows = dd.menu.querySelectorAll('[data-liveselect-opt]');
  assert.equal(rows[1].getAttribute('aria-disabled'), 'true');
  assert.ok(rows[1].disabled, 'disabled row is a disabled button');

  // Direct select of a disabled option is a no-op.
  dd._select(dd.results[1]);
  assert.equal(dd.getValue(), '');
  assert.equal(changed, 0);

  // ArrowDown from -1 lands on Alpha (0), next ArrowDown skips Bravo → Charlie (2).
  dd._handleKeydown({ key: 'ArrowDown', preventDefault() {} });
  assert.equal(dd.activeIndex, 0);
  dd._handleKeydown({ key: 'ArrowDown', preventDefault() {} });
  assert.equal(dd.activeIndex, 2, 'disabled Bravo skipped');
  dd.destroy();
});

test('required: visible input enforces selection via Constraint Validation', { skip: !domAvailable }, () => {
  const host = mount();
  const dd = new LiveSelect(host, {
    required: true,
    source: [{ value: 'a', label: 'Alpha' }],
  });
  // Nothing selected → invalid with the required message.
  assert.equal(dd.input.validity.valid, false);
  assert.match(dd.input.validationMessage, /select/i);

  dd._select({ value: 'a', label: 'Alpha', sublabel: '' });
  assert.equal(dd.input.validity.valid, true, 'valid once a selection exists');

  dd.clear();
  assert.equal(dd.input.validity.valid, false, 'invalid again after clear');
  dd.destroy();
});

test('highlight: matched substring wrapped in <mark> (and stays XSS-safe)', { skip: !domAvailable }, () => {
  const host = mount();
  const dd = new LiveSelect(host, {
    highlight: true,
    source: [{ value: '1', label: 'Banana' }, { value: '2', label: '<b>nano</b>' }],
  });
  dd.query = 'nan'; dd.isOpen = true; dd._runSearch(); dd._renderMenu();

  const marks = dd.menu.querySelectorAll('.liveselect__mark');
  assert.ok(marks.length >= 1, 'a match is highlighted');
  assert.equal(marks[0].textContent.toLowerCase(), 'nan');
  assert.equal(dd.menu.querySelector('b'), null, 'markup in label is still escaped, not parsed');
  dd.destroy();
});

test('Showing N of M footer from array source capped by limit', { skip: !domAvailable }, () => {
  const host = mount();
  const source = Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: 'Item ' + i }));
  const dd = new LiveSelect(host, { source, limit: 3 });
  dd.query = ''; dd.isOpen = true; dd._runSearch(); dd._renderMenu();

  assert.equal(dd.menu.querySelectorAll('[data-liveselect-opt]').length, 3);
  const more = dd.menu.querySelector('.liveselect__more');
  assert.ok(more, 'footer rendered');
  assert.equal(more.textContent, 'Showing 3 of 10');
  dd.destroy();
});

test('async source: { items, total } drives the footer; cache skips refetch', { skip: !domAvailable }, async () => {
  const host = mount();
  let calls = 0;
  const dd = new LiveSelect(host, {
    debounce: 0,
    cache: true,
    source: (q) => { calls++; return Promise.resolve({ items: [{ value: 'x', label: 'X' }], total: 42 }); },
  });
  dd.query = 'ab'; dd.isOpen = true; dd._runSearch();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls, 1);
  assert.equal(dd._total, 42);
  assert.equal(dd.menu.querySelector('.liveselect__more').textContent, 'Showing 1 of 42');

  // Same query again → served from cache, no second call.
  dd.results = []; dd._runSearch();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls, 1, 'cache hit, source not called again');
  assert.equal(dd.results.length, 1);
  dd.destroy();
});

test('lifecycle events: open / close / search bubble', { skip: !domAvailable }, () => {
  const host = mount();
  const seen = [];
  ['open', 'close', 'search'].forEach((t) =>
    host.addEventListener('liveselect:' + t, (e) => seen.push([t, e.detail.query])));
  const dd = new LiveSelect(host, { debounce: 0, source: [{ value: 'a', label: 'Alpha' }] });

  dd._setOpen(true);
  dd.query = 'al'; dd._runSearch();
  dd._setOpen(false);

  assert.deepEqual(seen.map((s) => s[0]), ['open', 'search', 'close']);
  assert.equal(seen.find((s) => s[0] === 'search')[1], 'al');
  dd.destroy();
});
