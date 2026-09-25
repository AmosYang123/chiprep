import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {photoWords,mergePhotoWords,setupPhotoImport} from '../dist/photo-import.js';

test('photo text extracts Chinese words, repairs OCR spaces and removes repeats',()=>{
  assert.deepEqual(photoWords('1. 你 好 nǐ hǎo\n2. 图 书 馆 library\n朋友，学习\n你好'),['你好','图书馆','朋友','学习']);
  assert.deepEqual(photoWords('English 123 <script>alert(1)</script>'),[]);
  assert.ok(photoWords('學習\n朋友').includes('學習'));
});
test('photo merge preserves edited pinyin and adds only new words with readings',()=>{
  const result=mergePhotoWords('你好|custom\n朋友|péng you','你好\n学习\n学习');
  assert.equal(result.added,1);
  assert.equal(result.value,'你好|custom\n朋友|péng you\n学习|xué xí');
  assert.equal(mergePhotoWords('你好|custom','你好').value,'你好|custom');
});
async function harness(recognize){
  const dom=new JSDOM(await readFile(new URL('../dist/index.html',import.meta.url),'utf8'));
  const get=id=>dom.window.document.getElementById(id);
  let value='你好|custom',busy=false;
  setupPhotoImport({camera:get('takePhoto'),upload:get('uploadPhoto'),cameraInput:get('cameraInput'),photoInput:get('photoInput'),language:get('photoLanguage'),status:get('photoStatus'),getValue:()=>value,setValue:next=>{value=next},beforeStart(){},onBusy:next=>{busy=next},recognize});
  function select(file={type:'image/png',size:1024}){Object.defineProperty(get('photoInput'),'files',{value:[file],configurable:true});return get('photoInput').onchange()}
  return {dom,get,select,value:()=>value,busy:()=>busy};
}
test('import automatically appends, exposes progress, blocks double imports and restores controls',async()=>{
  let resolve,calls=0;
  const h=await harness(async(file,language,progress)=>{calls++;assert.equal(language,'chi_sim');progress('Reading words… 50%');return new Promise(done=>{resolve=done})});
  try{
    const pending=h.select();assert.equal(h.busy(),true);assert.equal(h.get('takePhoto').disabled,true);
    assert.match(h.get('photoStatus').textContent,/50%/);await h.select();assert.equal(calls,1);
    resolve('你好\n朋友');await pending;
    assert.match(h.value(),/朋友\|péng yǒu/);assert.match(h.get('photoStatus').textContent,/Added 1/);
    assert.equal(h.busy(),false);assert.equal(h.get('takePhoto').disabled,false);
  }finally{h.dom.window.close()}
});
test('invalid, oversized, empty and failed imports leave existing words intact and permit retry',async()=>{
  let result='',calls=0;
  const h=await harness(async()=>{calls++;if(result instanceof Error)throw result;return result});
  try{
    await h.select({type:'text/plain',size:10});await h.select({type:'image/png',size:21*1024*1024});assert.equal(calls,0);
    await h.select();assert.match(h.get('photoStatus').textContent,/No Chinese/);
    result='你好';await h.select();assert.match(h.get('photoStatus').textContent,/already/);
    result=new Error('network');await h.select();assert.match(h.get('photoStatus').textContent,/Could not read/);
    assert.equal(h.value(),'你好|custom');assert.equal(h.busy(),false);assert.equal(h.get('uploadPhoto').disabled,false);
    result='学习';await h.select();assert.match(h.value(),/学习/);
  }finally{h.dom.window.close()}
});

test('vendored browser OCR exposes the worker factory used by photo import',async()=>{
  globalThis.self=globalThis;
  try {
    const {default:ocr}=await import('../dist/vendor/ocr/tesseract.esm.min.js');
    assert.equal(typeof ocr.createWorker,'function');
  } finally {delete globalThis.self}
});
