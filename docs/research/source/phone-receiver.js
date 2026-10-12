import {createPeer,receivePhotos,phoneLink} from './phone-transfer.js';

export function setupPhoneReceiver({button,importPhoto,beforeReceive}) {
  const $=id=>document.getElementById(id);
  let stop=null,generation=0;
  const previews=[];let received=0,added=0,failed=0;
  function cleanup(){generation++;stop?.();stop=null;$('phoneQR').hidden=true;$('phoneLink').hidden=true;}
  async function start(){
    cleanup();const current=generation;
    $('phoneConnectionStatus').textContent='Creating a secure connection…';
    if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
      $('phoneConnectionStatus').textContent='Open the published website to connect your phone. A localhost address only works on this computer.';return;
    }
    try{
      const [{default:qrcode},peer]=await Promise.all([import('./vendor/phone/qrcode.mjs'),createPeer()]);
      if(current!==generation){peer.destroy();return;}
      const token=crypto.randomUUID();
      stop=receivePhotos({peer,token,
        onStatus:message=>{if(current===generation)$('phoneConnectionStatus').textContent=message},
        onReady:id=>{
          const link=phoneLink(location.href,id,token),qr=qrcode(0,'M');qr.addData(link);qr.make();
          $('phoneQR').src=qr.createDataURL(5,20);$('phoneQR').hidden=false;
          $('phoneLink').href=link;$('phoneLink').hidden=false;
        },
        onPhoto:async (file,onProgress)=>{
          beforeReceive();
          const url=URL.createObjectURL(file),link=document.createElement('a'),image=document.createElement('img'),caption=document.createElement('p'),card=document.createElement('figure');
          link.href=url;link.download='study-photo-'+Date.now()+'.'+(file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg');
          image.src=url;image.alt='Received photo; click to download';link.append(image);caption.textContent='Received. Reading words…';card.append(link,caption);
          $('receivedPhotos').hidden=false;$('receivedPhotoList').append(card);previews.push({url,link:card});
          if(previews.length>5){const old=previews.shift();URL.revokeObjectURL(old.url);old.link.remove();}
          const result=await importPhoto(file,message=>{caption.textContent=message;onProgress(message)});
          caption.textContent=result.message;card.dataset.state=result.ok?'done':'error';
          received++;added+=result.added||0;if(!result.ok)failed++;
          $('phoneImportSummary').hidden=false;
          $('phoneImportSummary').textContent=added+' new words added from '+received+' received photo'+(received===1?'':'s')+'.'+(failed?' '+failed+' photo(s) could not be read. Check the results below.':' Your study list is updated.');
          return result;
        }
      });
    }catch{if(current===generation)$('phoneConnectionStatus').textContent='Could not create a connection. Check your internet connection and create a new code.';}
  }
  button.onclick=()=>{$('phoneDialog').showModal();start()};
  $('newPhoneCode').onclick=start;
  $('closePhone').onclick=()=>{$('phoneDialog').close()};
  $('phoneDialog').addEventListener('close',cleanup);
  window.addEventListener('pagehide',()=>{cleanup();for(const preview of previews)URL.revokeObjectURL(preview.url)});
}
