import { pinyin } from 'pinyin-pro';

export function parseList(text) {
  return text.split(/\r?\n/).flatMap(line => {
    const [characters, ...reading] = line.split('|');
    const hanzi = characters.trim();
    if (!hanzi) return [];
    return [{ hanzi, pinyin: reading.join('|').trim() || (/\p{Script=Han}/u.test(hanzi) ? pinyin(hanzi) : '') }];
  });
}

export function keyFor(word) {
  return JSON.stringify([word.hanzi, word.pinyin.normalize('NFC')]);
}

export function normalizeReading(value, strict = true) {
  const accents = { '\u0304': '1', '\u0301': '2', '\u030c': '3', '\u0300': '4' };
  let text = value.toLowerCase().replace(/u:/g, 'v').normalize('NFD').replace(/u\u0308/g, 'v');
  text = text.replace(/([a-z]+)([\u0304\u0301\u030c\u0300])([a-z]*)/g, (_, before, accent, after) => before + after + accents[accent]);
  text = text.replace(/[\s'’\-]/g, '').replace(/[05]/g, '');
  return strict ? text : text.replace(/[1-4]/g, '');
}

export function correctReading(answer, expected, strict) {
  return Boolean(answer.trim() && expected.trim()) && normalizeReading(answer, strict) === normalizeReading(expected, strict);
}

export function splitText(text) {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  return [...segmenter.segment(text)].filter(part => part.isWordLike && /\p{Script=Han}/u.test(part.segment)).map(part => part.segment);
}

export function formatList(text) {
  return text.split(/\r?\n/).flatMap(line => {
    if (line.includes('|')) return [line];
    const words = splitText(line);
    return words.length ? words.map(hanzi => parseList(hanzi)[0]).map(word => `${word.hanzi}|${word.pinyin}`) : [line];
  }).join('\n');
}

export function addPhotoText(current, text) {
  const prior = new Set(parseList(current).map(word => word.hanzi));
  const cleaned = text.replace(/(\p{Script=Han})[ \t]+(?=\p{Script=Han})/gu, '$1');
  const added = [...new Set(splitText(cleaned))].filter(hanzi => !prior.has(hanzi));
  return { added: added.length, value: [current.trimEnd(), ...added.map(hanzi => { const word = parseList(hanzi)[0]; return `${word.hanzi}|${word.pinyin}`; })].filter(Boolean).join('\n') };
}

export function addDictationText(current, text) {
  const prior = new Set(parseList(current).map(word => word.hanzi));
  // Speech pauses and punctuation delimit entries; splitting compounds can change the intended word.
  const added = [...new Set(text.match(/\p{Script=Han}+/gu) || [])].filter(hanzi => !prior.has(hanzi));
  return { added: added.length, value: [current.trimEnd(), ...added.map(hanzi => { const word = parseList(hanzi)[0]; return `${word.hanzi}|${word.pinyin}`; })].filter(Boolean).join('\n') };
}
