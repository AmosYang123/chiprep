export const MAX_PHOTO_BYTES=8*1024*1024;
export const SESSION_MS=10*60*1000;
const idPattern=/^[a-zA-Z0-9-]{20,80}$/;

export function phoneLink(base, peer, token) {
  const url=new URL('/phone',base);
  url.hash=new URLSearchParams({peer,token}).toString();
  return url.href;
}
export function readPairing(hash) {
  const params=new URLSearchParams(hash.replace(/^#/,''));
  const peer=params.get('peer'),token=params.get('token');
  return idPattern.test(peer||'')&&idPattern.test(token||'') ? {peer,token} : null;
}
export function validPhoto(message) {
  return !!message&&message.type==='photo'&&typeof message.id==='string'&&idPattern.test(message.id)&&
    ['image/jpeg','image/png','image/webp'].includes(message.mime)&&message.bytes instanceof ArrayBuffer&&
    message.bytes.byteLength>0&&message.bytes.byteLength<=MAX_PHOTO_BYTES;
}
let peerScript;
export async function createPeer() {
  if(!globalThis.Peer){
    if(!peerScript)peerScript=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=new URL('./vendor/phone/peerjs.min.js',import.meta.url).href;
      script.onload=resolve;script.onerror=()=>{script.remove();peerScript=null;reject(new Error('Could not load connection tools.'))};document.head.append(script);
    });
    await peerScript;
  }
  return new globalThis.Peer(crypto.randomUUID());
}

// Only the first phone with the unguessable QR token can send photos in this session.
export function receivePhotos({peer,token,onStatus,onPhoto,onReady,schedule=setTimeout,unschedule=clearTimeout}) {
  let connection=null,stopped=false,processing=false;
  const completed=new Map();
  const stop=()=>{if(stopped)return;stopped=true;unschedule(expiry);unschedule(startup);peer.destroy()};
  let expiry;
  const refreshExpiry=()=>{unschedule(expiry);expiry=schedule(()=>{stop();onStatus('This QR code expired. Create a new code to send more photos.');},SESSION_MS)};
  refreshExpiry();
  const startup=schedule(()=>{stop();onStatus('Could not connect. Check your internet connection and try again.');},25000);
  peer.on('open',id=>{if(stopped)return;unschedule(startup);onReady(id);onStatus('Scan with your phone camera. Keep this page open. Code expires after 10 minutes without an upload.');});
  peer.on('error',()=>{stop();onStatus('Connection failed. Try again on the same Wi-Fi, without a VPN.');});
  peer.on('connection',incoming=>{
    if(stopped||incoming.metadata?.token!==token||connection){incoming.on('open',()=>incoming.close());incoming.close();return;}
    connection=incoming;
    incoming.on('open',()=>{onStatus('Phone connected. Take a photo on your phone, then tap Upload to computer.');incoming.send({type:'ready'});});
    incoming.on('close',()=>{connection=null;if(!stopped)onStatus('Phone disconnected. Scan the code again to reconnect.');});
    incoming.on('error',()=>{incoming.close();if(connection===incoming)connection=null;onStatus('Photo connection interrupted. Scan the code again.');});
    incoming.on('data',async message=>{
      if(stopped||connection!==incoming||!incoming.open)return;
      if(!validPhoto(message)){incoming.send({type:'result',id:message?.id,ok:false,message:'Choose a JPG, PNG or WebP photo under 8 MB.'});return;}
      if(completed.has(message.id)){incoming.send(completed.get(message.id));return;}
      if(processing){incoming.send({type:'result',id:message.id,ok:false,message:'The computer is reading another photo. Wait, then upload again.'});return;}
      refreshExpiry();processing=true;
      const progress=text=>{if(stopped)return;onStatus(text);if(incoming.open)incoming.send({type:'progress',id:message.id,message:text})};
      progress('Photo received on computer. Preparing to read words…');
      let result;
      try{result=await onPhoto(new Blob([message.bytes],{type:message.mime}),progress);}
      catch{result={ok:false,message:'Photo received, but could not be read. Try a clearer photo.'};}
      const reply={type:'result',id:message.id,ok:!!result?.ok,added:Number.isInteger(result?.added)?result.added:0,message:result?.message||'Photo received.'};
      if(reply.ok)completed.set(message.id,reply);if(completed.size>30)completed.delete(completed.keys().next().value);
      processing=false;
      if(!stopped){onStatus(reply.message);if(incoming.open)incoming.send(reply);}
    });
  });
  return stop;
}

export function sendPhoto(connection,file,{timeoutMs=45000,maxWaitMs=240000,onProgress=()=>{},id=crypto.randomUUID(),schedule=setTimeout,unschedule=clearTimeout}={}) {
  return new Promise((resolve,reject)=>{
    if(!connection.open){reject(new Error('Computer disconnected. Scan a new QR code.'));return;}
    let settled=false,timer;
    const finish=(error,result)=>{if(settled)return;settled=true;unschedule(timer);unschedule(deadline);connection.off('data',onData);connection.off('close',onClose);connection.off('error',onClose);error?reject(error):resolve(result)};
    const resetTimer=()=>{unschedule(timer);timer=schedule(()=>finish(new Error('No confirmation from the computer. Check that its page is open, then retry this photo.')),timeoutMs)};
    const onData=message=>{
      if(message?.id!==id)return;
      if(message.type==='progress'&&typeof message.message==='string'){resetTimer();onProgress(message.message);}
      if(message.type==='result')finish(null,message);
    };
    const onClose=()=>finish(new Error('Connection lost. Check your computer before trying again.'));
    const deadline=schedule(()=>finish(new Error('No confirmation after four minutes. Check your computer before retrying this photo.')),maxWaitMs);
    resetTimer();
    connection.on('data',onData);connection.on('close',onClose);connection.on('error',onClose);
    file.arrayBuffer().then(bytes=>{
      if(settled)return;
      const message={type:'photo',id,mime:file.type,bytes};
      if(!validPhoto(message))throw new Error('Choose a JPG, PNG or WebP photo under 8 MB.');
      if(!connection.open)throw new Error('Computer disconnected. Scan a new QR code.');
      connection.send(message);
    }).catch(error=>finish(error));
  });
}
