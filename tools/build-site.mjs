// Prépare le dossier _site (uniquement les fichiers de l'appli) pour Cloudflare Pages.
// Usage : npm run deploy  (prépare puis publie sur https://cap75.pages.dev)
import { rmSync, mkdirSync, cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, '_site');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'offline.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons']) {
  cpSync(resolve(root, f), resolve(out, f), { recursive: true });
}
console.log('_site prêt');
