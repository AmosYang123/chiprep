import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRound, rateWord, groupWords, wordKey, selectedWords} from '../dist/practice.js';

const words = [{hanzi:'冬天',pinyin:'dōng tiān'}, {hanzi:'夏天',pinyin:'xià tiān'}];
test('a round tests every word exactly once, forgotten or not', () => {
  const round = createRound([...words, words[0]]);
  assert.equal(round.total, 2);
  const first = rateWord(round, false);
  assert.deepEqual(first.queue, [words[1]]);
  const done = rateWord(first, true);
  assert.deepEqual(done.queue, []);
  assert.deepEqual(done.results, [{word:words[0],remembered:false},{word:words[1],remembered:true}]);
  assert.equal(rateWord(done, false), done);
});
test('words split into review and remembered groups; edited readings need review', () => {
  assert.deepEqual(groupWords(words,[wordKey(words[1])]),{review:[words[0]],remembered:[words[1]]});
  const changed = {...words[1],pinyin:'xià tian'};
  assert.deepEqual(groupWords([changed],[wordKey(words[1])]).review,[changed]);
});
test('selected words drop the skipped characters, whatever their reading', () => {
  assert.deepEqual(selectedWords(words, ['夏天']), [words[0]]);
  assert.deepEqual(selectedWords([{hanzi:'夏天',pinyin:''}], ['夏天']), []);
  assert.deepEqual(selectedWords(words), words);
});
