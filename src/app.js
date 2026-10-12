import { parseList, keyFor, correctReading, formatList, addPhotoText, addDictationText } from './core.js';
import { createStudyStore } from './store.js';
import { receivePhone } from './phone-transfer.js';
import { loadSets, visibleList, editSet, addSet, renameSet, removeSet, totalListLength } from './sets.js';

const $ = selector => document.querySelector(selector);
const store = createStudyStore({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }, window.fetch.bind(window), message => { $('#syncStatus').textContent = message; });
await store.initialize();
const stage = $('.stage');
const studyMarkup = stage.innerHTML;
const editor = $('#words');
const savedSets = read('sets', null);
let sets = loadSets(savedSets, read('list', editor.value));
if (!savedSets && totalListLength(sets) <= 100000) write('sets', sets);
const undoStack = [];
let editCaptured = false;
let mode = 'listen';
let skipped = new Set(read('skip', []));
let queue = [];
let results = [];
let history = [];
let revealed = false;
let correct = false;
let active = false;
let voices = [];
let recognition;
let photoBusy = false;
let closePhoneConnection;
let phoneGeneration = 0;

function stopDictation() {
  const current = recognition;
  if (!current) return;
  recognition = undefined;
  $('#dictate').textContent = 'Dictate words';
  $('#dictate').setAttribute('aria-pressed', 'false');
  $('#start').disabled = photoBusy;
  $('#dictationStatus').textContent = 'Dictation stopped.';
  try { current.abort(); } catch { /* The session may already have ended. */ }
}

function read(name, fallback) {
  return store.read(name, fallback);
}

function write(name, value) {
  store.write(name, value);
}

function progressName() { return `learned-${mode}${mode === 'pinyin' && $('#strict').checked ? '-tones' : ''}`; }
function learned() { return new Set(read(progressName(), [])); }
function words() { return parseList(editor.value); }
function selected() { return words().filter(word => !skipped.has(word.hanzi)); }

function snapshot() {
  undoStack.push({ sets: structuredClone(sets), skip: [...skipped], progress: Object.fromEntries(['learned-listen', 'learned-pinyin', 'learned-pinyin-tones'].map(name => [name, read(name, [])])) });
  if (undoStack.length > 20) undoStack.shift();
  $('#undoChange').disabled = false;
}

function persistSets(next) {
  if (next.items.length > 50 || next.items.some(item => item.name.length > 100 || item.list.length > 100000) || totalListLength(next) > 100000) {
    $('#setStatus').textContent = 'Limit reached: up to 50 sets, 100 characters per name, and 100,000 characters of words total.';
    return false;
  }
  sets = next;
  write('sets', sets);
  $('#setStatus').textContent = '';
  return true;
}

function renderSets() {
  const current = sets.items.find(item => item.id === sets.active);
  renderSetOptions();
  editor.value = visibleList(sets);
  editor.readOnly = !current || photoBusy;
  if (!current && !$('#setStatus').textContent) $('#setStatus').textContent = 'All combines words from your sets. Choose one set to edit or add words.';
  for (const id of ['#renameSet', '#deleteSet', '#dictate', '#formatList', '#fillPinyin', '#takePhoto', '#uploadPhoto', '#phoneImport']) $(id).disabled = !current || photoBusy;
  $('#newSet').disabled = photoBusy || sets.items.length >= 50;
  $('#setSelect').disabled = photoBusy;
  $('#undoChange').disabled = photoBusy || !undoStack.length;
  renderList();
}

function remember(word, value) {
  const known = learned();
  value ? known.add(keyFor(word)) : known.delete(keyFor(word));
  write(progressName(), [...known]);
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderList() {
  const list = words();
  const chosen = selected().length;
  $('#wordCount').textContent = `${list.length} words`;
  $('#picker').hidden = !list.length;
  $('#pickCount').textContent = `· ${chosen} of ${list.length} selected`;
  $('#pickAll').disabled = chosen === list.length;
  $('#pickNone').disabled = !chosen;
  $('#pickList').replaceChildren(...list.map(word => {
    const label = element('label', undefined, 'pick');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !skipped.has(word.hanzi);
    checkbox.addEventListener('change', () => {
      snapshot();
      checkbox.checked ? skipped.delete(word.hanzi) : skipped.add(word.hanzi);
      write('skip', [...skipped]);
      resetReview();
      renderList();
    });
    const hanzi = element('span', word.hanzi);
    hanzi.lang = 'zh-CN';
    label.append(checkbox, hanzi, element('span', word.pinyin, 'small'));
    return label;
  }));
  const remembered = list.filter(word => learned().has(keyFor(word))).length;
  $('#savedProgress').textContent = `${remembered} remembered · ${list.length - remembered} need review in this mode. Progress is saved on this device.`;
  $('#openReview').textContent = `Needs review · ${list.length - remembered}`;
  $('#openRemembered').textContent = `Remembered · ${remembered}`;
  $('#resetProgress').disabled = !remembered;
}

function resetReview() {
  $('#review').classList.remove('open');
  $('#start').textContent = mode === 'listen' ? 'Start listening' : 'Review pinyin';
  $('#setupError').textContent = '';
}

function saveList() {
  if (sets.active === 'all') return;
  const previous = sets.items.find(item => item.id === sets.active)?.list;
  if (!persistSets(editSet(sets, sets.active, editor.value))) { editor.value = previous || ''; return; }
  resetReview();
  renderList();
  renderSetOptions();
}
function renderSetOptions() {
  const selected = sets.active;
  $('#setSelect').replaceChildren(new Option(`All · ${parseList(visibleList({ ...sets, active: 'all' })).length} words`, 'all'), ...sets.items.map(item => new Option(`${item.name} · ${parseList(item.list).length} words`, item.id)));
  $('#setSelect').value = selected;
}
function fillReadings() {
  if (sets.active === 'all' || photoBusy) return;
  const filled = words().map(word => `${word.hanzi}${word.pinyin ? `|${word.pinyin}` : ''}`).join('\n');
  if (filled === editor.value) return;
  if (!editCaptured) snapshot();
  editor.value = filled;
  saveList();
}

function loadVoices() {
  const previous = $('#voice').value;
  voices = (window.speechSynthesis?.getVoices() || []).filter(voice => /^(zh(?:-(CN|TW|SG|Hans|Hant))?$|cmn)/i.test(voice.lang) && !/cantonese|hong kong/i.test(voice.name));
  $('#voice').replaceChildren(...voices.map(voice => new Option(`${voice.name} · ${voice.lang}`, voice.voiceURI)));
  if (voices.some(voice => voice.voiceURI === previous)) $('#voice').value = previous;
  if (!voices.length) $('#voice').append(new Option('No Mandarin voice available', ''));
  $('#testVoice').disabled = !voices.length;
  $('#voiceStatus').textContent = voices.length ? 'Choose the voice that sounds best to you.' : 'Install a Mandarin speech voice in your device settings, or try another browser.';
}

function stopAudio() { window.speechSynthesis?.cancel(); stage.classList.remove('speaking'); }
function speak(text) {
  stopAudio();
  const voice = voices.find(item => item.voiceURI === $('#voice').value);
  if (!voice) {
    const feedback = active ? $('#feedback') : $('#voiceStatus');
    if (feedback) feedback.textContent = 'No Mandarin voice available. Install one in device settings or try another browser.';
    return;
  }
  const speech = new SpeechSynthesisUtterance(text);
  speech.voice = voice;
  speech.lang = voice.lang;
  speech.rate = Number($('#speed').value);
  speech.onstart = () => stage.classList.add('speaking');
  speech.onend = () => stage.classList.remove('speaking');
  speech.onerror = event => {
    stage.classList.remove('speaking');
    if (!['canceled', 'interrupted'].includes(event.error)) {
      const status = $('#feedback') || $('#voiceStatus');
      status.textContent = 'Audio could not play. Try another voice or press Play again.';
    }
  };
  speechSynthesis.speak(speech);
}

function showStudy() { $('#setup').style.display = 'none'; $('#study').classList.add('active'); }
function back() {
  active = false;
  stopAudio();
  $('#study').classList.remove('active');
  $('#setup').style.display = 'block';
  renderList();
  $('#start').focus();
}

function progress() {
  const total = queue.length + results.length;
  const remembered = results.filter(result => result.remembered).length;
  $('#counter').textContent = `${results.length} of ${total} tested · ${remembered} remembered · ${results.length - remembered} need review`;
  $('#bar').style.width = `${total ? results.length / total * 100 : 0}%`;
  $('#progressMeter').setAttribute('aria-valuemax', String(total));
  $('#progressMeter').setAttribute('aria-valuenow', String(results.length));
}

function startRound(list) {
  stopDictation();
  queue = [...new Map(list.map(word => [keyFor(word), word])).values()];
  if (!queue.length) return;
  if ($('#shuffle').checked) {
    for (let i = queue.length - 1; i > 0; i--) {
      const other = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[other]] = [queue[other], queue[i]];
    }
  }
  results = [];
  history = [];
  showStudy();
  showWord();
}

function showWord() {
  active = true;
  revealed = correct = false;
  stage.innerHTML = studyMarkup;
  progress();
  $('#previous').disabled = !history.length;
  $('#answer').hidden = $('#check').hidden = mode === 'listen';
  $('#reveal').hidden = mode !== 'listen';
  $('#memorized').hidden = true;
  $('#prompt').textContent = mode === 'listen' ? 'Listen, then check the word' : 'Write the pinyin';
  if (mode === 'listen') {
    const bars = element('div', undefined, 'hidden-word');
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', 'Word hidden');
    for (let i = 0; i < 5; i++) bars.append(element('i'));
    $('#visual').append(bars);
  } else {
    const hanzi = element('div', queue[0].hanzi, 'hanzi');
    hanzi.lang = 'zh-CN';
    $('#visual').append(hanzi);
  }
  $('#previous').onclick = previous;
  $('#replay').onclick = () => speak(queue[0].hanzi);
  $('#reveal').onclick = () => {
    revealed = true;
    const hanzi = element('div', queue[0].hanzi, 'hanzi');
    hanzi.lang = 'zh-CN';
    $('#visual').replaceChildren(hanzi, element('p', queue[0].pinyin, 'revealed-pinyin'));
    $('#prompt').textContent = 'Did you remember it?';
    $('#reveal').hidden = true;
    $('#memorized').hidden = false;
    $('#memorized').focus();
  };
  $('#check').onclick = checkAnswer;
  $('#next').onclick = () => rate(false);
  $('#memorized').onclick = () => rate(true);
  $('#answer').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); checkAnswer(); } };
  (mode === 'listen' ? $('#reveal') : $('#answer')).focus();
  speak(queue[0].hanzi);
}

function checkAnswer() {
  if ($('#check').disabled) return;
  if (!$('#answer').value.trim()) { $('#feedback').textContent = 'Type your answer first.'; return; }
  correct = correctReading($('#answer').value, queue[0].pinyin, $('#strict').checked);
  $('#feedback').textContent = `${correct ? 'Correct' : 'Answer'} · ${queue[0].pinyin}`;
  $('#feedback').className = `feedback ${correct ? 'good' : 'bad'}`;
  $('#check').disabled = $('#answer').disabled = true;
  $('#memorized').hidden = !correct;
  (correct ? $('#memorized') : $('#next')).focus();
}

function rate(remembered) {
  if (!active || !queue.length || (remembered && !(mode === 'listen' ? revealed : correct))) return;
  const word = queue[0];
  snapshot();
  history.push({ word, known: learned().has(keyFor(word)) });
  queue.shift();
  results.push({ word, remembered });
  remember(word, remembered);
  stopAudio();
  if (queue.length) showWord(); else showGroups('Round complete');
}

function previous() {
  const last = history.pop();
  if (!last) return;
  undoStack.pop();
  $('#undoChange').disabled = !undoStack.length;
  remember(last.word, last.known);
  results.pop();
  queue.unshift(last.word);
  showWord();
}

function button(text, className, action) { const node = element('button', text, className); node.type = 'button'; node.onclick = action; return node; }

function showGroups(title = 'Your words', focusGroup) {
  active = false;
  stopAudio();
  showStudy();
  progress();
  const known = learned();
  const board = element('div', undefined, 'groups');
  for (const [label, remembered] of [['Needs review', false], ['Remembered', true]]) {
    const list = words().filter(word => known.has(keyFor(word)) === remembered);
    const section = element('section', undefined, 'group');
    section.dataset.group = label;
    const practice = button(`Practice these ${list.length}`, remembered ? 'secondary' : 'next', () => startRound(list));
    practice.disabled = !list.length;
    section.append(element('h3', `${label} · ${list.length}`), practice);
    const ul = element('ul');
    for (const word of list) {
      const row = element('li');
      const hanzi = element('span', word.hanzi);
      hanzi.lang = 'zh-CN';
      const move = button(remembered ? 'Needs review' : 'Mark remembered', 'ghost', () => { snapshot(); remember(word, !remembered); history = []; showGroups(title); });
      move.setAttribute('aria-label', `${move.textContent}: ${word.hanzi}`);
      row.append(hanzi, element('span', word.pinyin), move);
      ul.append(row);
    }
    if (!list.length) ul.append(element('li', 'No words here.', 'note'));
    section.append(ul);
    board.append(section);
  }
  const controls = element('div', undefined, 'controls');
  if (history.length) controls.append(button('Previous word', 'ghost', previous));
  const testAll = button('Test all words', 'secondary', () => startRound(words()));
  testAll.disabled = !words().length;
  controls.append(testAll, button('Edit word list', 'secondary', back));
  stage.replaceChildren(element('h2', title), element('p', `${mode === 'listen' ? 'Listening recall' : 'Pinyin quiz'}. Pick a group to practice. Move any word if it’s in the wrong group.`, 'small'), board, controls);
  const focused = [...board.children].find(section => section.dataset.group === focusGroup);
  (focused?.querySelector('button:not(:disabled)') || controls.querySelector('button:not(:disabled)'))?.focus();
  focused?.scrollIntoView({ block: 'nearest' });
}

function begin() {
  const reviewing = $('#review').classList.contains('open');
  $('#setupError').textContent = '';
  if (!words().length || !selected().length) {
    $('#setupError').textContent = words().length ? 'Select at least one word to study.' : 'Add at least one Chinese word to start.';
    return;
  }
  if (mode === 'pinyin') {
    if (!reviewing) {
      const rows = selected().map((word, index) => {
        const row = element('div', undefined, 'review-row');
        row.dataset.key = keyFor(word);
        for (const [field, label] of [['hanzi', 'Chinese word'], ['pinyin', 'Pinyin']]) {
          const input = element('input');
          input.value = word[field];
          input.setAttribute('aria-label', `${label} ${index + 1}`);
          row.append(input);
        }
        return row;
      });
      $('#reviewRows').replaceChildren(...rows);
      $('#review').classList.add('open');
      $('#start').textContent = 'Begin pinyin quiz';
      return;
    }
    const edits = new Map([...document.querySelectorAll('.review-row')].map(row => [row.dataset.key, { hanzi: row.children[0].value.trim(), pinyin: row.children[1].value.trim() }]));
    if ([...edits.values()].some(word => !word.hanzi || !word.pinyin)) { $('#setupError').textContent = 'Complete every word and pinyin reading before starting.'; return; }
    const reviewed = words().map(word => {
      const edited = edits.get(keyFor(word)) || word;
      return `${edited.hanzi}|${edited.pinyin}`;
    }).join('\n');
    if (sets.active === 'all') { startRound(parseList(reviewed).filter(word => !skipped.has(word.hanzi))); return; }
    if (reviewed !== editor.value) { snapshot(); editor.value = reviewed; saveList(); }
  }
  startRound(selected());
}

async function importPhotos(files, report = () => {}) {
  if (photoBusy) return { ok: false, added: 0, message: 'The computer is reading another photo. Wait, then retry.' };
  const batch = [...files];
  if (!batch.length) return { ok: false, added: 0, message: 'Choose a photo first.' };
  if (batch.length > 5 || batch.some(file => !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024)) {
    $('#photoStatus').textContent = 'Choose up to 5 image files, each under 20 MB.';
    return { ok: false, added: 0, message: $('#photoStatus').textContent };
  }
  photoBusy = true;
  const targetSet = sets.active;
  if (targetSet === 'all') { photoBusy = false; return { ok: false, added: 0, message: 'Choose a word set before importing photos.' }; }
  stopDictation();
  stopAudio();
  const buttons = ['#takePhoto', '#uploadPhoto', '#start', '#dictate', '#photoLanguage', '#phoneImport', '#newSet', '#renameSet', '#deleteSet', '#setSelect', '#undoChange', '#formatList', '#fillPinyin'];
  const priorDisabled = buttons.map(id => $(id).disabled);
  buttons.forEach(id => { $(id).disabled = true; });
  editor.readOnly = true;
  let worker;
  let added = 0;
  try {
    $('#photoStatus').textContent = 'Preparing text reader… First use downloads Chinese language data.';
    const { createWorker } = await import('tesseract.js');
    worker = await createWorker($('#photoLanguage').value, 1, {
      workerPath: new URL('/ocr/worker.min.js', location.origin).href,
      corePath: new URL('/ocr/core/', location.origin).href,
      logger: update => { $('#photoStatus').textContent = `${update.status} · ${Math.round((update.progress || 0) * 100)}%`; report($('#photoStatus').textContent); },
    });
    let nextList = sets.items.find(item => item.id === targetSet).list;
    for (const file of batch) {
      const result = await worker.recognize(file);
      const merged = addPhotoText(nextList, result.data.text);
      nextList = merged.value;
      added += merged.added;
    }
    if (nextList !== sets.items.find(item => item.id === targetSet).list) {
      snapshot();
      if (!persistSets(editSet(sets, targetSet, nextList))) throw new Error($('#setStatus').textContent);
      renderSets();
    }
    $('#photoStatus').textContent = added ? `Added ${added} words with pinyin. Check the words and readings below; photo recognition can make mistakes.` : 'No new Chinese words found. Try a clearer photo.';
    await store.flush();
    return { ok: true, added, message: $('#photoStatus').textContent };
  } catch (error) {
    $('#photoStatus').textContent = `Could not read photos: ${error instanceof Error ? error.message : 'text reader unavailable'}. Your study list was kept.`;
    return { ok: false, added, message: $('#photoStatus').textContent };
  } finally {
    await worker?.terminate();
    photoBusy = false;
    buttons.forEach((id, index) => { $(id).disabled = priorDisabled[index]; });
    renderSets();
    $('#cameraInput').value = $('#photoInput').value = '';
  }
}

async function connectPhone() {
  const generation = ++phoneGeneration;
  closePhoneConnection?.();
  $('#phoneQR').hidden = true;
  $('#phoneImportSummary').hidden = true;
  $('#phoneLink').hidden = true;
  $('#phoneConnectionStatus').textContent = 'Creating a secure photo connection…';
  if (!$('#phoneDialog').open) $('#phoneDialog').showModal();
  const close = await receivePhone({
    origin: $('.shell').dataset.phoneOrigin || location.origin,
    status: message => { if (generation === phoneGeneration) $('#phoneConnectionStatus').textContent = message; },
    ready: (url, qr) => { if (generation !== phoneGeneration) return; $('#phoneQR').src = qr; $('#phoneQR').hidden = false; $('#phoneLink').href = url; $('#phoneLink').hidden = false; },
    receive: async (file, report) => {
      if (active) back();
      const result = await importPhotos([file], report);
      $('#phoneImportSummary').hidden = false;
      $('#phoneImportSummary').textContent = result.message;
      return result;
    },
  });
  if (generation !== phoneGeneration || !$('#phoneDialog').open) close();
  else closePhoneConnection = close;
}

const countLabel = element('span', undefined, 'count');
countLabel.id = 'wordCount';
$('label[for="words"]').append(countLabel);
renderSets();
editor.addEventListener('focus', () => { editCaptured = false; });
editor.addEventListener('input', () => { if (!editCaptured) { snapshot(); editCaptured = true; } saveList(); });
editor.addEventListener('blur', fillReadings);
$('#setSelect').onchange = () => {
  stopDictation();
  sets = { ...sets, active: $('#setSelect').value };
  write('sets', sets);
  $('#setStatus').textContent = '';
  resetReview();
  history = [];
  renderSets();
};
let setAction = 'new';
function openSetDialog(action) {
  setAction = action;
  $('#setName').value = action === 'rename' ? sets.items.find(item => item.id === sets.active).name : '';
  $('#setName').setCustomValidity('');
  $('#setDialog').showModal();
  $('#setName').focus();
}
$('#newSet').onclick = () => openSetDialog('new');
$('#renameSet').onclick = () => openSetDialog('rename');
$('#cancelSet').onclick = () => $('#setDialog').close();
$('#setDialog').onsubmit = event => {
  event.preventDefault();
  const name = $('#setName').value.trim();
  if (!name) { $('#setName').setCustomValidity('Enter a set name.'); $('#setName').reportValidity(); return; }
  $('#setName').setCustomValidity('');
  let next;
  if (setAction === 'new') {
    const id = `set-${[...crypto.getRandomValues(new Uint8Array(8))].map(value => value.toString(16).padStart(2, '0')).join('')}`;
    next = addSet(sets, id, name);
  } else next = renameSet(sets, name);
  snapshot();
  if (persistSets(next)) { stopDictation(); $('#setDialog').close(); resetReview(); history = []; renderSets(); }
};
$('#deleteSet').onclick = () => {
  const item = sets.items.find(item => item.id === sets.active);
  if (!item || !confirm(`Delete “${item.name}” and its words? You can undo this.`)) return;
  snapshot();
  if (persistSets(removeSet(sets))) { stopDictation(); resetReview(); history = []; renderSets(); }
};
$('#undoChange').onclick = () => {
  const prior = undoStack.pop();
  if (!prior) return;
  stopDictation();
  sets = prior.sets;
  skipped = new Set(prior.skip);
  write('sets', sets);
  write('skip', prior.skip);
  for (const [name, value] of Object.entries(prior.progress)) write(name, value);
  resetReview();
  history = [];
  renderSets();
  $('#setStatus').textContent = 'Last change undone.';
};
document.querySelectorAll('.mode').forEach(control => {
  control.setAttribute('aria-pressed', String(control.dataset.mode === mode));
  control.onclick = () => {
    mode = control.dataset.mode;
    document.querySelectorAll('.mode').forEach(item => { item.classList.toggle('active', item === control); item.setAttribute('aria-pressed', String(item === control)); });
    resetReview();
    renderList();
  };
});
$('#start').onclick = begin;
$('#back').onclick = back;
$('#groups').onclick = () => showGroups();
for (const [id, group] of [['#openReview', 'Needs review'], ['#openRemembered', 'Remembered']]) {
  $(id).onclick = () => { queue = []; results = []; history = []; showGroups('Your words', group); };
}
$('#resetProgress').onclick = () => { snapshot(); const known = learned(); words().forEach(word => known.delete(keyFor(word))); write(progressName(), [...known]); renderList(); };
$('#pickAll').onclick = () => { snapshot(); words().forEach(word => skipped.delete(word.hanzi)); write('skip', [...skipped]); resetReview(); renderList(); };
$('#pickNone').onclick = () => { snapshot(); words().forEach(word => skipped.add(word.hanzi)); write('skip', [...skipped]); resetReview(); renderList(); };
$('#strict').onchange = renderList;
$('#fillPinyin').onclick = () => { editCaptured = false; fillReadings(); $('#dictationStatus').textContent = 'Missing pinyin filled in. Your existing readings were kept.'; };
$('#formatList').onclick = () => { const formatted = formatList(editor.value); if (formatted !== editor.value) { snapshot(); editor.value = formatted; saveList(); } $('#dictationStatus').textContent = 'Split into study words. Existing pinyin was kept.'; };
$('#speed').oninput = () => { $('#speedValue').textContent = `${Number($('#speed').value)}×`; };
$('#testVoice').onclick = () => speak('你好，我们一起学习中文。');
$('#takePhoto').onclick = () => $('#cameraInput').click();
$('#uploadPhoto').onclick = () => $('#photoInput').click();
$('#cameraInput').onchange = event => void importPhotos(event.target.files);
$('#photoInput').onchange = event => void importPhotos(event.target.files);
$('#phoneImport').onclick = () => void connectPhone();
$('#newPhoneCode').onclick = () => void connectPhone();
$('#closePhone').onclick = () => $('#phoneDialog').close();
$('#phoneDialog').addEventListener('close', () => { phoneGeneration++; closePhoneConnection?.(); closePhoneConnection = undefined; });

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
$('#dictate').onclick = () => {
  if (!Recognition) { $('#dictationStatus').textContent = 'Dictation is unavailable in this browser. Try a browser with speech recognition and allow microphone access.'; return; }
  if (recognition) { recognition.stop(); return; }
  if (sets.active === 'all' || photoBusy) return;
  stopAudio();
  let session;
  try { session = new Recognition(); }
  catch { $('#dictationStatus').textContent = 'Could not start dictation. Check microphone access and try again.'; return; }
  recognition = session;
  session.lang = 'zh-CN';
  session.continuous = true;
  session.interimResults = true;
  const targetSet = sets.active;
  const handled = new Set();
  let heard = 0;
  let failed = false;
  session.onresult = event => {
    if (recognition !== session || sets.active !== targetSet) return;
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal && !handled.has(i)) {
        handled.add(i);
        const result = addDictationText(editor.value, transcript);
        if (result.added) {
          snapshot();
          editor.value = result.value;
          saveList();
          heard += result.added;
        }
      } else if (!event.results[i].isFinal) {
        interim = transcript;
      }
    }
    $('#dictationStatus').textContent = interim ? `Hearing: ${interim}` : heard ? `Added ${heard} words. Keep speaking, or stop dictation.` : 'Listening… Speak Mandarin.';
  };
  session.onerror = event => {
    if (recognition !== session) return;
    failed = true;
    const messages = { 'not-allowed': 'Allow microphone access in your browser, then try again.', 'service-not-allowed': 'Speech recognition is blocked by your browser. Check its speech settings.', 'audio-capture': 'No microphone was found. Connect one and try again.', 'no-speech': 'No speech was heard. Try again and speak closer to the microphone.', network: 'Speech service could not be reached. Check your connection and try again.', 'language-not-supported': 'Mandarin recognition is unavailable in this browser.', aborted: 'Dictation stopped.' };
    $('#dictationStatus').textContent = messages[event.error] || 'Dictation stopped. Check your microphone and try again.';
  };
  session.onend = () => {
    if (recognition !== session) return;
    recognition = undefined;
    $('#dictate').textContent = 'Dictate words';
    $('#dictate').setAttribute('aria-pressed', 'false');
    $('#start').disabled = photoBusy;
    if (!failed) $('#dictationStatus').textContent = heard ? `Dictation finished. Added ${heard} words.` : 'Dictation finished. No new words were added.';
  };
  try {
    session.start();
    $('#dictate').textContent = 'Stop dictation';
    $('#dictate').setAttribute('aria-pressed', 'true');
    $('#dictationStatus').textContent = 'Listening… Say one Mandarin word at a time, pausing between words. Click Stop dictation when finished.';
    $('#start').disabled = true;
  } catch { recognition = undefined; $('#dictationStatus').textContent = 'Could not start dictation. Check microphone access and try again.'; $('#dictate').textContent = 'Dictate words'; $('#dictate').setAttribute('aria-pressed', 'false'); $('#start').disabled = photoBusy; }
};

document.addEventListener('keydown', event => {
  if (!active) return;
  if (event.key === 'Escape') { back(); return; }
  if (event.target.matches('input,textarea,select')) return;
  if (event.code === 'Space') { event.preventDefault(); speak(queue[0].hanzi); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
});
window.addEventListener('pagehide', () => { stopAudio(); stopDictation(); closePhoneConnection?.(); void store.flush(); });
window.addEventListener('online', () => void store.flush());
window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
loadVoices();
renderList();
