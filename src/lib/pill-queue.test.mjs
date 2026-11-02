// Run: node --test src/lib/
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DONE_MS, NEXT_MS, doneFor } from './pill-queue.ts';

const pill = (key, time, takenAt = null) => ({ key, medicationId: key, name: key, time, takenAt, eventId: null });

test('two 9:00 pills missed at 13:00: after the first, the second comes in 3 s', () => {
  const day = [pill('a', '09:00'), pill('b', '09:00'), pill('c', '20:00')];
  assert.equal(doneFor(day, 'a', '13:00'), NEXT_MS);
  assert.equal(NEXT_MS, 3000);
});

test('the last one due: "Done" stays the usual 10 s', () => {
  const day = [pill('a', '09:00', '13:00'), pill('b', '09:00'), pill('c', '20:00')];
  assert.equal(doneFor(day, 'b', '13:00'), DONE_MS);
});

test('a snoozed pill is not due yet', () => {
  const day = [pill('a', '09:00'), { ...pill('b', '09:00'), snoozedUntil: '13:30' }];
  assert.equal(doneFor(day, 'a', '13:00'), DONE_MS);
});
