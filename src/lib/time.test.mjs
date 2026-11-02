// Run: node --test src/lib/time.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { msToNextMinute } from './time.ts';

test('Pills open at 8:59:30: it updates in 30 s, when the 9:00 pill is due', () => {
  assert.equal(msToNextMinute(new Date('2026-11-02T08:59:30.000')), 30_000);
});

test('exactly on the minute: waits a whole minute, never 0', () => {
  assert.equal(msToNextMinute(new Date('2026-11-02T09:00:00.000')), 60_000);
});
