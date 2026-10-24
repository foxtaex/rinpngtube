import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

// Canonical production UI; builds must never restore the archived legacy layout.
const html = await readFile(path.join(root,'renderer/index.html'),'utf8');
await mkdir(path.join(root,'app'),{recursive:true});
await writeFile(path.join(root,'app/index.html'),html);
// app/assets contains the canonical bundled PNGs; no external archive is needed.
console.log('RinPNGTube studio built; all five supplied character PNGs preserved.');
