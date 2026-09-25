// Keep the language model warm for a batch, then release its memory after a minute idle.
export function createPhotoReader({loadWorker,timeoutMs=180000,idleMs=60000}) {
  let worker=null,language=null,idle=null,report=()=>{},generation=0;
  async function dispose(){generation++;clearTimeout(idle);const old=worker;worker=null;language=null;if(old)await old.terminate();}
  async function read(file,nextLanguage,onProgress=()=>{}) {
    clearTimeout(idle);report=onProgress;
    if(worker&&language!==nextLanguage)await dispose();
    const current=generation;let timeout;
    const operation=(async()=>{
      if(!worker){
        const created=await loadWorker(nextLanguage,message=>{
          if(current!==generation)return;
          const percent=Number.isFinite(message.progress)?' '+Math.round(message.progress*100)+'%':'';
          report(message.status==='recognizing text'?'Reading words…'+percent:message.status.includes('language')?'Loading Chinese text reader…'+percent+' (first use can take a minute)':'Preparing text reader…'+percent);
        });
        if(current!==generation){await created.terminate();throw new Error('Text reader was stopped.');}
        worker=created;language=nextLanguage;
      }
      const result=await worker.recognize(file);return result.data.text;
    })();
    try{return await Promise.race([operation,new Promise((resolve,reject)=>{timeout=setTimeout(()=>reject(new Error('Reading took too long. Check your connection or try a smaller, clearer photo.')),timeoutMs)})]);}
    catch(error){await dispose();throw error;}
    finally{clearTimeout(timeout);if(worker)idle=setTimeout(()=>{void dispose()},idleMs);}
  }
  read.dispose=dispose;return read;
}
