import {transcriptLines, withPinyin} from './dictation.js';

export function photoWords(text) {
  // OCR often inserts spaces between Chinese characters; preserve line/column boundaries.
  const cleaned=text.replace(/(\p{Script=Han})[ \t](?=\p{Script=Han})/gu,'$1');
  return [...new Set((cleaned.match(/\p{Script=Han}+/gu)||[]).flatMap(transcriptLines))];
}

export function mergePhotoWords(current, text) {
  const existing=new Set(current.split('\n').map(line=>line.split('|')[0].trim()));
  const words=photoWords(text).filter(word=>!existing.has(word));
  return {value:words.length ? [current.trimEnd(),withPinyin(words.join('\n'))].filter(Boolean).join('\n') : current, added:words.length};
}

export async function recognizePhoto(file, language, onProgress) {
  const {default:{createWorker}}=await import('./vendor/ocr/tesseract.esm.min.js');
  let worker;
  try {
    worker=await createWorker(language,1,{
      workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,
      corePath:new URL('./vendor/ocr/core/',import.meta.url).href,
      logger:message=>onProgress(message.status==='recognizing text' ? 'Reading words… '+Math.round(message.progress*100)+'%' : 'Preparing text reader… First use may take a moment.')
    });
    const result=await worker.recognize(file);
    return result.data.text;
  } finally {if(worker)await worker.terminate();}
}

export function setupPhotoImport({camera, upload, cameraInput, photoInput, language, status, getValue, setValue, beforeStart, onBusy, recognize=recognizePhoto}) {
  let busy=false;
  camera.onclick=()=>cameraInput.click();upload.onclick=()=>photoInput.click();
  async function importFile(file) {
    if(!file||busy)return {ok:false,message:'The computer is busy. Finish the current photo, then upload again.'};
    if(!/^image\/(jpeg|png|webp|bmp|gif)$/i.test(file.type)){status.textContent='Choose a JPG, PNG, WebP, BMP or GIF image. Export HEIC photos as JPG first.';return {ok:false,message:status.textContent};}
    if(file.size>20*1024*1024){status.textContent='This photo is too large. Choose an image under 20 MB.';return {ok:false,message:status.textContent};}
    busy=true;beforeStart();camera.disabled=upload.disabled=language.disabled=true;onBusy(true);
    status.textContent='Preparing text reader…';
    try {
      const text=await recognize(file,language.value,message=>{status.textContent=message});
      const result=mergePhotoWords(getValue(),text);
      if(result.added){setValue(result.value);status.textContent='Added '+result.added+' words with pinyin. Check the words and readings below; photo recognition can make mistakes.';}
      else status.textContent=photoWords(text).length ? 'These words are already in your list. No duplicates added.' : 'No Chinese words found. Try a clearer, well-lit photo cropped around the printed text.';
      return {ok:true,message:status.textContent};
    } catch {status.textContent='Could not read this image. Check your connection and try a clear JPG or PNG photo. Your list has been kept.';return {ok:false,message:status.textContent};}
    finally {busy=false;camera.disabled=upload.disabled=language.disabled=false;onBusy(false);}
  }
  for(const input of [cameraInput,photoInput])input.onchange=()=>{const file=input.files?.[0];input.value='';return importFile(file)};
  return importFile;
}
