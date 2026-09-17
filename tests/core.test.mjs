import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseWords,matchesPinyin,mandarinVoices} from '../dist/study-core.js';
test('parsing drops empty words and preserves supplied readings',()=>{
  assert.deepEqual(parseWords('银行|yín háng\n\n|bad\n你好',{你好:'nǐ hǎo'}),[{hanzi:'银行',pinyin:'yín háng'},{hanzi:'你好',pinyin:'nǐ hǎo'}]);
});
test('tone numbers and marks agree while wrong tones fail',()=>{
  assert.ok(matchesPinyin('ni3 hao3','nǐ hǎo'));
  assert.ok(matchesPinyin('xue2 xi2','xué xí'));
  assert.ok(!matchesPinyin('ni2 hao3','nǐ hǎo'));
  assert.ok(!matchesPinyin('',''));
  assert.ok(matchesPinyin('ni hao','nǐ hǎo',false));
});
test('umlaut remains distinct from u and neutral tones are optional',()=>{
  assert.ok(matchesPinyin('lv4','lǜ'));
  assert.ok(matchesPinyin('lu:4','lǜ'));
  assert.ok(!matchesPinyin('lu4','lǜ'));
  assert.ok(matchesPinyin('peng2 you5','péng you'));
});
test('voice list excludes Cantonese and ranks natural Mandarin first',()=>{
  const voices=[{name:'Cantonese',lang:'zh-HK'},{name:'English',lang:'en-US'},{name:'Basic',lang:'zh-CN'},{name:'Natural Mandarin',lang:'zh-CN'}];
  assert.deepEqual(mandarinVoices(voices).map(v=>v.name),['Natural Mandarin','Basic']);
});
