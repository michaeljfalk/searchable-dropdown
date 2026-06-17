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
    { value: 'apple', label: 'apple', sublabel: '', raw: 'apple' });
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
