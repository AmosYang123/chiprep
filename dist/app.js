import {parseWords,matchesPinyin,mandarinVoices} from './study-core.js';
import {withPinyin, setupDictation, formatStudyList} from './dictation.js';
import {createPractice, rateWord, wordKey} from './practice.js';
const $ = selector => document.querySelector(selector);
const phraseMap={"你好":"nǐ hǎo","朋友":"péng you","学习":"xué xí","图书馆":"tú shū guǎn","明天":"míng tiān","中国":"zhōng guó","中文":"zhōng wén","老师":"lǎo shī","学生":"xué sheng","谢谢":"xiè xie","再见":"zài jiàn","银行":"yín háng","东西":"dōng xi","什么":"shén me","喜欢":"xǐ huan","认识":"rèn shi","工作":"gōng zuò","学校":"xué xiào","北京":"běi jīng","今天":"jīn tiān","昨天":"zuó tiān","天气":"tiān qì","吃饭":"chī fàn","喝水":"hē shuǐ","可以":"kě yǐ","没有":"méi yǒu","多少":"duō shao","名字":"míng zi","家人":"jiā rén"};
let mode='listen',items=[],index=0,answered=false,active=false,voices=[],utterance=null,speechId=0;
let practice=createPractice([]), revealed=false, correct=false;
function progressKey(){return 'ting-learned-'+mode+(mode==='pinyin'&&$('#strict').checked?'-tones':'')}
function learnedWords(){try{const value=JSON.parse(localStorage.getItem(progressKey())||'[]');return Array.isArray(value)?value.filter(key=>typeof key==='string'):[]}catch{return []}}
function saveProgress(){try{localStorage.setItem(progressKey(),JSON.stringify([...new Set([...learnedWords(),...practice.learned])]))}catch{}}
function updateSummary(){const state=createPractice(parseWords(withPinyin($('#words').value),phraseMap),learnedWords());$('#savedProgress').textContent=state.learned.length+' of '+state.total+' memorized in this mode. Progress is saved on this device.';$('#resetProgress').disabled=!state.learned.length;}
const synth=window.speechSynthesis;
const initialStage=$('.stage').innerHTML;
try { const saved=localStorage.getItem('ting-list'); if(saved!==null) $('#words').value=saved; } catch {}
function save(){try{localStorage.setItem('ting-list',$('#words').value)}catch{}}
function count(){let el=$('#wordCount');if(!el){el=document.createElement('span');el.id='wordCount';el.className='count';$('label[for="words"]').append(el)}el.textContent=parseWords($('#words').value).length+' words';updateSummary()}
function stop(){speechId++;synth?.cancel();$('.stage').classList.remove('speaking')}
function loadVoices(){
  const selected=$('#voice').value;voices=mandarinVoices(synth?.getVoices()||[]);$('#voice').replaceChildren();
  voices.forEach(v=>{const option=document.createElement('option');option.value=v.voiceURI;option.textContent=v.name+' · '+v.lang;$('#voice').append(option)});
  if(voices.some(v=>v.voiceURI===selected))$('#voice').value=selected;
  if(!voices.length){const option=document.createElement('option');option.textContent='No Mandarin voice available';$('#voice').append(option)}
  $('#voiceStatus').textContent=voices.length?'Choose the voice that sounds best to you.':'Install a Mandarin speech voice in your device settings, or try another browser.';
  $('#testVoice').disabled=!voices.length;
}
function speak(text){
  stop();const voice=voices.find(v=>v.voiceURI===$('#voice').value)||voices[0];
  if(!synth||!voice){if(active){$('#feedback').textContent='No Mandarin voice available. Go back to choose a voice.';$('#feedback').className='feedback bad'}return}
  utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=Number($('#speed').value);
  const id=speechId;
  utterance.onstart=()=>{if(id===speechId&&active)$('.stage').classList.add('speaking')};
  utterance.onend=()=>{if(id===speechId)$('.stage').classList.remove('speaking')};
  utterance.onerror=e=>{if(id!==speechId)return;$('.stage').classList.remove('speaking');if(!['canceled','interrupted'].includes(e.error)){const el=active?$('#feedback'):$('#voiceStatus');el.textContent='Audio could not play. Try another voice or press Play again.'}};
  synth.speak(utterance);
}
function review(){
  fillPinyin();
  const box=$('#reviewRows');box.replaceChildren();items=parseWords($('#words').value,phraseMap);
  items.forEach((item,i)=>{
    const row=document.createElement('div');row.className='review-row';
    for(const [key,label] of [['hanzi','Chinese word'],['pinyin','Pinyin']]){
      const input=document.createElement('input');input.value=item[key];input.setAttribute('aria-label',label+' '+(i+1));input.placeholder=key==='pinyin'?'Add the correct reading':'';row.append(input);
    }
    if(!item.pinyin){const hint=document.createElement('span');hint.className='warn';hint.textContent='Add pinyin for this word before starting.';row.append(hint)}
    box.append(row);
  });
  $('#review').classList.add('open');$('#start').textContent='Begin pinyin quiz →';
}
function bindStudy(){
  $('#back').onclick=back;
  $('#replay').onclick=()=>speak(items[index].hanzi);
  $('#check').onclick=check;
  $('#next').onclick=()=>next(false);
  $('#memorized').onclick=()=>next(true);
  $('#reveal').onclick=reveal;
  $('#answer').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();if(!answered)check()}};
}
function updateProgress(){
  $('#counter').textContent=practice.learned.length+' memorized · '+practice.queue.length+' to practice';
  $('#bar').style.width=(practice.total?practice.learned.length/practice.total*100:0)+'%';
  $('#progressMeter').setAttribute('aria-valuemax',practice.total);
  $('#progressMeter').setAttribute('aria-valuenow',practice.learned.length);
}
function reveal(){
  if(!active||mode!=='listen')return;
  revealed=true;
  const word=document.createElement('div');word.className='hanzi';word.lang='zh-CN';word.textContent=items[index].hanzi;
  const reading=document.createElement('p');reading.className='revealed-pinyin';reading.textContent=items[index].pinyin;
  $('#visual').replaceChildren(word,reading);$('#reveal').hidden=true;$('#memorized').hidden=false;
  $('#next').textContent='Keep practicing';$('#prompt').textContent='Did you remember it?';$('#memorized').focus();
}
function show(){
  items=practice.queue;index=0;answered=false;revealed=false;correct=false;
  $('#feedback').textContent='';$('#feedback').className='feedback';$('#answer').value='';$('#answer').disabled=false;$('#check').disabled=false;
  updateProgress();$('#memorized').hidden=true;$('#memorized').disabled=false;$('#reveal').hidden=mode!=='listen';
  $('#visual').replaceChildren();const visual=document.createElement('div');visual.className=mode==='listen'?'hidden-word':'hanzi';if(mode==='pinyin')visual.textContent=items[index].hanzi;else visual.setAttribute('aria-label','Word hidden');$('#visual').append(visual);
  $('#prompt').textContent=mode==='listen'?'Listen, then check the word':'Write the pinyin';
  $('#answer').hidden=mode==='listen';$('#check').hidden=mode==='listen';
  $('#next').textContent='Skip for now';
  if(mode==='pinyin')$('#answer').focus();else $('#reveal').focus();
  speak(items[index].hanzi);
}
function begin(){
  cancelDictation();fillPinyin();
  $('#setupError').textContent='';items=parseWords($('#words').value,phraseMap);
  if(!items.length){$('#setupError').textContent='Add at least one Chinese word to start.';$('#words').focus();return}
  if(mode==='pinyin'){
    if(!$('#review').classList.contains('open')){review();return}
    items=[...document.querySelectorAll('.review-row')].map(row=>({hanzi:row.children[0].value.trim(),pinyin:row.children[1].value.trim()}));
    const missing=items.findIndex(item=>!item.hanzi||!item.pinyin);
    if(missing>=0){$('#setupError').textContent='Complete every word and pinyin reading before starting.';document.querySelectorAll('.review-row')[missing].children[1].focus();return}
    $('#words').value=items.map(item=>item.hanzi+'|'+item.pinyin).join('\n');
  }
  save();count();if($('#shuffle').checked)for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]]}
  practice=createPractice(items,learnedWords());
  active=true;$('.stage').innerHTML=initialStage;bindStudy();$('#setup').style.display='none';$('#study').classList.add('active');
  if(practice.queue.length)show();else finish();
}
function check(){
  if(answered)return;
  if(!$('#answer').value.trim()){$('#feedback').textContent='Type your answer first.';$('#answer').focus();return}
  const good=matchesPinyin($('#answer').value,items[index].pinyin,$('#strict').checked);
  correct=good;answered=true;
  $('#feedback').textContent=(good?'Correct · ':'Answer · ')+items[index].pinyin;$('#feedback').className='feedback '+(good?'good':'bad');
  $('#check').disabled=true;$('#answer').disabled=true;$('#next').textContent='Keep practicing';$('#memorized').hidden=!good;
  (good?$('#memorized'):$('#next')).focus();
}
function next(remembered=false){
  if(!active||!practice.queue.length)return;
  if(remembered&&(mode==='listen'?!revealed:!correct))return;
  stop();practice=rateWord(practice,remembered);saveProgress();updateSummary();
  if(practice.queue.length)show();else finish();
}
function finish(){
  stop();active=false;updateProgress();$('.stage').replaceChildren();
  const heading=document.createElement('h2');heading.textContent='All words memorized.';
  const detail=document.createElement('p');detail.className='small';detail.textContent=practice.total+' words completed in this mode. Your progress is saved on this device.';
  const again=document.createElement('button');again.className='next';again.textContent='Practice all words again';again.onclick=()=>{resetProgress();begin()};
  const edit=document.createElement('button');edit.className='secondary';edit.textContent='Edit word list';edit.onclick=back;
  const controls=document.createElement('div');controls.className='controls';controls.append(again,edit);
  $('.stage').append(heading,detail,controls);edit.focus();
}
function resetProgress(){const keys=new Set(parseWords(withPinyin($('#words').value),phraseMap).map(wordKey));try{localStorage.setItem(progressKey(),JSON.stringify(learnedWords().filter(key=>!keys.has(key))))}catch{}updateSummary()}
function back(){stop();active=false;$('#study').classList.remove('active');$('#setup').style.display='grid';updateSummary();$('#start').focus()}
document.querySelectorAll('.mode').forEach(button=>{button.setAttribute('aria-pressed',button.dataset.mode===mode);button.onclick=()=>{mode=button.dataset.mode;document.querySelectorAll('.mode').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button)});$('#start').textContent=mode==='listen'?'Start listening':'Review pinyin';$('#review').classList.remove('open');$('#setupError').textContent='';updateSummary()}});
$('#words').oninput=()=>{count();save();$('#review').classList.remove('open');$('#start').textContent=mode==='listen'?'Start listening →':'Review pinyin →'};
$('#start').onclick=begin;$('#back').onclick=back;
$('#resetProgress').onclick=resetProgress;$('#strict').onchange=updateSummary;
function fillPinyin(){const value=withPinyin($('#words').value);if(value!==$('#words').value){$('#words').value=value;$('#words').oninput()}}
$('#words').addEventListener('blur',fillPinyin);
$('#fillPinyin').onclick=()=>{fillPinyin();$('#dictationStatus').textContent='Missing pinyin filled in. Your existing readings were kept.'};
$('#formatList').onclick=()=>{$('#words').value=formatStudyList($('#words').value);$('#words').oninput();$('#dictationStatus').textContent='Split into study words. Existing pinyin was kept; lines with readings that could not be aligned were left unchanged.'};
const cancelDictation=setupDictation({
  Recognition:window.SpeechRecognition||window.webkitSpeechRecognition,
  button:$('#dictate'),status:$('#dictationStatus'),beforeStart:stop,
  onBusy:busy=>{$('#start').disabled=busy;$('#testVoice').disabled=busy||!voices.length},
  append:words=>{const prior=$('#words').value.trimEnd();$('#words').value=(prior?prior+'\n':'')+withPinyin(words.join('\n'));$('#words').oninput()}
});
window.addEventListener('pagehide',cancelDictation);
$('#speed').oninput=()=>{$('#speedValue').textContent=Number($('#speed').value).toFixed(2).replace(/0$/,'')+'×'};
$('#testVoice').onclick=()=>speak('你好，我们一起学习中文。');
document.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){e.preventDefault();back();return}if(e.target.matches('input,textarea,select'))return;if(e.code==='Space'){e.preventDefault();speak(items[index].hanzi)}});
window.addEventListener('pagehide',stop);if(synth)synth.addEventListener('voiceschanged',loadVoices);loadVoices();count();
