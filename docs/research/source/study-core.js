export function parseWords(text, dictionary = {}) {
  return text.split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => {
    const [word, ...rest] = line.split('|');
    const hanzi = word.trim();
    return {hanzi, pinyin:rest.join('|').trim() || dictionary[hanzi] || ''};
  }).filter(item => item.hanzi);
}

export function normalizePinyin(value, strict = true) {
  const tones = {'̄':'1','́':'2','̌':'3','̀':'4'};
  let text = value.toLowerCase().replace(/u:|ü/g,'v').normalize('NFD');
  text = text.replace(/u\u0308/g,'v').replace(/([a-z]+)([\u0304\u0301\u030c\u0300])([a-z]*)/g,(_,before,tone,after) => before + after + tones[tone]);
  text = text.replace(/[\s'’\-]+/g,'').replace(/0/g,'5');
  if (!strict) return text.replace(/[1-5]/g,'');
  return text.replace(/5/g,'');
}

export function matchesPinyin(answer, expected, strict = true) {
  return Boolean(answer.trim() && expected.trim()) && normalizePinyin(answer,strict) === normalizePinyin(expected,strict);
}

export function mandarinVoices(voices) {
  return voices.filter(voice => /^(zh(?:[-_](?:CN|TW|SG|Hans|Hant))?|cmn)(?:[-_]|$)/i.test(voice.lang) && !/cantonese|hong kong/i.test(voice.name))
    .sort((a,b) => voiceRank(b)-voiceRank(a));
}
function voiceRank(voice) {
  return (/premium|enhanced|natural|neural/i.test(voice.name)?10:0) + (/tingting|sinyi|meijia|xiaoxiao|yunxi|google/i.test(voice.name)?5:0) + (/zh[-_]CN/i.test(voice.lang)?3:0) + (!voice.localService?1:0);
}
