import {setupPhoneReceiver} from './phone-receiver.js';
import {setupPhotoImport} from './photo-import.js';
import {parseWords,matchesPinyin,mandarinVoices} from './study-core.js';
import {withPinyin, setupDictation, formatStudyList} from './dictation.js';
import {createRound, rateWord, groupWords, wordKey, selectedWords} from './practice.js';
const $ = selector => document.querySelector(selector);
const phraseMap={"你好":"nǐ hǎo","朋友":"péng you","学习":"xué xí","图书馆":"tú shū guǎn","明天":"míng tiān","中国":"zhōng guó","中文":"zhōng wén","老师":"lǎo shī","学生":"xué sheng","谢谢":"xiè xie","再见":"zài jiàn","银行":"yín háng","东西":"dōng xi","什么":"shén me","喜欢":"xǐ huan","认识":"rèn shi","工作":"gōng zuò","学校":"xué xiào","北京":"běi jīng","今天":"jīn tiān","昨天":"zuó tiān","天气":"tiān qì","吃饭":"chī fàn","喝水":"hē shuǐ","可以":"kě yǐ","没有":"méi yǒu","多少":"duō shao","名字":"míng zi","家人":"jiā rén"};
let mode='listen',items=[],index=0,answered=false,active=false,voices=[],utterance=null,speechId=0;
let round=createRound([]), revealed=false, correct=false, history=[];
function progressKey(){return 'ting-learned-'+mode+(mode==='pinyin'&&$('#strict').checked?'-tones':'')}
function learnedWords(){try{const value=JSON.parse(localStorage.getItem(progressKey())||'[]');return Array.isArray(value)?value.filter(key=>typeof key==='string'):[]}catch{return []}}
function unsave(keys){try{localStorage.setItem(progressKey(),JSON.stringify(learnedWords().filter(key=>!keys.has(key))))}catch{}}
function setLearned(key,learned){if(!learned){unsave(new Set([key]));return}try{localStorage.setItem(progressKey(),JSON.stringify([...new Set([...learnedWords(),key])]))}catch{}}
function listWords(){return parseWords(withPinyin($('#words').value),phraseMap)}
function skippedWords(){try{const value=JSON.parse(localStorage.getItem('ting-skip')||'[]');return Array.isArray(value)?value.filter(key=>typeof key==='string'):[]}catch{return []}}
function setSkipped(hanzi,skip){const next=new Set(skippedWords());for(const h of hanzi)skip?next.add(h):next.delete(h);try{localStorage.setItem('ting-skip',JSON.stringify([...next]))}catch{}renderPicker();$('#review').classList.remove('open');$('#start').textContent=mode==='listen'?'Start listening':'Review pinyin';$('#setupError').textContent=''}
function renderPicker(){
  const words=listWords(),skipped=new Set(skippedWords()),chosen=selectedWords(words,skipped).length;
  $('#picker').hidden=!words.length;$('#pickCount').textContent='· '+chosen+' of '+words.length+' selected';
  $('#pickAll').disabled=chosen===words.length;$('#pickNone').disabled=!chosen;
  $('#pickList').replaceChildren(...words.map(item=>{
    const label=document.createElement('label');label.className='pick';const box=document.createElement('input');box.type='checkbox';box.checked=!skipped.has(item.hanzi);box.onchange=()=>setSkipped([item.hanzi],!box.checked);
    const word=document.createElement('span');word.lang='zh-CN';word.textContent=item.hanzi;const reading=document.createElement('span');reading.className='small';reading.textContent=item.pinyin;
    label.append(box,word,reading);return label}));
}
function updateSummary(){const groups=groupWords(listWords(),learnedWords());$('#savedProgress').textContent=groups.remembered.length+' remembered · '+groups.review.length+' need review in this mode. Progress is saved on this device.';$('#resetProgress').disabled=!groups.remembered.length;$('#openReview').textContent='Needs review · '+groups.review.length;$('#openRemembered').textContent='Remembered · '+groups.remembered.length;$('#openReview').disabled=$('#openRemembered').disabled=!groups.review.length&&!groups.remembered.length;}
const synth=window.speechSynthesis;
const initialStage=$('.stage').innerHTML;
try { const saved=localStorage.getItem('ting-list'); if(saved!==null) $('#words').value=saved; } catch {}
function save(){try{localStorage.setItem('ting-list',$('#words').value)}catch{}}
function count(){let el=$('#wordCount');if(!el){el=document.createElement('span');el.id='wordCount';el.className='count';$('label[for="words"]').append(el)}el.textContent=parseWords($('#words').value).length+' words';updateSummary();renderPicker()}
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
  const box=$('#reviewRows');box.replaceChildren();
  items=selectedWords(parseWords($('#words').value,phraseMap).map((item,i)=>({...item,line:i})),skippedWords());
  items.forEach((item,i)=>{
    const row=document.createElement('div');row.className='review-row';row.dataset.line=item.line;
    for(const [key,label] of [['hanzi','Chinese word'],['pinyin','Pinyin']]){
      const input=document.createElement('input');input.value=item[key];input.setAttribute('aria-label',label+' '+(i+1));input.placeholder=key==='pinyin'?'Add the correct reading':'';row.append(input);
    }
    if(!item.pinyin){const hint=document.createElement('span');hint.className='warn';hint.textContent='Add pinyin for this word before starting.';row.append(hint)}
    box.append(row);
  });
  $('#review').classList.add('open');$('#start').textContent='Begin pinyin quiz';
}
function bindStudy(){
  $('#back').onclick=back;
  $('#replay').onclick=()=>speak(items[index].hanzi);
  $('#check').onclick=check;
  $('#previous').onclick=previous;
  $('#next').onclick=()=>next(false);
  $('#memorized').onclick=()=>next(true);
  $('#reveal').onclick=reveal;
  $('#answer').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();if(!answered)check()}};
}
function updateProgress(){
  const remembered=round.results.filter(r=>r.remembered).length;
  $('#counter').textContent=round.results.length+' of '+round.total+' tested · '+remembered+' remembered · '+(round.results.length-remembered)+' need review';
  $('#bar').style.width=(round.total?round.results.length/round.total*100:0)+'%';
  $('#progressMeter').setAttribute('aria-valuemax',round.total);
  $('#progressMeter').setAttribute('aria-valuenow',round.results.length);
  const prev=$('#previous');if(prev)prev.disabled=!history.length;
}
function previous(){
  if(!history.length)return;
  const last=history.pop();
  setLearned(last.key,last.wasLearned);round=last.round;updateSummary();show();
}
function reveal(){
  if(!active||mode!=='listen')return;
  revealed=true;
  const word=document.createElement('div');word.className='hanzi';word.lang='zh-CN';word.textContent=items[index].hanzi;
  const reading=document.createElement('p');reading.className='revealed-pinyin';reading.textContent=items[index].pinyin;
  $('#visual').replaceChildren(word,reading);$('#reveal').hidden=true;$('#memorized').hidden=false;
  $('#prompt').textContent='Did you remember it?';$('#memorized').focus();
}
function show(){
  if(!$('#visual')){$('.stage').innerHTML=initialStage;bindStudy()}
  active=true;items=round.queue;index=0;answered=false;revealed=false;correct=false;
  $('#feedback').textContent='';$('#feedback').className='feedback';$('#answer').value='';$('#answer').disabled=false;$('#check').disabled=false;
  updateProgress();$('#memorized').hidden=true;$('#memorized').disabled=false;$('#reveal').hidden=mode!=='listen';
  $('#visual').replaceChildren();const visual=document.createElement('div');visual.className=mode==='listen'?'hidden-word':'hanzi';if(mode==='pinyin')visual.textContent=items[index].hanzi;else{visual.setAttribute('role','img');visual.setAttribute('aria-label','Word hidden');for(let i=0;i<5;i++)visual.append(document.createElement('i'))}$('#visual').append(visual);
  $('#prompt').textContent=mode==='listen'?'Listen, then check the word':'Write the pinyin';
  $('#answer').hidden=mode==='listen';$('#check').hidden=mode==='listen';
  if(mode==='pinyin')$('#answer').focus();else $('#reveal').focus();
  speak(items[index].hanzi);
}
function begin(){
  cancelDictation();fillPinyin();
  $('#setupError').textContent='';items=parseWords($('#words').value,phraseMap);
  if(!items.length){$('#setupError').textContent='Add at least one Chinese word to start.';$('#words').focus();return}
  items=selectedWords(items,skippedWords());
  if(!items.length){$('#setupError').textContent='Select at least one word to study.';$('#pickAll').focus();return}
  if(mode==='pinyin'){
    if(!$('#review').classList.contains('open')){review();return}
    items=[...document.querySelectorAll('.review-row')].map(row=>({hanzi:row.children[0].value.trim(),pinyin:row.children[1].value.trim()}));
    const missing=items.findIndex(item=>!item.hanzi||!item.pinyin);
    if(missing>=0){$('#setupError').textContent='Complete every word and pinyin reading before starting.';document.querySelectorAll('.review-row')[missing].children[1].focus();return}
    // Only the selected words were reviewed; write their edits back without dropping the rest of the list.
    const all=parseWords($('#words').value,phraseMap);document.querySelectorAll('.review-row').forEach((row,i)=>{all[row.dataset.line]=items[i]});
    $('#words').value=all.map(item=>item.hanzi+'|'+item.pinyin).join('\n');
  }
  save();count();
  $('#setup').style.display='none';$('#study').classList.add('active');
  startRound(items);
}
function startRound(words){
  words=[...words];
  if($('#shuffle').checked)for(let i=words.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[words[i],words[j]]=[words[j],words[i]]}
  round=createRound(words);history=[];
  $('.stage').innerHTML=initialStage;bindStudy();show();
}
function check(){
  if(answered)return;
  if(!$('#answer').value.trim()){$('#feedback').textContent='Type your answer first.';$('#answer').focus();return}
  const good=matchesPinyin($('#answer').value,items[index].pinyin,$('#strict').checked);
  correct=good;answered=true;
  $('#feedback').textContent=(good?'Correct · ':'Answer · ')+items[index].pinyin;$('#feedback').className='feedback '+(good?'good':'bad');
  $('#check').disabled=true;$('#answer').disabled=true;$('#memorized').hidden=!good;
  (good?$('#memorized'):$('#next')).focus();
}
function next(remembered=false){
  if(!active||!round.queue.length)return;
  if(remembered&&(mode==='listen'?!revealed:!correct))return;
  const key=wordKey(round.queue[0]);
  stop();history.push({round,key,wasLearned:learnedWords().includes(key)});
  round=rateWord(round,remembered);setLearned(key,remembered);updateSummary();
  if(round.queue.length)show();else showGroups('Round complete');
}
function wordGroup(title,words,moveLabel,learned){
  const section=document.createElement('section');section.className='group';
  const heading=document.createElement('h3');heading.textContent=title+' · '+words.length;
  const practise=document.createElement('button');practise.className=learned?'secondary':'next';practise.textContent='Practice these '+words.length;practise.disabled=!words.length;practise.onclick=()=>startRound(words);
  const list=document.createElement('ul');
  words.forEach(item=>{
    const row=document.createElement('li');const word=document.createElement('span');word.lang='zh-CN';word.textContent=item.hanzi;
    const reading=document.createElement('span');reading.textContent=item.pinyin;
    const move=document.createElement('button');move.className='ghost';move.type='button';move.textContent=moveLabel;move.setAttribute('aria-label',moveLabel+': '+item.hanzi);
    move.onclick=()=>{setLearned(wordKey(item),!learned);history=[];updateSummary();showGroups($('.stage h2').textContent,learned?'Remembered':'Needs review')};
    row.append(word,reading,move);list.append(row);
  });
  if(!words.length){const empty=document.createElement('li');empty.className='note';empty.textContent='No words here.';list.append(empty)}
  section.dataset.group=title;section.append(heading,practise,list);return section;
}
function showGroups(title,focusGroup){
  stop();active=false;updateProgress();$('.stage').replaceChildren();
  const groups=groupWords(listWords(),learnedWords());
  $('#counter').textContent=groups.remembered.length+' remembered · '+groups.review.length+' need review';
  const heading=document.createElement('h2');heading.textContent=title;
  const detail=document.createElement('p');detail.className='small';detail.textContent=(mode==='listen'?'Listening recall':'Pinyin quiz')+'. Pick a group to practice. Move any word if it’s in the wrong group.';
  const board=document.createElement('div');board.className='groups';
  board.append(wordGroup('Needs review',groups.review,'Mark remembered',false),wordGroup('Remembered',groups.remembered,'Needs review',true));
  const all=document.createElement('button');all.className='secondary';all.textContent='Test all words';all.onclick=()=>startRound(listWords());
  const edit=document.createElement('button');edit.className='secondary';edit.textContent='Edit word list';edit.onclick=back;
  const controls=document.createElement('div');controls.className='controls';controls.append(all,edit);
  if(history.length){const prev=document.createElement('button');prev.className='ghost';prev.textContent='Previous word';prev.onclick=previous;controls.prepend(prev)}
  $('.stage').append(heading,detail,board,controls);
  const target=focusGroup&&board.querySelector('[data-group="'+focusGroup+'"]');
  if(target)target.scrollIntoView?.({block:'nearest'});
  ((target||board).querySelector('button:not(:disabled)')||edit).focus();
}
function resetProgress(){unsave(new Set(parseWords(withPinyin($('#words').value),phraseMap).map(wordKey)));updateSummary()}
function back(){stop();active=false;$('#study').classList.remove('active');$('#setup').style.display='grid';updateSummary();$('#start').focus()}
document.querySelectorAll('.mode').forEach(button=>{button.setAttribute('aria-pressed',button.dataset.mode===mode);button.onclick=()=>{mode=button.dataset.mode;document.querySelectorAll('.mode').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button)});$('#start').textContent=mode==='listen'?'Start listening':'Review pinyin';$('#review').classList.remove('open');$('#setupError').textContent='';updateSummary()}});
$('#words').oninput=()=>{count();save();$('#review').classList.remove('open');$('#start').textContent=mode==='listen'?'Start listening':'Review pinyin'};
$('#start').onclick=begin;
function openGroups(focusGroup){cancelDictation();fillPinyin();save();$('#setup').style.display='none';$('#study').classList.add('active');round=createRound([]);history=[];showGroups('Your words',focusGroup)}
$('#openReview').onclick=()=>openGroups('Needs review');$('#openRemembered').onclick=()=>openGroups('Remembered');
$('#groups').onclick=()=>showGroups('Your words');$('#back').onclick=back;
$('#resetProgress').onclick=resetProgress;
$('#pickAll').onclick=()=>setSkipped(listWords().map(item=>item.hanzi),false);$('#pickNone').onclick=()=>setSkipped(listWords().map(item=>item.hanzi),true);$('#strict').onchange=updateSummary;
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
const importPhoto=setupPhotoImport({
  camera:$('#takePhoto'),upload:$('#uploadPhoto'),cameraInput:$('#cameraInput'),photoInput:$('#photoInput'),language:$('#photoLanguage'),status:$('#photoStatus'),
  getValue:()=>$('#words').value,setValue:value=>{$('#words').value=value;$('#words').oninput()},
  beforeStart:()=>{cancelDictation();stop()},
  onBusy:busy=>{for(const id of ['#start','#dictate','#openReview','#openRemembered'])$(id).disabled=busy;if(!busy){updateSummary();$('#dictate').disabled=!(window.SpeechRecognition||window.webkitSpeechRecognition)}}
});
setupPhoneReceiver({button:$('#phoneImport'),importPhoto,beforeReceive:()=>{if($('#study').classList.contains('active'))back()}});
window.addEventListener('pagehide',cancelDictation);
$('#speed').oninput=()=>{$('#speedValue').textContent=Number($('#speed').value).toFixed(2).replace(/0$/,'')+'×'};
$('#testVoice').onclick=()=>speak('你好，我们一起学习中文。');
document.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){e.preventDefault();back();return}if(e.target.matches('input,textarea,select'))return;if(e.key==='ArrowLeft'){e.preventDefault();previous();return}if(e.code==='Space'&&items[index]){e.preventDefault();speak(items[index].hanzi)}});
window.addEventListener('pagehide',stop);if(synth)synth.addEventListener('voiceschanged',loadVoices);loadVoices();count();
