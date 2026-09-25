import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {JSDOM} from 'jsdom';

test('phone retains five photo results, rejects six, and retries only failed photos',async()=>{
  const dom=new JSDOM(await readFile(new URL('../dist/phone.html',import.meta.url),'utf8'),{url:'https://ting.test/phone#peer='+('p'.repeat(32))+'&token='+('t'.repeat(32))});
  const previous=new Map();
  function install(key,value){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})}
  let sent=0;
  class Connection extends EventEmitter {
    open=true;
    send(message){sent++;queueMicrotask(()=>{this.emit('data',{type:'progress',id:message.id,message:'Photo received. Reading words…'});this.emit('data',{type:'result',id:message.id,ok:sent!==2,added:sent===2?0:2,message:sent===2?'No Chinese words found. Try a clearer photo.':'Added 2 words.'})});}
  }
  const connection=new Connection();
  class Peer extends EventEmitter {
    constructor(){super();setImmediate(()=>this.emit('open','test-peer'))}
    connect(){setImmediate(()=>connection.emit('data',{type:'ready'}));return connection}
    destroy(){}
  }
  install('window',dom.window);install('document',dom.window.document);install('location',dom.window.location);install('Peer',Peer);
  install('createImageBitmap',async()=>({width:800,height:600,close(){}}));
  dom.window.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){}});
  dom.window.HTMLCanvasElement.prototype.toBlob=callback=>callback(new Blob(['pixels'],{type:'image/jpeg'}));
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  const get=id=>document.getElementById(id);
  async function choose(count){Object.defineProperty(get('chooseFile'),'files',{value:Array.from({length:count},()=>({type:'image/png',size:100})),configurable:true});await get('chooseFile').onchange()}
  try{
    await import('../dist/phone-upload.js?batch-ui');
    await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(get('choose').disabled,false);
    await choose(6);assert.match(get('uploadStatus').textContent,/up to 5/);assert.equal(get('photoQueue').children.length,0);
    await choose(5);assert.equal(get('photoQueue').children.length,5);assert.equal(get('send').disabled,false);
    await get('send').onclick();
    assert.equal(sent,5);assert.equal(document.querySelectorAll('#photoQueue [data-state="done"]').length,4);
    assert.equal(document.querySelectorAll('#photoQueue [data-state="error"]').length,1);
    assert.match(get('uploadStatus').textContent,/8 new words added/);assert.match(get('uploadStatus').textContent,/1 photo needs attention/);
    assert.equal(get('send').textContent,'Retry unfinished photos');
    await get('send').onclick();assert.equal(sent,6);assert.equal(get('uploadStatus').dataset.state,'done');assert.match(get('uploadStatus').textContent,/10 new words added/);
    assert.equal(get('photoQueue').children.length,5,'results stay visible after success');assert.equal(get('send').disabled,true);
    await choose(1);assert.equal(get('photoQueue').children.length,1,'new selection starts a fresh batch');
  }finally{
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();
    for(const [key,descriptor] of previous)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];
  }
});
