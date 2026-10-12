import { keyFor, parseList } from './core.js';

export function loadSets(saved, legacy) {
  if (saved && Array.isArray(saved.items) && typeof saved.active === 'string' && saved.active.length <= 100
    && saved.items.length && saved.items.length <= 50
    && saved.items.every(item => item && typeof item.id === 'string' && item.id.trim() && item.id.length <= 100
      && typeof item.name === 'string' && item.name.trim() && item.name.length <= 100
      && typeof item.list === 'string' && item.list.length <= 100000)
    && totalListLength(saved) <= 100000
    && new Set(saved.items.map(item => item.id)).size === saved.items.length
    && (saved.active === 'all' || saved.items.some(item => item.id === saved.active))) return saved;
  return { items: [{ id: 'initial', name: 'My words', list: legacy }], active: 'initial' };
}

export function visibleList(sets) {
  if (sets.active !== 'all') return sets.items.find(item => item.id === sets.active)?.list || '';
  const words = new Map();
  for (const item of sets.items) for (const word of parseList(item.list)) if (!words.has(keyFor(word))) words.set(keyFor(word), `${word.hanzi}|${word.pinyin}`);
  return [...words.values()].join('\n');
}

export function editSet(sets, id, list) {
  return { ...sets, items: sets.items.map(item => item.id === id ? { ...item, list } : item) };
}

export function addSet(sets, id, name) { return { items: [...sets.items, { id, name, list: '' }], active: id }; }
export function renameSet(sets, name) { return { ...sets, items: sets.items.map(item => item.id === sets.active ? { ...item, name } : item) }; }
export function removeSet(sets) {
  const items = sets.items.filter(item => item.id !== sets.active);
  if (!items.length) items.push({ id: 'initial', name: 'My words', list: '' });
  return { items, active: items[0].id };
}

export function totalListLength(sets) { return sets.items.reduce((total, item) => total + item.list.length, 0); }
