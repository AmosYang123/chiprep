import {mkdir, copyFile, cp} from 'node:fs/promises';
await mkdir('dist/vendor', {recursive:true});
await copyFile('node_modules/pinyin-pro/dist/index.mjs','dist/vendor/pinyin-pro.mjs');
await cp('node_modules/pinyin-pro/dist/esm','dist/vendor/esm',{recursive:true});
await copyFile('node_modules/pinyin-pro/LICENSE','dist/vendor/pinyin-pro-LICENSE');
