import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const script=await readFile(new URL('../dist/theme.js',import.meta.url),'utf8');
async function setup(page,preference,dark=false){
  const dom=new JSDOM(await readFile(new URL('../dist/'+page,import.meta.url),'utf8'),{url:'https://ting.test',runScripts:'outside-only'});
  const media={matches:dark,addEventListener(event,handler){this.change=handler}};
  dom.window.matchMedia=()=>media;
  if(preference)dom.window.localStorage.setItem('ting-theme',preference);
  dom.window.eval(script);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return {dom,media,root:dom.window.document.documentElement,select:dom.window.document.querySelector('[data-theme-select]')};
}
test('system appearance follows device changes on both study and phone pages',async()=>{
  for(const page of ['index.html','phone.html']){
    const h=await setup(page,null,true);
    try{
      assert.equal(h.root.dataset.theme,'dark');assert.equal(h.select.value,'system');
      h.media.matches=false;h.media.change();assert.equal(h.root.dataset.theme,'light');
      assert.equal(h.dom.window.document.querySelector('meta[name="theme-color"]').content,'#ffffff');
    }finally{h.dom.window.close()}
  }
});
test('manual appearance persists, overrides system changes and syncs across tabs',async()=>{
  const h=await setup('index.html','dark');
  try{
    assert.equal(h.root.dataset.theme,'dark');assert.equal(h.select.value,'dark');
    h.select.value='light';h.select.dispatchEvent(new h.dom.window.Event('change'));
    assert.equal(h.dom.window.localStorage.getItem('ting-theme'),'light');
    h.media.matches=true;h.media.change();assert.equal(h.root.dataset.theme,'light');
    h.dom.window.dispatchEvent(new h.dom.window.StorageEvent('storage',{key:'ting-theme',newValue:'dark'}));
    assert.equal(h.select.value,'dark');assert.equal(h.root.dataset.theme,'dark');
  }finally{h.dom.window.close()}
});
test('invalid saved settings fall back to system appearance',async()=>{
  const h=await setup('phone.html','unexpected',true);
  try{assert.equal(h.select.value,'system');assert.equal(h.root.dataset.theme,'dark')}finally{h.dom.window.close()}
});
