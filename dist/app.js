import {parseWords,matchesPinyin,mandarinVoices} from './study-core.js';
import {withPinyin, setupDictation, formatStudyList} from './dictation.js';
const $ = selector => document.querySelector(selector);
const phraseMap={"你好":"nǐ hǎo","朋友":"péng you","学习":"xué xí","图书馆":"tú shū guǎn","明天":"míng tiān","中国":"zhōng guó","中文":"zhōng wén","老师":"lǎo shī","学生":"xué sheng","谢谢":"xiè xie","再见":"zài jiàn","银行":"yín háng","东西":"dōng xi","什么":"shén me","喜欢":"xǐ huan","认识":"rèn shi","工作":"gōng zuò","学校":"xué xiào","北京":"běi jīng","今天":"jīn tiān","昨天":"zuó tiān","天气":"tiān qì","吃饭":"chī fàn","喝水":"hē shuǐ","可以":"kě yǐ","没有":"méi yǒu","多少":"duō shao","名字":"míng zi","家人":"jiā rén"};
let mode='listen',items=[],index=0,answered=false,active=false,score=0,voices=[],utterance=null,speechId=0;
const synth=window.speechSynthesis;
const initialStage=$('.stage').innerHTML;
try { const saved=localStorage.getItem('ting-list'); if(saved!==null) $('#words').value=saved; } catch {}
function save(){try{localStorage.setItem('ting-list',$('#words').value)}catch{}}
function count(){let el=$('#wordCount');if(!el){el=document.createElement('span');el.id='wordCount';el.className='count';$('label[for="words"]').append(el)}el.textContent=parseWords($('#words').value).length+' words'}
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
  $('#next').onclick=next;
  $('#answer').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();answered?next():check()}};
}
function show(){
  answered=false;$('#feedback').textContent='';$('#feedback').className='feedback';$('#answer').value='';$('#answer').disabled=false;$('#check').disabled=false;
  $('#counter').textContent=(index+1)+' / '+items.length;$('#bar').style.width=(index/items.length*100)+'%';
  $('#visual').replaceChildren();const visual=document.createElement('div');visual.className=mode==='listen'?'hidden-word':'hanzi';if(mode==='pinyin')visual.textContent=items[index].hanzi;else visual.setAttribute('aria-label','Word hidden');$('#visual').append(visual);
  $('#prompt').textContent=mode==='listen'?'Listen. Take your time.':'What’s the pinyin?';
  $('#answer').hidden=mode==='listen';$('#check').hidden=mode==='listen';
  $('#next').textContent=index===items.length-1?'Finish session →':mode==='pinyin'?'Skip word →':'Next word →';
  $('.stage').classList.remove('enter');void $('.stage').offsetWidth;$('.stage').classList.add('enter');
  if(mode==='pinyin')$('#answer').focus();else $('#next').focus();
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
  index=0;score=0;active=true;$('.stage').innerHTML=initialStage;bindStudy();$('#setup').style.display='none';$('#study').classList.add('active');show();
}
function check(){
  if(answered)return;
  if(!$('#answer').value.trim()){$('#feedback').textContent='Type your answer first.';$('#answer').focus();return}
  const good=matchesPinyin($('#answer').value,items[index].pinyin,$('#strict').checked);
  if(good)score++;answered=true;
  $('#feedback').textContent=(good?'Correct · ':'Answer · ')+items[index].pinyin;$('#feedback').className='feedback '+(good?'good':'bad');
  $('#check').disabled=true;$('#answer').disabled=true;$('#next').textContent=index===items.length-1?'Finish session →':'Next word →';$('#next').focus();
}
function next(){if(!active)return;stop();if(index<items.length-1){index++;show();return}active=false;$('#bar').style.width='100%';$('.stage').replaceChildren();
  const mark=document.createElement('div');mark.className='complete';mark.textContent='好';
  const heading=document.createElement('h2');heading.textContent='Practice complete.';
  const detail=document.createElement('p');detail.className='small';detail.textContent=mode==='pinyin'?score+' of '+items.length+' correct. Keep building the habit.':items.length+' words practiced. A little better than before.';
  const again=document.createElement('button');again.className='next';again.textContent='Practice again →';again.onclick=begin;
  $('.stage').append(mark,heading,detail,again);again.focus();
}
function back(){stop();active=false;$('#study').classList.remove('active');$('#setup').style.display='grid';$('#start').focus()}
document.querySelectorAll('.mode').forEach(button=>{button.setAttribute('aria-pressed',button.dataset.mode===mode);button.onclick=()=>{mode=button.dataset.mode;document.querySelectorAll('.mode').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button)});$('#start').textContent=mode==='listen'?'Start listening →':'Review pinyin →';$('#review').classList.remove('open');$('#setupError').textContent=''}});
$('#words').oninput=()=>{count();save();$('#review').classList.remove('open');$('#start').textContent=mode==='listen'?'Start listening →':'Review pinyin →'};
$('#start').onclick=begin;$('#back').onclick=back;
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
document.addEventListener('keydown',e=>{if(!active||e.target.matches('input,textarea,select'))return;if(e.code==='Space'){e.preventDefault();speak(items[index].hanzi)}else if(e.key==='Enter'&&e.target.tagName!=='BUTTON'){e.preventDefault();next()}else if(e.key==='Escape')back()});
window.addEventListener('pagehide',stop);if(synth)synth.addEventListener('voiceschanged',loadVoices);loadVoices();count();
