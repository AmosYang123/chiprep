import {pinyin} from './vendor/pinyin-pro.mjs';

export function readingFor(word) {
  return /\p{Script=Han}/u.test(word) ? pinyin(word, {toneType:'symbol'}) : '';
}

export function withPinyin(text) {
  return text.split(/\n/).map(line => {
    const [word, ...given] = line.split('|');
    if (!word.trim() || given.join('|').trim()) return line;
    const reading = readingFor(word.trim());
    return reading ? word.trim() + '|' + reading : line;
  }).join('\n');
}

export function transcriptLines(text) {
  return text.split(/[，。！？；、,!?;\n]+/u).map(word => word.trim()).filter(Boolean);
}

export function setupDictation({Recognition, button, status, append, beforeStart, onBusy}) {
  let recognition = null;
  if (!Recognition) {
    button.disabled = true;
    status.textContent = 'Voice input isn’t available in this browser. Try Chrome, or use your keyboard’s microphone to dictate into the list.';
    return () => {};
  }
  function cancel() {
    if (!recognition) return;
    const current = recognition;
    recognition = null;
    current.abort();
    button.textContent = 'Speak words';
    button.setAttribute('aria-pressed','false');
    onBusy(false);
  }
  button.onclick = () => {
    if (recognition) {button.disabled=true;recognition.stop();return;}
    beforeStart();
    const current = new Recognition();
    recognition = current;
    current.lang='zh-CN';current.continuous=true;current.interimResults=true;
    let added=0,failed=false;
    button.textContent='Stop listening';button.setAttribute('aria-pressed','true');onBusy(true);
    status.textContent='Listening in Mandarin… Pause between words. Press Stop when finished.';
    current.onresult = event => {
      if (recognition !== current) return;
      let preview='';
      for(let i=event.resultIndex;i<event.results.length;i++) {
        const result=event.results[i];
        if(result.isFinal){const words=transcriptLines(result[0].transcript);if(words.length){append(words);added+=words.length;}}
        else preview+=result[0].transcript;
      }
      status.textContent=preview ? 'Hearing: '+preview : 'Listening… '+added+' items added.';
    };
    current.onerror = event => {
      if (recognition !== current) return;
      failed=true;
      const messages={'not-allowed':'Microphone access was denied. Allow it in your browser’s site settings and try again.','audio-capture':'No microphone is available. Connect a microphone and try again.','network':'Transcription could not connect. Check your connection or try Chrome.','no-speech':'No speech detected. Try again and speak clearly.','service-not-allowed':'This browser cannot use speech recognition here. Try Chrome or keyboard dictation.','language-not-supported':'Mandarin dictation is unavailable in this browser. Try Chrome.'};
      status.textContent=messages[event.error]||'Dictation stopped. You can try again; your list is saved.';
    };
    current.onend=()=>{if(recognition!==current)return;recognition=null;button.disabled=false;button.textContent='Speak words';button.setAttribute('aria-pressed','false');onBusy(false);if(!failed)status.textContent=added?'Added '+added+' items with pinyin. Check the transcription and readings below.':'No words added. Try again and speak clearly.';};
    try {current.start();} catch {status.textContent='Could not start dictation. Try again or use keyboard dictation.';cancel();}
  };
  return cancel;
}
