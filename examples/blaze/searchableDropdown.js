/**
 * searchableDropdown.js — Blaze adapter for the framework-agnostic control.
 *
 * WHAT: Instantiates the vanilla SearchableDropdown inside a Blaze template and
 *       bridges Blaze's data context to it. The picker's data can come from:
 *         - a reactive array helper passed as `options`, OR
 *         - a Meteor method via the `methodBase`/`collectionKey` remote source.
 *
 * The same dist/searchable-dropdown.js + .css power this; Blaze only mounts it.
 *
 * DATA CONTEXT (all optional unless noted):
 *   name           hidden-input name for plain-form usage
 *   label          field label
 *   placeholder    placeholder text
 *   collectionKey  registry key when using a remote/Meteor-method source
 *   options        an array (or reactive array) for a local source
 *   value          initial selected value
 *   valueLabel     label for value
 *   allowCreate    show the "+ Add" row
 *   onSelect       function(value, option) called on selection
 *   onCreate       async function(query, ctx) => option|null
 */
import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';

// Adjust the path to wherever you vendor the dist file in your app.
import SearchableDropdown from '/dist/searchable-dropdown.js';

import './searchableDropdown.html';

/**
 * meteorSource — back the control with a Meteor method instead of HTTP.
 * Expects server methods named `${collectionKey}.search` / `.option` returning
 * the option shape { value, label, sublabel }.
 */
function meteorSource(collectionKey) {
  return {
    source(query, ctx) {
      return Meteor.callAsync(`${collectionKey}.search`, { query, scope: ctx.scope, limit: ctx.limit });
    },
    resolve(value) {
      return Meteor.callAsync(`${collectionKey}.option`, { id: value });
    },
  };
}

Template.searchableDropdown.onRendered(function () {
  const data = Template.currentData() || {};
  const mount = this.find('.sdd-blaze-mount');

  const opts = {
    name:        data.name || '',
    label:       data.label || '',
    placeholder: data.placeholder || 'Search…',
    value:       data.value || '',
    valueLabel:  data.valueLabel || '',
    allowCreate: !!data.allowCreate,
    onChange:    typeof data.onSelect === 'function' ? data.onSelect : undefined,
    onCreate:    typeof data.onCreate === 'function' ? data.onCreate : undefined,
  };

  if (Array.isArray(data.options)) {
    opts.source = data.options;
  } else if (data.collectionKey) {
    const src = meteorSource(data.collectionKey);
    opts.source  = src.source;
    opts.resolve = src.resolve;
  } else {
    opts.source = [];
  }

  this._sdd = new SearchableDropdown(mount, opts);
});

Template.searchableDropdown.onDestroyed(function () {
  if (this._sdd) this._sdd.destroy();
});
