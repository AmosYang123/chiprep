import { mkdir, copyFile, readdir } from 'node:fs/promises';

await mkdir(new URL('../public/ocr/core/', import.meta.url), { recursive: true });
await copyFile(new URL('../node_modules/tesseract.js/dist/worker.min.js', import.meta.url), new URL('../public/ocr/worker.min.js', import.meta.url));
const core = new URL('../node_modules/tesseract.js-core/', import.meta.url);
const files = (await readdir(core)).filter(name => name.includes('.wasm'));
for (let i = 0; i < files.length; i += 4) {
  const results = await Promise.allSettled(files.slice(i, i + 4).map(name => copyFile(new URL(name, core), new URL(`../public/ocr/core/${name}`, import.meta.url))));
  results.forEach((result, index) => { if (result.status === 'rejected') throw new Error(`Could not copy ${files[i + index]}: ${result.reason}`); });
}
console.log('OCR worker and core assets copied locally.');
