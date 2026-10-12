import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSets, visibleList, editSet, addSet, renameSet, removeSet, totalListLength } from '../src/sets.js';

test('legacy words migrate into one named set without losing their text', () => {
  const sets = loadSets(undefined, '你好|nǐ hǎo\n图书馆|tú shū guǎn');
  assert.deepEqual(sets, { items: [{ id: 'initial', name: 'My words', list: '你好|nǐ hǎo\n图书馆|tú shū guǎn' }], active: 'initial' });
  assert.equal(visibleList(sets), sets.items[0].list);
});

test('All combines sets by exact word key while individual edits stay scoped', () => {
  const first = loadSets(undefined, '你好|nǐ hǎo');
  const second = { ...first, items: [...first.items, { id: 'two', name: 'More', list: '你好|nǐ hǎo\n你好|ní hǎo\n朋友|péng you' }], active: 'all' };
  assert.equal(visibleList(second), '你好|nǐ hǎo\n你好|ní hǎo\n朋友|péng you');
  const edited = editSet(second, 'two', '明天|míng tiān');
  assert.equal(edited.items[0].list, first.items[0].list);
  assert.equal(totalListLength(edited), first.items[0].list.length + '明天|míng tiān'.length);
});

test('create, rename and delete retain other sets; a saved snapshot restores deletion', () => {
  const initial = loadSets(undefined, '你好|nǐ hǎo');
  const created = addSet(initial, 'second', 'Chapter 2');
  const edited = editSet(created, 'second', '朋友|péng you');
  const renamed = renameSet(edited, 'Friends');
  const snapshot = structuredClone(renamed);
  const deleted = removeSet(renamed);
  assert.deepEqual(deleted, initial);
  assert.equal(snapshot.items[1].name, 'Friends');
  assert.equal(snapshot.items[1].list, '朋友|péng you');
  assert.equal(visibleList(snapshot), '朋友|péng you');
  assert.deepEqual(removeSet(initial), { items: [{ id: 'initial', name: 'My words', list: '' }], active: 'initial' });
});
