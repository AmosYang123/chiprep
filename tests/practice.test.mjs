import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPractice, rateWord, wordKey} from '../dist/practice.js';

const words = [{hanzi:'冬天',pinyin:'dōng tiān'}, {hanzi:'夏天',pinyin:'xià tiān'}];
test('forgotten words rotate back into practice; remembered words retire', () => {
  const initial = createPractice(words);
  const again = rateWord(initial, false);
  assert.deepEqual(again.queue, [words[1], words[0]]);
  assert.equal(again.learned.length, 0);
  const learned = rateWord(again, true);
  assert.deepEqual(learned.queue, [words[0]]);
  assert.deepEqual(learned.learned, [wordKey(words[1])]);
  const done = rateWord(learned, true);
  assert.equal(done.queue.length, 0);
  assert.equal(done.learned.length, 2);
  assert.equal(rateWord(done, false), done);
  assert.deepEqual(initial.queue, words);
});
test('a lone forgotten word remains and can later be memorized', () => {
  const practice = createPractice([words[0]]);
  assert.deepEqual(rateWord(practice,false),practice);
  assert.equal(rateWord(rateWord(practice,false),true).queue.length,0);
});
test('saved progress resumes, duplicates collapse and edited readings return', () => {
  const saved = [wordKey(words[0])];
  assert.deepEqual(createPractice([...words, words[0]],saved),{total:2,learned:saved,queue:[words[1]]});
  const changed = {...words[0],pinyin:'dōng tian'};
  assert.deepEqual(createPractice([changed],saved).queue,[changed]);
});
