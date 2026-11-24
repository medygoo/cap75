// Génère les icônes PNG de Cap75 à partir de icons/icon.svg (usage : node tools/make-icons.mjs)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const icons = resolve(here, '../icons');
const svg = readFileSync(resolve(icons, 'icon.svg'), 'utf8');

// Version « maskable » : fond plein et dessin réduit dans la zone sûre (80 %)
const defs = (svg.match(/<defs>[\s\S]*?<\/defs>/) || [''])[0];
const drawing = svg
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '')
  .replace(defs, '')
  .replace(/<rect width="512" height="512" rx="112" fill="url\(#bg\)"\/>/, '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#bg)"/><g transform="translate(51.2 51.2) scale(0.8)">${drawing}</g></svg>`;

const targets = [
  { file: 'icon-192.png', size: 192, src: svg },
  { file: 'icon-512.png', size: 512, src: svg },
  { file: 'maskable-512.png', size: 512, src: maskable },
  { file: 'apple-touch-icon.png', size: 180, src: maskable },
  { file: 'favicon-32.png', size: 32, src: svg }
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${t.src.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</body></html>`
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  writeFileSync(resolve(icons, t.file), png);
  console.log('icône', t.file, t.size);
}
await browser.close();

// favicon.ico contenant une image PNG 32x32
const png32 = readFileSync(resolve(icons, 'favicon-32.png'));
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6);
header.writeUInt8(32, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png32.length, 14);
header.writeUInt32LE(22, 18);
writeFileSync(resolve(icons, 'favicon.ico'), Buffer.concat([header, png32]));
console.log('favicon.ico');
