import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {phoneLink,readPairing,validPhoto,receivePhotos,sendPhoto,MAX_PHOTO_BYTES,SESSION_MS} from '../dist/phone-transfer.js';
const token='a'.repeat(32),id='b'.repeat(32);
class Connection extends EventEmitter {
  constructor(secret=token){super();this.metadata={token:secret};this.open=true;this.sent=[];}
  send(message){this.sent.push(message)}
  close(){if(this.open){this.open=false;this.emit('close')}}
}
class Peer extends EventEmitter {destroy(){this.destroyed=true}}
const photo=()=>({type:'photo',id,mime:'image/jpeg',bytes:new Uint8Array([1,2,3]).buffer});
function setup(onPhoto=async()=>({ok:true,message:'Added 2 words.'})){
  const peer=new Peer(),statuses=[],timers=new Map();let next=0;
  const stop=receivePhotos({peer,token,onStatus:s=>statuses.push(s),onPhoto,onReady(){},schedule:(fn,ms)=>{timers.set(++next,{fn,ms});return next},unschedule:key=>timers.delete(key)});
  return {peer,statuses,timers,stop};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('QR links keep connection credentials in fragment and reject malformed pairings',()=>{
  const url=new URL(phoneLink('https://study.example/','p'.repeat(32),token));
  assert.equal(url.pathname,'/phone');assert.equal(url.search,'');
  assert.deepEqual(readPairing(url.hash),{peer:'p'.repeat(32),token});
  assert.equal(readPairing('#peer=x&token=y'),null);
  assert.equal(readPairing('#peer='+id+'&token=<script>'),null);
});
test('only bounded image payloads are accepted',()=>{
  assert.equal(validPhoto(photo()),true);
  for(const message of [null,{}, {...photo(),mime:'text/html'}, {...photo(),id:'x'}, {...photo(),bytes:'not bytes'}, {...photo(),bytes:new ArrayBuffer(0)}, {...photo(),bytes:new ArrayBuffer(MAX_PHOTO_BYTES+1)}])assert.equal(validPhoto(message),false);
});
test('receiver rejects wrong token and extra phones, then acknowledges successful photo once',async()=>{
  let count=0;
  const h=setup(async blob=>{count++;assert.equal(blob.type,'image/jpeg');assert.equal(blob.size,3);return {ok:true,message:'Added 2 words.'}});
  const bad=new Connection('wrong');h.peer.emit('connection',bad);assert.equal(bad.open,false);
  const good=new Connection();h.peer.emit('connection',good);good.emit('open');assert.equal(good.sent[0].type,'ready');
  const extra=new Connection();h.peer.emit('connection',extra);assert.equal(extra.open,false);
  good.emit('data',photo());await tick();assert.equal(count,1);assert.equal(good.sent.at(-1).ok,true);
  good.emit('data',photo());await tick();assert.equal(count,1,'repeated transfer id does not duplicate an import');
  good.close();const replacement=new Connection();h.peer.emit('connection',replacement);replacement.emit('open');assert.equal(replacement.sent[0].type,'ready');h.stop();
});
test('receiver reports busy/failure, blocks late data and expires session',async()=>{
  let finish;const h=setup(()=>new Promise(resolve=>{finish=resolve}));const c=new Connection();h.peer.emit('connection',c);c.emit('open');
  c.emit('data',photo());c.emit('data',{...photo(),id:'c'.repeat(32)});assert.match(c.sent.at(-1).message,/another photo/);
  finish({ok:false,message:'No image could be read.'});await tick();assert.equal(c.sent.at(-1).ok,false);
  [...h.timers.values()].find(t=>t.ms===SESSION_MS).fn();assert.equal(h.peer.destroyed,true);assert.match(h.statuses.at(-1),/expired/);
  const before=c.sent.length;c.emit('data',photo());await tick();assert.equal(c.sent.length,before);
});
test('sender waits for matching acknowledgement and removes listeners',async()=>{
  const c=new Connection();const pending=sendPhoto(c,new Blob(['pixels'],{type:'image/jpeg'}));await tick();
  const sent=c.sent[0];assert.equal(sent.type,'photo');assert.equal(sent.bytes.byteLength,6);
  c.emit('data',{type:'result',id:'wrong',ok:true});assert.equal(c.listenerCount('data'),1);
  c.emit('data',{type:'result',id:sent.id,ok:true,message:'Added words'});
  assert.equal((await pending).ok,true);assert.equal(c.listenerCount('data'),0);assert.equal(c.listenerCount('close'),0);
});
test('sender handles disconnects, invalid photos and acknowledgement timeouts',async()=>{
  const c=new Connection();c.open=false;await assert.rejects(sendPhoto(c,new Blob()),/disconnected/);
  c.open=true;await assert.rejects(sendPhoto(c,new Blob(['x'],{type:'text/html'})),/JPG/);
  let timeout;const pending=sendPhoto(c,new Blob(['x'],{type:'image/jpeg'}),{schedule:fn=>{timeout=fn;return 1},unschedule(){}});
  await tick();timeout();await assert.rejects(pending,/No confirmation/);assert.equal(c.listenerCount('data'),0);
});

test('phone gets receipt and recognition progress before the final word count',async()=>{
  let finish,report;
  const h=setup((blob,progress)=>{report=progress;return new Promise(resolve=>{finish=resolve})});
  const c=new Connection();h.peer.emit('connection',c);c.emit('open');c.emit('data',photo());
  try{
    assert.equal(c.sent.at(-1).type,'progress');
    assert.match(c.sent.at(-1).message,/received/i);
    report('Reading words… 50%');assert.match(c.sent.at(-1).message,/50%/);
    finish({ok:true,message:'Added 3 words.',added:3});await tick();
    assert.equal(c.sent.at(-1).added,3);assert.equal(c.sent.at(-1).type,'result');
  }finally{finish?.({ok:false});h.stop()}
});
test('matching progress resets the inactivity timeout without implying completion',async()=>{
  const c=new Connection(),updates=[],timers=new Map();let key=0;
  const pending=sendPhoto(c,new Blob(['x'],{type:'image/jpeg'}),{onProgress:m=>updates.push(m),schedule:fn=>{timers.set(++key,fn);return key},unschedule:k=>timers.delete(k)});
  await tick();const id=c.sent[0].id;
  try{
    const before=key;c.emit('data',{type:'progress',id,message:'Photo received. Reading words…'});
    assert.equal(updates.length,1);assert.ok(key>before);assert.equal(timers.size,2,'inactivity timer plus absolute deadline');
  }finally{c.emit('data',{type:'result',id,ok:true,added:2});await pending}
});
