// Génère les icônes de CAP FIN à partir du logo officiel branding/capfin-logo.jpg
// (usage : npm run icons). Le symbole (le « C » et sa flèche) est repéré
// automatiquement dans la partie haute du logo, puis posé sur fond blanc.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const icons = resolve(here, '../icons');
const logo = 'data:image/jpeg;base64,' + readFileSync(resolve(here, '../branding/capfin-logo.jpg')).toString('base64');

// size : taille finale ; scale : part occupée par le symbole ; radius : arrondi (0 = carré plein)
const targets = [
  { file: 'icon-192.png', size: 192, scale: 0.8, radius: 0.22 },
  { file: 'icon-512.png', size: 512, scale: 0.8, radius: 0.22 },
  { file: 'maskable-512.png', size: 512, scale: 0.62, radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.74, radius: 0 },
  { file: 'logo-mark.png', size: 96, scale: 0.8, radius: 0.24 },
  { file: 'favicon-32.png', size: 32, scale: 0.9, radius: 0.2 }
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
const results = await page.evaluate(
  async ({ logo, targets }) => {
    const img = new Image();
    img.src = logo;
    await img.decode();
    const src = document.createElement('canvas');
    src.width = img.width;
    src.height = img.height;
    const sctx = src.getContext('2d');
    sctx.drawImage(img, 0, 0);
    // Le symbole occupe le haut du logo (au-dessus du texte « CAP FIN »)
    const limitY = Math.round(img.height * 0.66);
    const data = sctx.getImageData(0, 0, img.width, limitY).data;
    let x0 = img.width, y0 = limitY, x1 = 0, y1 = 0;
    for (let y = 0; y < limitY; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        if (data[i] + data[i + 1] + data[i + 2] < 600) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, side = Math.max(w, h);
    const out = {};
    for (const t of targets) {
      const c = document.createElement('canvas');
      c.width = c.height = t.size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const r = t.radius * t.size;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(0, 0, t.size, t.size, r);
      ctx.fill();
      const box = t.size * t.scale, k = box / side;
      const dw = w * k, dh = h * k;
      ctx.drawImage(src, x0, y0, w, h, (t.size - dw) / 2, (t.size - dh) / 2, dw, dh);
      out[t.file] = c.toDataURL('image/png').split(',')[1];
    }
    return { box: [x0, y0, x1, y1], out };
  },
  { logo, targets }
);
await browser.close();
console.log('symbole repéré :', results.box.join(', '));
for (const [file, b64] of Object.entries(results.out)) {
  writeFileSync(resolve(icons, file), Buffer.from(b64, 'base64'));
  console.log('icône', file);
}

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
