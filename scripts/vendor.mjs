import {mkdir, copyFile, cp} from 'node:fs/promises';
await mkdir('dist/vendor', {recursive:true});
await copyFile('node_modules/pinyin-pro/dist/index.mjs','dist/vendor/pinyin-pro.mjs');
await cp('node_modules/pinyin-pro/dist/esm','dist/vendor/esm',{recursive:true});
await copyFile('node_modules/pinyin-pro/LICENSE','dist/vendor/pinyin-pro-LICENSE');

await mkdir('dist/vendor/ocr/core', {recursive:true});
for(const name of ['tesseract.esm.min.js','worker.min.js','tesseract.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'])await copyFile('node_modules/tesseract.js/dist/'+name,'dist/vendor/ocr/'+name);
for(const name of ['tesseract-core.wasm.js','tesseract-core-simd.wasm.js','tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','LICENSE'])await copyFile('node_modules/tesseract.js-core/'+name,'dist/vendor/ocr/core/'+name);
await copyFile('node_modules/tesseract.js/LICENSE.md','dist/vendor/ocr/LICENSE.md');
await mkdir('dist/vendor/phone',{recursive:true});
await copyFile('node_modules/peerjs/dist/peerjs.min.js','dist/vendor/phone/peerjs.min.js');
await copyFile('node_modules/peerjs/LICENSE','dist/vendor/phone/peerjs-LICENSE');
await copyFile('node_modules/qrcode-generator/dist/qrcode.mjs','dist/vendor/phone/qrcode.mjs');
