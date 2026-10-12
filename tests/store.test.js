import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyStore } from '../src/store.js';

function storage(values = {}) {
  const entries = new Map(Object.entries(values).map(([key, value]) => [`ting-clone-${key}`, JSON.stringify(value)]));
  return { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

test('frontend migrates preview data without overwriting an existing workspace', async () => {
  const disk = storage({ list: 'preview', 'learned-listen': ['known'] });
  const writes = [];
  const fresh = createStudyStore(disk, async (_, options) => {
    if (!options) return json({ state: {} });
    writes.push(JSON.parse(options.body).updates);
    return json({ success: true });
  });
  await fresh.initialize();
  assert.equal(fresh.read('list', ''), 'preview');
  assert.deepEqual(writes, [{ list: 'preview', 'learned-listen': ['known'] }]);
  const existing = createStudyStore(disk, async () => json({ state: { list: 'server' } }));
  await existing.initialize();
  assert.equal(existing.read('list', ''), 'server');
});

test('failed saves retain pending edits across reload and recover on retry', async () => {
  const disk = storage();
  const messages = [];
  let online = true;
  let hold = false;
  const fetcher = async (_, options) => {
    if (!options) return json({ state: { list: 'old' } });
    if (!online) throw new Error('Offline');
    return json({ success: true });
  };
  const first = createStudyStore(disk, fetcher, message => messages.push(message));
  await first.initialize();
  online = false;
  first.write('list', 'new');
  await first.flush();
  assert.match(messages.at(-1), /kept on this device/);
  assert.deepEqual(JSON.parse(disk.getItem('ting-clone-pending')), { list: 'new' });
  online = true;
  await first.flush();
  // Simulate an edit waiting to be saved when the page reloads.
  disk.setItem('ting-clone-pending', JSON.stringify({ list: 'latest' }));
  const reloaded = createStudyStore(disk, fetcher);
  await reloaded.initialize();
  assert.equal(reloaded.read('list', ''), 'latest');
  assert.deepEqual(JSON.parse(disk.getItem('ting-clone-pending')), {});
});

test('edits made during an in-flight save are sent afterward', async () => {
  const disk = storage();
  let release;
  const writes = [];
  const store = createStudyStore(disk, async (_, options) => {
    if (!options) return json({ state: { list: 'initial' } });
    writes.push(JSON.parse(options.body).updates.list);
    if (writes.length === 1) await new Promise(resolve => { release = resolve; });
    return json({ success: true });
  });
  await store.initialize();
  store.write('list', 'first');
  const save = store.flush();
  store.write('list', 'second');
  release();
  await save;
  await store.flush();
  assert.deepEqual(writes, ['first', 'second']);
  assert.deepEqual(JSON.parse(disk.getItem('ting-clone-pending')), {});
});

test('sets are recovered offline, retried after reload, and preserved during an in-flight save', async () => {
  const disk = storage();
  const firstSets = { items: [{ id: 'initial', name: 'First', list: 'one' }], active: 'initial' };
  const latestSets = { items: [{ id: 'set-1', name: 'Latest', list: 'two' }], active: 'set-1' };
  let online = true;
  let hold = false;
  let release;
  const writes = [];
  const fetcher = async (_, options) => {
    if (!options) return json({ state: {} });
    writes.push(JSON.parse(options.body).updates);
    if (!online) throw new Error('Offline');
    if (hold) { hold = false; await new Promise(resolve => { release = resolve; }); }
    return json({ success: true });
  };
  const store = createStudyStore(disk, fetcher);
  await store.initialize();
  online = false;
  store.write('sets', firstSets);
  await store.flush();
  assert.deepEqual(JSON.parse(disk.getItem('ting-clone-pending')), { sets: firstSets });
  online = true;
  await store.flush();
  assert.deepEqual(JSON.parse(disk.getItem('ting-clone-pending')), {});
  hold = true;
  store.write('sets', firstSets);
  const save = store.flush();
  store.write('sets', latestSets);
  release();
  await save;
  await store.flush();
  assert.deepEqual(writes.slice(-2).map(update => update.sets), [firstSets, latestSets]);
  assert.deepEqual(JSON.parse(disk.getItem('ting-clone-pending')), {});
});

test('sets migration does not overwrite an existing server workspace and object reads reject malformed values', async () => {
  const sets = { items: [], active: 'all' };
  const disk = storage({ sets });
  const writes = [];
  const store = createStudyStore(disk, async (_, options) => {
    if (options) writes.push(JSON.parse(options.body).updates);
    return json({ state: { sets: { items: [{ id: 'server', name: 'Server', list: 'kept' }], active: 'server' } } });
  });
  await store.initialize();
  assert.equal(store.read('sets', {}).items[0].id, 'server');
  assert.deepEqual(writes, []);
  assert.deepEqual(store.read('missing-object', { items: [], active: 'all' }), { items: [], active: 'all' });
  assert.deepEqual(store.read('sets', []), []);
});
