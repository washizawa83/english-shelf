const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldFocusSearch } = require('../src/renderer/shortcut');

const base = { key: 'f', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, repeat: false, isComposing: false, keyCode: 70 };

test('Ctrl+F focuses search', () => {
  assert.equal(shouldFocusSearch(base), true);
  assert.equal(shouldFocusSearch({ ...base, key: 'F' }), true);
});

test('search shortcut does not interrupt IME or unrelated key combinations', () => {
  assert.equal(shouldFocusSearch({ ...base, isComposing: true }), false);
  assert.equal(shouldFocusSearch({ ...base, keyCode: 229 }), false);
  assert.equal(shouldFocusSearch({ ...base, repeat: true }), false);
  assert.equal(shouldFocusSearch({ ...base, ctrlKey: false }), false);
  assert.equal(shouldFocusSearch({ ...base, shiftKey: true }), false);
  assert.equal(shouldFocusSearch({ ...base, key: 'g' }), false);
});
