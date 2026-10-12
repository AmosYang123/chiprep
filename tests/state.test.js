import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/server/db.js';
import { handleState } from '../src/server/state.js';

const origin = 'http://127.0.0.1:4322';
function request(method = 'GET', cookie, body, extra = {}) {
  return new Request(`${origin}/api/state`, { method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
}
async function session(db) { return (await handleState(request(), db)).headers.get('Set-Cookie').split(';')[0]; }

test('state API persists all modes and keeps browser sessions isolated', async () => {
  const db = openDatabase(':memory:');
  try {
    const first = await handleState(request(), db);
    assert.equal(first.status, 200);
    assert.match(first.headers.get('Set-Cookie'), /HttpOnly; SameSite=Strict/);
    const cookie = first.headers.get('Set-Cookie').split(';')[0];
    const other = await session(db);
    const updates = { list: '你好|nǐ hǎo', skip: ['朋友'], 'learned-listen': ['first'], 'learned-pinyin': ['second'], 'learned-pinyin-tones': ['third'], sets: { items: [{ id: 'initial', name: 'Daily', list: '你好' }], active: 'initial' } };
    assert.equal((await handleState(request('PATCH', cookie, { updates }), db)).status, 200);
    assert.deepEqual((await (await handleState(request('GET', cookie), db)).json()).state, updates);
    assert.deepEqual((await (await handleState(request('GET', other), db)).json()).state, {});
    assert.equal((await handleState(request('PATCH', cookie, { updates: { list: '' } }), db)).status, 200);
    assert.equal((await (await handleState(request('GET', cookie), db)).json()).state.list, '');
  } finally { db.close(); }
});

test('state API rejects missing sessions, cross-site requests and invalid bodies', async () => {
  const db = openDatabase(':memory:');
  try {
    const cookie = await session(db);
    await handleState(request('PATCH', cookie, { updates: { list: 'legacy' } }), db);
    assert.equal((await handleState(request('PATCH', undefined, { updates: { list: 'a' } }), db)).status, 401);
    assert.equal((await handleState(request('PATCH', cookie, { updates: { list: 'a' } }, { Origin: 'https://evil.example' }), db)).status, 403);
    assert.equal((await handleState(request('GET', cookie, undefined, { 'Sec-Fetch-Site': 'cross-site' }), db)).status, 403);
    const validSets = { items: [{ id: 'initial', name: 'Daily', list: 'one' }], active: 'initial' };
    const invalidSets = [
      { ...validSets, extra: true },
      { items: [{ id: 'same', name: 'One', list: '' }, { id: 'same', name: 'Two', list: '' }], active: 'same' },
      { ...validSets, active: 'missing' },
      { items: [{ id: ' ', name: 'Daily', list: '' }], active: 'all' },
      { items: [{ id: 'x'.repeat(101), name: 'Daily', list: '' }], active: 'all' },
      { items: [{ id: 'x', name: ' ', list: '' }], active: 'all' },
      { items: [{ id: 'x', name: 'x'.repeat(101), list: '' }], active: 'all' },
      { items: [{ id: 'x', name: 'Daily', list: 'x'.repeat(100001) }], active: 'all' },
      { items: Array.from({ length: 51 }, (_, index) => ({ id: String(index), name: 'Daily', list: '' })), active: 'all' },
      { items: [{ id: 'a', name: 'A', list: 'x'.repeat(50001) }, { id: 'b', name: 'B', list: 'x'.repeat(50000) }], active: 'all' },
    ];
    for (const body of ['bad JSON', { updates: {} }, { updates: { list: 3 } }, { updates: { secret: 'x' } }, { updates: { skip: [3] } }, { updates: { list: 'x'.repeat(100001) } }, ...invalidSets.map(sets => ({ updates: { list: 'must-not-save', sets } }))]) {
      assert.equal((await handleState(request('PATCH', cookie, body), db)).status, 400);
    }
    assert.equal((await handleState(request('PATCH', cookie, 'x'.repeat(262145)), db)).status, 413);
    assert.deepEqual((await (await handleState(request('GET', cookie), db)).json()).state, { list: 'legacy' });
    assert.equal((await handleState(request('PATCH', cookie, { updates: { sets: { items: [], active: 'all' } } }), db)).status, 200);
    assert.deepEqual((await (await handleState(request('GET', cookie), db)).json()).state.sets, { items: [], active: 'all' });
  } finally { db.close(); }
});

test('SQLite state survives reopening the database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ting-test-'));
  let db;
  try {
    const path = join(directory, 'study.sqlite');
    db = openDatabase(path);
    const cookie = await session(db);
    const sets = { items: [{ id: 'initial', name: 'Saved', list: 'persisted' }], active: 'initial' };
    await handleState(request('PATCH', cookie, { updates: { list: 'persisted', sets } }), db);
    db.close();
    db = openDatabase(path);
    assert.equal((await (await handleState(request('GET', cookie), db)).json()).state.list, 'persisted');
    assert.deepEqual((await (await handleState(request('GET', cookie), db)).json()).state.sets, sets);
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
});
