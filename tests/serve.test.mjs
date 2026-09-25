import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';

const {default:start}=await import('../scripts/serve.mjs?test');
const server=start(0);
await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
const get=path=>fetch(base+path);

test('serves the app with module-friendly content types',async()=>{
  for(const [path,type] of [['/','text/html'],['/app.js','text/javascript'],['/glass.css','text/css'],['/vendor/pinyin-pro.mjs','text/javascript']]){
    const res=await get(path);
    assert.equal(res.status,200,path+' should be served');
    assert.equal(res.headers.get('content-type'),type,path+' needs the right type to load as a module');
  }
});

test('refuses to serve anything outside dist',async()=>{
  for(const path of ['/../package.json','/..%2fpackage.json','/vendor/../../package.json'])assert.equal((await get(path)).status===200,false,path+' must not escape dist');
});

test.after(()=>server.close());
