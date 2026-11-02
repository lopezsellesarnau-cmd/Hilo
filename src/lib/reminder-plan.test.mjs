// Run: node --test src/lib/reminder-plan.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SNOOZE, toReplace } from './reminder-plan.ts';

const scheduled = (identifier, data) => ({ identifier, content: { data } });

test('going back Home keeps the "remind me later" she just asked for', () => {
  const now = [
    scheduled('talk', { url: '/talk' }),
    scheduled('pill-9', { url: '/pills' }),
    scheduled('later', { url: '/pills', kind: SNOOZE }),
  ];
  assert.deepEqual(toReplace(now), ['talk', 'pill-9']);
});

test('reminders without data are replaced too', () => {
  assert.deepEqual(toReplace([scheduled('old', null)]), ['old']);
});
