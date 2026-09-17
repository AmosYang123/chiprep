import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withPinyin,transcriptLines,setupDictation,formatStudyList} from '../dist/dictation.js';
test('generates phrase readings while preserving supplied answers',()=>{
  assert.equal(withPinyin('银行\n重庆\n女\n你好|ni3 hao3'),'银行|yín háng\n重庆|chóng qìng\n女|nǚ\n你好|ni3 hao3');
  assert.equal(withPinyin(''), '');
});
test('splits punctuation without splitting multi-character words',()=>{
  assert.deepEqual(transcriptLines('你好，图书馆。学习！'),['你好','图书馆','学习']);
});
test('splits the reported run-on vocabulary into full words',()=>{
  assert.deepEqual(transcriptLines('但那么，非常糟糕，面试，热，冬天夏天春天秋天舒服，加州'),['但','那么','非常','糟糕','面试','热','冬天','夏天','春天','秋天','舒服','加州']);
});
test('smart formatting repairs existing lines while preserving supplied tones',()=>{
  assert.equal(formatStudyList('冬天夏天春天秋天舒服|dōng tiān xià tiān chūn tiān qiū tiān shū fu'),'冬天|dōng tiān\n夏天|xià tiān\n春天|chūn tiān\n秋天|qiū tiān\n舒服|shū fu');
  assert.equal(formatStudyList('但那么|custom-reading'),'但那么|custom-reading');
  assert.equal(formatStudyList('图书馆|tú shū guǎn'),'图书馆|tú shū guǎn');
  assert.equal(formatStudyList('冬天夏天'),'冬天|dōng tiān\n夏天|xià tiān');
});
function harness(Recognition){
  const added=[],busy=[];
  const button={textContent:'',disabled:false,setAttribute(){}};
  const status={textContent:''};
  const cancel=setupDictation({Recognition,button,status,append:words=>added.push(...words),beforeStart(){},onBusy:value=>busy.push(value)});
  return {added,busy,button,status,cancel};
}
test('unsupported browsers get a useful fallback',()=>{
  const h=harness(undefined);assert.equal(h.button.disabled,true);assert.match(h.status.textContent,/keyboard/);
});
test('only final results append, stops safely and ignores stale events',()=>{
  let instance;
  class Recognition {constructor(){instance=this}start(){}stop(){this.onend()}abort(){}}
  const h=harness(Recognition);h.button.onclick();
  const result=(text,isFinal)=>Object.assign([{transcript:text}],{isFinal});
  instance.onresult({resultIndex:0,results:[result('你',false)]});assert.deepEqual(h.added,[]);
  instance.onresult({resultIndex:0,results:[result('你好',true)]});
  instance.onresult({resultIndex:1,results:[result('你好',true),result('朋友',true)]});
  assert.deepEqual(h.added,['你好','朋友']);
  h.button.onclick();assert.equal(h.button.disabled,false);assert.equal(h.busy.at(-1),false);
  h.button.onclick();const stale=instance;h.cancel();stale.onresult({resultIndex:0,results:[result('额外',true)]});assert.equal(h.added.length,2);
});
test('permission errors remain visible after recognition ends',()=>{
  let instance;class Recognition{constructor(){instance=this}start(){}}
  const h=harness(Recognition);h.button.onclick();instance.onerror({error:'not-allowed'});instance.onend();
  assert.match(h.status.textContent,/denied/);assert.equal(h.button.disabled,false);
});
