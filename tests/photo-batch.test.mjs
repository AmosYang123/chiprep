import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runPhotoBatch,MAX_PHOTOS,batchSummary} from '../dist/photo-batch.js';

test('five photos upload sequentially with per-photo results and a total',async()=>{
  const photos=Array.from({length:5},(_,i)=>({id:String(i),file:i}));let active=0,peak=0;
  await runPhotoBatch(photos,async file=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;return {ok:true,added:file+1,message:'Added words'}},()=>{});
  assert.equal(peak,1);assert.equal(photos.filter(p=>p.result.ok).length,5);
  assert.match(batchSummary(photos),/15 new words added/);
});
test('partial failures remain retryable and confirmed photos are not sent again',async()=>{
  const photos=[{file:1},{file:2},{file:3}];
  await runPhotoBatch(photos,async file=>{if(file===2)throw new Error('Disconnected');return {ok:true,added:2}},()=>{});
  assert.match(batchSummary(photos),/1 photo needs attention/);
  const retried=[];await runPhotoBatch(photos,async file=>{retried.push(file);return {ok:true,added:0}},()=>{});
  assert.deepEqual(retried,[2]);assert.match(batchSummary(photos),/4 new words added/);
});
test('over-limit batches are rejected before sending anything',async()=>{
  let sent=0;await assert.rejects(runPhotoBatch(Array.from({length:MAX_PHOTOS+1},()=>({file:1})),async()=>{sent++},()=>{}),/5/);assert.equal(sent,0);
});
