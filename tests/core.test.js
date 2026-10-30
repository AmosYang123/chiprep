import test from 'node:test';
import assert from 'node:assert/strict';
import { parseList, correctReading, formatList, addPhotoText, addDictationText, keyFor } from '../src/core.js';

test('word parsing fills missing readings and preserves manual corrections', () => {
  assert.deepEqual(parseList('你好\n\n朋友|péng yǒu\n|bad'), [
    { hanzi: '你好', pinyin: 'nǐ hǎo' },
    { hanzi: '朋友', pinyin: 'péng yǒu' },
  ]);
  assert.equal(parseList('中国')[0].pinyin, 'zhōng guó');
});

test('tone checking accepts numbers, marks and umlauts but rejects wrong tones', () => {
  assert.equal(correctReading('ni3 hao3', 'nǐ hǎo', true), true);
  assert.equal(correctReading('ni2 hao3', 'nǐ hǎo', true), false);
  assert.equal(correctReading('ni hao', 'nǐ hǎo', false), true);
  for (const answer of ['nv3', 'nu:3', 'nǚ']) assert.equal(correctReading(answer, 'nǚ', true), true);
  assert.equal(correctReading('peng2 you5', 'péng you', true), true);
  assert.equal(correctReading('', 'nǐ hǎo', false), false);
});

test('splitting does not drop manual readings', () => {
  assert.equal(formatList('你好朋友|manual reading'), '你好朋友|manual reading');
  assert.equal(parseList(formatList('你好，朋友')).length, 2);
});

test('photo text adds only new words and joins OCR character spacing', () => {
  const result = addPhotoText('你好|nǐ hǎo', '你 好\n朋 友');
  assert.equal(result.added, 1);
  assert.equal(result.value, '你好|nǐ hǎo\n朋友|péng yǒu');
  assert.equal(keyFor({ hanzi: '你', pinyin: 'nǐ' }), keyFor({ hanzi: '你', pinyin: 'ni\u030c' }));
});

test('automatic readings use phrase context and preserve explicit corrections', () => {
  for (const [hanzi, reading] of [['朋友', 'péng yǒu'], ['银行', 'yín háng'], ['音乐', 'yīn yuè'], ['重庆', 'chóng qìng'], ['长大', 'zhǎng dà'], ['重复', 'chóng fù']]) {
    assert.equal(parseList(hanzi)[0].pinyin, reading);
  }
  assert.equal(parseList('银行|custom reading')[0].pinyin, 'custom reading');
});

test('each finalized dictation result stays together as one pause-delimited phrase', () => {
  const result = addDictationText('朋友|péng you', '我想，去图书馆。');
  assert.equal(result.added, 1);
  assert.equal(result.value, '朋友|péng you\n我想去图书馆|wǒ xiǎng qù tú shū guǎn');
  assert.deepEqual(addDictationText(result.value, '我想去图书馆'), { added: 0, value: result.value });
  assert.deepEqual(addDictationText(result.value, '... 123 hello'), { added: 0, value: result.value });
});
