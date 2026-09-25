import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL('../dist/'+name,import.meta.url),'utf8');
// Split a stylesheet into top-level {prelude,body} rules so at-rule blocks can be inspected on their own.
function rules(css){
  const out=[];let i=0;
  while(i<css.length){
    const open=css.indexOf('{',i);if(open<0)break;
    let depth=1,j=open+1;
    while(j<css.length&&depth){if(css[j]==='{')depth++;else if(css[j]==='}')depth--;j++}
    assert.equal(depth,0,'unbalanced braces near '+css.slice(i,open+40));
    out.push({prelude:css.slice(i,open).replace(/\/\*[\s\S]*?\*\//g,'').trim(),body:css.slice(open+1,j-1)});
    i=j;
  }
  return out;
}
const selectorsIn=list=>list.flatMap(rule=>rule.prelude.split(',').map(s=>s.trim()));
const block=(all,match)=>{const found=all.find(rule=>rule.prelude.includes(match));assert.ok(found,'missing block '+match);return found};

test('glass stylesheet loads after the base styles it re-skins',async()=>{
  const html=await read('index.html');
  const sheets=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(sheets,['polish.css','input.css','glass.css','workspace.css']);
});

test('surfaces use the real material: blurred and saturated backdrop, both prefixes',async()=>{
  const css=await read('glass.css');
  const surface=rules(css).find(rule=>/^\.topbar,/.test(rule.prelude));
  assert.ok(surface,'expected a shared glass surface rule');
  assert.match(surface.body,/-webkit-backdrop-filter:blur\(var\(--glass-blur\)\) saturate\(var\(--glass-sat\)\)/);
  assert.match(surface.body,/(?<!-)backdrop-filter:blur\(var\(--glass-blur\)\) saturate\(var\(--glass-sat\)\)/);
  for(const selector of ['.panel','.entry','.topbar','.answer','.mode','.secondary'])assert.ok(selectorsIn([surface]).includes(selector),selector+' is not a glass surface');
});

test('an ambient field sits behind the page so the glass has something to refract',async()=>{
  const css=await read('glass.css');
  const ambient=rules(css).find(rule=>rule.prelude==='body:before');
  assert.ok(ambient,'expected an ambient backdrop layer');
  assert.match(ambient.body,/position:fixed/);
  assert.match(ambient.body,/z-index:-1/);
  assert.match(ambient.body,/pointer-events:none/);
  assert.ok((ambient.body.match(/radial-gradient/g)??[]).length>=3,'expected a multi-stop colour field');
});

test('every translucent surface has an opaque fallback in both degraded modes',async()=>{
  const css=await read('glass.css');
  const all=rules(css);
  const translucent=selectorsIn(all.filter(rule=>!rule.prelude.startsWith('@')&&/background:[^;]*var\(--glass(?:-strong|-raised)?\)/.test(rule.body)));
  assert.ok(translucent.length>=8,'expected the glass layer to cover the app surfaces');
  for(const name of ['@supports not','@media(prefers-reduced-transparency:reduce)']){
    const covered=selectorsIn(rules(block(all,name).body));
    for(const selector of translucent)assert.ok(covered.includes(selector),selector+' has no fallback in '+name);
  }
});

test('reduced transparency drops the blur instead of only recolouring it',async()=>{
  const css=await read('glass.css');
  const reduced=block(rules(css),'@media(prefers-reduced-transparency:reduce)').body;
  assert.match(reduced,/-webkit-backdrop-filter:none/);
  assert.match(reduced,/(?<!-)backdrop-filter:none/);
  assert.match(reduced,/body:before\{display:none\}/);
});

test('button text keeps an opaque tint under it',async()=>{
  const css=await read('glass.css');
  const tinted=rules(css).filter(rule=>!rule.prelude.startsWith('@')&&rule.prelude.split(",").every(s=>/^\.(primary|next)\b/.test(s.trim()))&&/background:/.test(rule.body));
  assert.ok(tinted.length>=2,'expected default and hover tints');
  for(const rule of tinted)assert.match(rule.body,/,var\(--accent(?:-deep)?\)/,rule.prelude+' must sit on a solid accent');
});
