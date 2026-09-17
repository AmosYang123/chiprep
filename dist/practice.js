export function wordKey(item) {
  return JSON.stringify([item.hanzi.trim(), item.pinyin.trim().normalize('NFC')]);
}

export function createPractice(items, learned = []) {
  const unique = [...new Map(items.map(item => [wordKey(item), item])).values()];
  const known = new Set(learned);
  return {
    total: unique.length,
    learned: unique.filter(item => known.has(wordKey(item))).map(wordKey),
    queue: unique.filter(item => !known.has(wordKey(item)))
  };
}

export function rateWord(practice, remembered) {
  if (!practice.queue.length) return practice;
  const [word, ...rest] = practice.queue;
  return {
    total: practice.total,
    learned: remembered ? [...practice.learned, wordKey(word)] : practice.learned,
    queue: remembered ? rest : [...rest, word]
  };
}
