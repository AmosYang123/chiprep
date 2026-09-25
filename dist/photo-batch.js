export const MAX_PHOTOS=5;

export async function runPhotoBatch(photos,send,onUpdate) {
  if(photos.length>MAX_PHOTOS)throw new Error('Choose up to 5 photos at a time.');
  for(const [index,photo] of photos.entries()){
    if(photo.result?.ok)continue;
    photo.state='working';photo.message='Sending to computer…';onUpdate(photo,index);
    try{photo.result=await send(photo.file,message=>{photo.message=message;onUpdate(photo,index)},photo.id);}
    catch(error){photo.result={ok:false,message:error.message||'Could not upload. Try again.'};}
    photo.state=photo.result.ok?'done':'error';photo.message=photo.result.message;onUpdate(photo,index);
  }
}

export function batchSummary(photos) {
  const done=photos.filter(photo=>photo.result?.ok),failed=photos.length-done.length;
  const added=done.reduce((total,photo)=>total+(photo.result.added||0),0);
  return done.length+' of '+photos.length+' photos processed. '+added+' new words added to your computer’s study list.'+
    (failed?' '+failed+' photo'+(failed===1?' needs':'s need')+' attention. Retry or replace them.':' You can now study on your computer.');
}
