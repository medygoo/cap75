# Cap75 — budget 75 / 15 / 10

Application web installable (PWA) pour tenir son budget avec la règle **75 / 15 / 10** :
75 % maximum pour les dépenses, 15 % pour les projets, 10 % minimum d'épargne.

- **Comptes Supabase** : chacun crée son compte avec son e-mail et un mot de passe, et retrouve ses données sur tous ses appareils.
- **Comptes d'argent** : caisse, banque, M-Pesa, Airtel Money, Orange Money… avec un solde par compte et des transferts entre comptes.
- **Plusieurs devises** : USD, CDF, EUR. Les taux se règlent soi-même ; les totaux sont convertis dans la devise principale.
- **Vue par mois** avec comparaison au mois précédent, et **historique sur 12 mois** (graphique et tableau).
- **Opérations récurrentes** (salaire, loyer, abonnements, tontine) créées automatiquement à leur date.
- **Projets** : objectif, échéance et effort mensuel calculé ; les apports sont liés au projet.
- **Exports** : CSV (Excel), rapport mensuel imprimable en PDF, sauvegarde JSON.
- **Import** des anciens carnets DOXTEHAD (fichiers JSON v1 et v2).
- **Hors ligne** : l'appli s'ouvre sans réseau ; les saisies sont gardées et envoyées au retour de la connexion.
- **Règle personnalisable** et déconnexion automatique après inactivité.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html`, `css/cap75.css` | Page unique et feuille de style (aucune dépendance externe) |
| `js/app.js` | Interface : écrans, formulaires, graphiques |
| `js/data.js` | Supabase : connexion, chargement, cache hors ligne, file de synchronisation |
| `js/finance.js` | Calculs purs : devises, totaux, règle, soldes, récurrences, projets, CSV |
| `js/config.js` | Adresse du projet Supabase et clé publique |
| `js/vendor/supabase.js` | Bibliothèque officielle supabase-js (servie localement) |
| `sw.js`, `manifest.json`, `icons/` | Installation et fonctionnement hors ligne |
| `supabase/migrations/001_cap75_schema.sql` | Tables, sécurité RLS, création du profil à l'inscription |
| `tests/` | Tests unitaires, tests navigateur et fausse base Supabase pour la démo |

## Mettre en service Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécuter `supabase/migrations/001_cap75_schema.sql`.
3. Dans **Authentication → URL Configuration** :
   - *Site URL* : l'adresse publique de l'appli (`https://cap75.pages.dev/`) ;
   - *Redirect URLs* : la même adresse, plus `http://localhost:8080/` pour le développement.
4. Dans **Authentication → Sign In / Providers → Email** : laisser *Enable sign ups* activé (inscription libre).
   *Confirm email* activé = l'utilisateur clique le lien reçu avant d'entrer ; désactivé = accès immédiat.
5. Dans **Project Settings → API**, copier l'URL du projet et la clé **anon / publishable** dans `js/config.js`.

> La clé anon est faite pour être publique : la sécurité des données repose sur les règles RLS
> (chaque utilisateur ne lit et n'écrit que ses propres lignes). Ne jamais mettre la clé
> **service_role** dans ce dépôt.

6. Exécuter aussi `supabase/migrations/002_securite.sql` (contrôles d'appartenance et de validité).

### Sécurité en place

- **Base de données** : RLS sur toutes les tables (chacun ne voit et ne modifie que ses lignes) ;
  aucun droit pour les visiteurs non connectés ; une ligne ne peut référencer que les comptes,
  projets et récurrences de son propriétaire ; le propriétaire d'une ligne ne peut pas changer ;
  contrôles de valeurs (montants positifs, types, devises, longueurs, taux, règle ≤ 100 %).
- **Navigateur** : Content-Security-Policy (scripts de l'appli et projet Supabase uniquement),
  aucun script en ligne, textes toujours échappés, pas de référent envoyé, refus d'être
  affichée dans le cadre d'un autre site, service worker qui ne met jamais en cache les données.
- **Comptes** : mot de passe de 8 caractères minimum avec lettres et chiffres, déconnexion
  automatique après inactivité, cache local effacé à la déconnexion.
- Vérifié en production : lecture et écriture anonymes refusées (401), écriture au nom d'un
  autre refusée (RLS), valeurs invalides refusées (contraintes), aucune donnée d'autrui visible.

### Gérer les utilisateurs

Tout se fait dans **Authentication → Users** du tableau de bord Supabase :
voir les inscrits, inviter quelqu'un par e-mail (*Invite user*), bloquer ou supprimer un compte.
Supprimer un utilisateur efface aussi toutes ses données Cap75.

## Développement

```powershell
npm install
npm run dev
```

- Appli : http://localhost:8080 (avec le projet Supabase de `js/config.js`)
- Publier : `npm run deploy` (Cloudflare Pages, https://cap75.pages.dev)
- Démo sans serveur : http://localhost:8080/tests/demo.html (fausse base dans le navigateur)

## Tests

```powershell
npm run lint
npm test
npx playwright test
```

Les tests navigateur remplacent Supabase par `tests/fake-supabase.js` : ils couvrent l'inscription,
la connexion, les opérations, les comptes et devises, les récurrences, les projets, les exports,
l'import, le hors ligne et l'affichage mobile, sans toucher à la vraie base.

## Publication

Chaque envoi sur `main` lance les tests ; l’ancienne adresse GitHub Pages redirige vers https://cap75.pages.dev. L’appli se publie sur Cloudflare Pages avec `npm run deploy`
(`.github/workflows/pages.yml`). Seuls les fichiers de l'appli sont publiés.

## Historique

- v1 : fichier HTML unique (`legacy/`), données dans le navigateur, mot de passe faible.
- v2 : PWA locale (mot de passe PBKDF2, tests), interface partiellement cassée (31 % des classes CSS manquantes).
- v3 (Cap75) : comptes Supabase, interface refaite, comptes d'argent, devises, récurrences, historique, exports.
