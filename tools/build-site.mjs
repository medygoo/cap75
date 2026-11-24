// Prépare le dossier _site pour Cloudflare Pages : uniquement les fichiers de l'appli,
// JS et CSS minifiés, et règles de cache (_headers) pour un chargement rapide sur mobile.
// Usage : npm run deploy  (prépare puis publie sur https://cap75.pages.dev)
import { rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { transformSync } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, '_site');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'offline.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons']) {
  cpSync(resolve(root, f), resolve(out, f), { recursive: true });
}

// Minification (la bibliothèque Supabase est déjà minifiée)
const minify = (rel, loader) => {
  const file = resolve(out, rel);
  const before = statSync(file).size;
  const { code } = transformSync(readFileSync(file, 'utf8'), { loader, minify: true, target: 'es2019', charset: 'utf8' });
  writeFileSync(file, code);
  console.log(`${rel} : ${Math.round(before / 1024)} Ko → ${Math.round(code.length / 1024)} Ko`);
};
['js/app.js', 'js/data.js', 'js/finance.js', 'js/config.js', 'sw.js'].forEach((f) => minify(f, 'js'));
minify('css/cap75.css', 'css');

// Numéro de version dans les liens (app.js?v=3.2.1) : une mise à jour est prise
// immédiatement, même si l'ancien fichier est encore en cache sur le téléphone.
const version = (readFileSync(resolve(root, 'sw.js'), 'utf8').match(/cap75-v([\d.]+)/) || [])[1];
if (!version) throw new Error('Version introuvable dans sw.js');
const stamp = (s) => s.replace(/(\.\/(?:js|css)\/[\w./-]+\.(?:js|css))"/g, `$1?v=${version}"`);
writeFileSync(resolve(out, 'index.html'), stamp(readFileSync(resolve(out, 'index.html'), 'utf8')));
writeFileSync(
  resolve(out, 'sw.js'),
  readFileSync(resolve(out, 'sw.js'), 'utf8').replace(/"(\.\/(?:js|css)\/[\w./-]+\.(?:js|css))"/g, `"$1?v=${version}"`)
);
console.log('version', version, 'appliquée aux liens');

// Cache : la page et le service worker sont toujours revérifiés (mises à jour immédiates),
// les autres fichiers restent en cache et se rafraîchissent en arrière-plan.
writeFileSync(
  resolve(out, '_headers'),
  [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  X-Frame-Options: DENY',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
    '',
    '/sw.js',
    '  Cache-Control: no-cache',
    '',
    ...['app', 'data', 'finance', 'config'].flatMap((n) => [
      `/js/${n}.js`,
      '  Cache-Control: public, max-age=2592000, immutable',
      ''
    ]),
    '/css/*',
    '  Cache-Control: public, max-age=2592000, immutable',
    '',
    '/js/vendor/*',
    '  Cache-Control: public, max-age=2592000, immutable',
    '',
    '/icons/*',
    '  Cache-Control: public, max-age=2592000, immutable',
    ''
  ].join('\n')
);
console.log('_site prêt');
