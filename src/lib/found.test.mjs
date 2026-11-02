// Run: node --test src/lib/found.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { missing } from './found.ts';

test('no internet: the query failed, so she is not "missing" (no Welcome, no "not connected")', () => {
  assert.equal(missing({ data: null, error: { message: 'TypeError: Network request failed' } }), false);
});

test('the query worked and found nobody: missing', () => {
  assert.equal(missing({ data: null, error: null }), true);
});

test('found', () => {
  assert.equal(missing({ data: { id: '1' }, error: null }), false);
});
