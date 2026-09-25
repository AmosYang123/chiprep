import {createPeer,readPairing,sendPhoto,MAX_PHOTO_BYTES} from './phone-transfer.js';
import {MAX_PHOTOS,runPhotoBatch,batchSummary} from './photo-batch.js';
const $=id=>document.getElementById(id);
let connection=null,peer=null,busy=false,preparing=false;
const photos=[];
function controls(){
  const ready=!!connection?.open&&!busy&&!preparing;
  $('capture').disabled=$('choose').disabled=!ready||(photos.length===MAX_PHOTOS&&!photos.every(p=>p.result?.ok));
  $('send').disabled=!ready||!photos.some(p=>!p.result?.ok);
  $('clearPhotos').disabled=busy||preparing||!photos.length;
  if(!busy)$('send').textContent=photos.some(p=>p.state==='error')?'Retry unfinished photos':photos.length?'Upload '+photos.filter(p=>!p.result?.ok).length+(photos.filter(p=>!p.result?.ok).length===1?' photo':' photos')+' to computer':'Upload to computer';
}
function render(){
  $('photoCount').textContent=photos.length+' of '+MAX_PHOTOS+' photos';
  $('photoQueue').replaceChildren(...photos.map((photo,index)=>{
    const row=document.createElement('li'),image=document.createElement('img'),detail=document.createElement('div'),title=document.createElement('strong'),status=document.createElement('p'),remove=document.createElement('button');
    row.dataset.state=photo.state||'ready';image.src=photo.url;image.alt='Photo '+(index+1);title.textContent='Photo '+(index+1);status.textContent=photo.message||'Ready to upload';
    detail.append(title,status);remove.type='button';remove.className='ghost';remove.textContent='Remove';remove.setAttribute('aria-label','Remove photo '+(index+1));remove.disabled=busy||preparing;
    remove.onclick=()=>{URL.revokeObjectURL(photo.url);photos.splice(index,1);render();controls();};row.append(image,detail,remove);return row;
  }));
}
function clear(){for(const photo of photos)URL.revokeObjectURL(photo.url);photos.length=0;render();controls();}
async function prepare(input){
  const files=[...(input.files||[])];input.value='';if(!files.length||busy||preparing)return;
  const existing=photos.every(p=>p.result?.ok)?0:photos.length;
  if(existing+files.length>MAX_PHOTOS){$('uploadStatus').textContent='Choose up to 5 photos total. You have room for '+(MAX_PHOTOS-existing)+' more.';$('uploadStatus').dataset.state='error';return;}
  if(!existing)clear();
  preparing=true;controls();render();let errors=0;
  for(const [index,original] of files.entries()){
    $('uploadStatus').textContent='Preparing photo '+(index+1)+' of '+files.length+'…';let bitmap;
    try{
      if(!original.type.startsWith('image/')||original.size>20*1024*1024)throw new Error('Choose an image under 20 MB.');
      bitmap=await createImageBitmap(original);
      const ratio=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
      const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const file=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
      if(!file||file.size>MAX_PHOTO_BYTES)throw new Error('Photo is too large. Try cropping around the words.');
      photos.push({id:crypto.randomUUID(),file,url:URL.createObjectURL(file)});
    }catch{errors++;}finally{bitmap?.close();}
  }
  preparing=false;render();controls();$('uploadStatus').dataset.state=errors?'error':'ready';
  $('uploadStatus').textContent=errors?errors+' photo(s) could not be opened. Choose JPG or PNG images under 20 MB. '+photos.length+' ready to upload.':photos.length+' photos ready. Tap Upload to computer.';
}
$('capture').onclick=()=>$('captureFile').click();$('choose').onclick=()=>$('chooseFile').click();
$('captureFile').onchange=()=>prepare($('captureFile'));$('chooseFile').onchange=()=>prepare($('chooseFile'));
$('clearPhotos').onclick=()=>{clear();$('uploadStatus').textContent='Take or choose up to 5 photos.';$('uploadStatus').dataset.state='ready';};
$('send').onclick=async()=>{
  if(!photos.length||busy||preparing||!connection?.open)return;
  busy=true;controls();render();$('uploadStatus').dataset.state='working';$('uploadStatus').scrollIntoView({block:'nearest',behavior:'smooth'});
  try{
    await runPhotoBatch(photos,(file,onProgress,id)=>sendPhoto(connection,file,{onProgress,id}),(photo,index)=>{
      $('send').textContent='Processing photo '+(index+1)+' of '+photos.length+'…';
      $('uploadStatus').textContent='Photo '+(index+1)+' of '+photos.length+': '+photo.message;render();
    });
    $('uploadStatus').textContent=batchSummary(photos);$('uploadStatus').dataset.state=photos.every(p=>p.result?.ok)?'done':'error';
  }finally{busy=false;render();controls();}
};
const pairing=readPairing(location.hash);
let timer,ended=false;
function failed(message){ended=true;clearTimeout(timer);const current=peer;peer=null;connection=null;current?.destroy();$('connectionStatus').textContent=message;controls();}
if(!pairing){$('connectionStatus').textContent='Scan a fresh QR code from “Use phone camera” on your computer.';}
else{
  timer=setTimeout(()=>failed('Could not connect. Keep the computer’s QR panel open and scan a new code. Try the same Wi-Fi.'),25000);
  try{
    const created=await createPeer();
    if(ended){created.destroy();throw new Error('Connection timed out')}
    peer=created;
    peer.on('open',()=>{
      connection=peer.connect(pairing.peer,{metadata:{token:pairing.token},reliable:true});
      connection.on('data',message=>{if(message?.type==='ready'){clearTimeout(timer);$('connectionStatus').textContent='Connected to your computer.';controls();}});
      connection.on('close',()=>failed('Computer disconnected or code expired. Scan a new QR code to reconnect.'));
      connection.on('error',()=>failed('Connection interrupted. Scan a new QR code to reconnect.'));
    });
    peer.on('error',()=>failed('Could not reach your computer. Scan a fresh code and try the same Wi-Fi.'));
  }catch{failed('Could not connect. Check your internet connection, then scan the code again.');}
}
window.addEventListener('pagehide',()=>{clearTimeout(timer);peer?.destroy();for(const photo of photos)URL.revokeObjectURL(photo.url)});
