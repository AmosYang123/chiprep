export function wordKey(item) {
  return JSON.stringify([item.hanzi.trim(), item.pinyin.trim().normalize('NFC')]);
}

export function uniqueWords(items) {
  return [...new Map(items.map(item => [wordKey(item), item])).values()];
}

// One pass over the words: each is tested once, then recorded as remembered or needing review.
export function createRound(items) {
  const queue = uniqueWords(items);
  return {total: queue.length, queue, results: []};
}

export function rateWord(round, remembered) {
  if (!round.queue.length) return round;
  const [word, ...rest] = round.queue;
  return {total: round.total, queue: rest, results: [...round.results, {word, remembered}]};
}

// Words are skipped by their characters, so a reading filled in or corrected later keeps the choice.
export function selectedWords(items, skipped = []) {
  const skip = new Set(skipped);
  return items.filter(item => !skip.has(item.hanzi));
}

export function groupWords(items, learned = []) {
  const known = new Set(learned);
  const words = uniqueWords(items);
  return {
    review: words.filter(item => !known.has(wordKey(item))),
    remembered: words.filter(item => known.has(wordKey(item)))
  };
}
