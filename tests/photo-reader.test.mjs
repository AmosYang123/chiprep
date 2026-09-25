import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPhotoReader} from '../dist/photo-reader.js';

test('successive photos reuse the reader and changing language replaces it',async()=>{
  let loads=0,terminated=0;const messages=[];
  const read=createPhotoReader({loadWorker:async(language,progress)=>{loads++;return {recognize:async()=>{progress({status:'recognizing text',progress:.5});return {data:{text:'你好'}}},terminate:async()=>{terminated++}}}});
  try{
    assert.equal(await read('one','chi_sim',m=>messages.push(m)),'你好');
    await read('two','chi_sim',()=>{});assert.equal(loads,1);assert.match(messages[0],/50%/);
    await read('three','chi_tra',()=>{});assert.equal(loads,2);assert.equal(terminated,1);
  }finally{await read.dispose()}
});
test('stalled recognition times out, terminates its worker and permits another attempt',async()=>{
  let loads=0,terminated=0;
  const read=createPhotoReader({timeoutMs:10,loadWorker:async()=>({recognize:()=>++loads===1?new Promise(()=>{}):Promise.resolve({data:{text:'朋友'}}),terminate:async()=>{terminated++}})});
  try{await assert.rejects(read('bad','chi_sim',()=>{}),/too long/);assert.equal(terminated,1);assert.equal(await read('good','chi_sim',()=>{}),'朋友');}
  finally{await read.dispose()}
});
