import { readdirSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const electronDist = join(__dirname, '..', 'electron-dist');

if (!existsSync(electronDist)) {
  mkdirSync(electronDist, { recursive: true });
}

const mainSrc = join(electronDist, 'main', 'main.js');
const mainDest = join(electronDist, 'main.mjs');
if (existsSync(mainSrc)) {
  copyFileSync(mainSrc, mainDest);
  console.log('Copied main/main.js -> main.mjs');
}

const preloadSrc = join(electronDist, 'preload', 'preload.js');
const preloadDest = join(electronDist, 'preload.mjs');
if (existsSync(preloadSrc)) {
  copyFileSync(preloadSrc, preloadDest);
  console.log('Copied preload/preload.js -> preload.mjs');
}

console.log('Electron build files renamed to .mjs');
