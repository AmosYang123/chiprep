import {createPeer,readPairing,sendPhoto,MAX_PHOTO_BYTES} from './phone-transfer.js';
const $=id=>document.getElementById(id);
let connection=null,peer=null,file=null,previewURL=null,busy=false,preparing=false;
function controls(){const ready=!!connection?.open&&!busy&&!preparing;$('capture').disabled=$('choose').disabled=!ready;$('send').disabled=!ready||!file;}
async function prepare(input){
  const original=input.files?.[0];input.value='';if(!original)return;
  file=null;preparing=true;controls();$('preview').hidden=true;
  if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
  $('uploadStatus').textContent='Preparing photo…';
  let bitmap;
  try{
    if(!original.type.startsWith('image/')||original.size>20*1024*1024)throw new Error('Choose an image under 20 MB.');
    bitmap=await createImageBitmap(original);
    const ratio=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    file=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
    if(!file||file.size>MAX_PHOTO_BYTES)throw new Error('Photo is too large. Try cropping around the words.');
    previewURL=URL.createObjectURL(file);$('preview').src=previewURL;$('preview').hidden=false;
    $('uploadStatus').textContent='Ready. Tap Upload to computer to send this photo.';
  }catch(error){file=null;$('uploadStatus').textContent=error.message||'Could not open this photo. Try JPG or PNG.';}
  finally{bitmap?.close();preparing=false;controls();}
}
$('capture').onclick=()=>$('captureFile').click();$('choose').onclick=()=>$('chooseFile').click();
$('captureFile').onchange=()=>prepare($('captureFile'));$('chooseFile').onchange=()=>prepare($('chooseFile'));
$('send').onclick=async()=>{
  if(!file||busy||!connection?.open)return;
  busy=true;controls();$('uploadStatus').textContent='Sending photo… Keep this page open while your computer reads the words.';
  try{
    const result=await sendPhoto(connection,file);
    $('uploadStatus').textContent=result.message;
    if(result.ok){file=null;$('preview').hidden=true;if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}}
  }catch(error){$('uploadStatus').textContent=error.message;}
  finally{busy=false;controls();}
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
window.addEventListener('pagehide',()=>{clearTimeout(timer);peer?.destroy();if(previewURL)URL.revokeObjectURL(previewURL)});
