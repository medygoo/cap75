import { test, expect } from '@playwright/test';
import { useFakeBackend, signUp, addOperation, uniqueEmail, PASSWORD, today, monthsAgo, money } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await useFakeBackend(page);
});

const capValue = (page) => page.locator('.cap-figure .value');

test.describe('Francs congolais et alertes', () => {
  test('saisie en FC : conversion affichée en direct et comptée en dollars', async ({ page }) => {
    await signUp(page);
    await page.locator('.topbar').getByRole('button', { name: 'Nouvelle opération' }).click();
    const d = page.getByRole('dialog');
    await d.locator('label[for="t-Revenu"]').click();
    await d.getByLabel('Devise').selectOption('CDF');
    await d.getByLabel('Montant').fill('285000');
    await expect(d.locator('[data-convert]')).toContainText('100,00');
    await expect(d.locator('[data-convert]')).toContainText(/2\s850\sFC/);
    await d.getByLabel('Catégorie').fill('Vente');
    await d.getByRole('button', { name: "Ajouter l'opération" }).click();
    await expect(capValue(page)).toHaveText(/100,00/);
  });

  test('devise de saisie par défaut : toujours CDF', async ({ page }) => {
    await signUp(page);
    await page.getByRole('button', { name: 'Paramètres' }).first().click();
    await page.getByLabel('Devise de saisie').selectOption('CDF');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await page.locator('.topbar').getByRole('button', { name: 'Nouvelle opération' }).click();
    await expect(page.getByRole('dialog').getByLabel('Devise')).toHaveValue('CDF');
  });

  test('le taux du jour est récupéré automatiquement', async ({ page }) => {
    await useFakeBackend(page, { rates: { CDF: 2900, EUR: 0.9 } });
    await signUp(page);
    await page.getByRole('button', { name: 'Paramètres' }).first().click();
    await expect(page.getByLabel('1 USD = … CDF')).toHaveValue('2900');
    await expect(page.locator('.rate-status')).toContainText('automatique');
  });

  test('alertes en couleurs : loyer rouge, épargne orange', async ({ page }) => {
    await signUp(page);
    await addOperation(page, { type: 'Revenu', amount: 1000, category: 'Salaire' });
    await addOperation(page, { type: 'Dépense', amount: 600, category: 'Loyer' });
    const rent = page.locator('.alert.danger', { hasText: 'Alerte loyer' });
    await expect(rent).toContainText('60 %');
    await expect(page.locator('.alert.warning', { hasText: 'Épargne à renforcer' })).toBeVisible();
    await expect(page.locator('.alert-count.danger')).toContainText('1 à corriger');
    // Seuil réglable : loyer jusqu'à 70 % → plus d'alerte rouge
    await page.getByRole('button', { name: 'Paramètres' }).first().click();
    await page.getByLabel('Alerte loyer au-delà de (%)').fill('70');
    await page.getByRole('button', { name: 'Enregistrer la règle' }).click();
    await page.getByRole('button', { name: 'Tableau de bord' }).first().click();
    await expect(page.locator('.alert', { hasText: 'Alerte loyer' })).toHaveCount(0);
  });

  test('alerte verte quand le cap est tenu', async ({ page }) => {
    await signUp(page);
    await addOperation(page, { type: 'Revenu', amount: 1000, category: 'Salaire' });
    await addOperation(page, { type: 'Dépense', amount: 500, category: 'Alimentation' });
    await addOperation(page, { type: 'Épargne', amount: 150, category: 'Épargne mensuelle' });
    await expect(page.locator('.alert.success', { hasText: 'Cap tenu' })).toBeVisible();
  });
});

test.describe('Compte et connexion', () => {
  test('inscription libre puis accès direct au tableau de bord', async ({ page }) => {
    await signUp(page, { name: 'Amani' });
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.locator('.user-chip')).toContainText('Amani');
    await expect(page.locator('.mini-accounts')).toContainText('Caisse');
  });

  test('refuse un mot de passe faible ou mal confirmé', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Créer un compte' }).click();
    await page.getByLabel('Votre nom').fill('X');
    await page.getByLabel('E-mail').fill(uniqueEmail());
    await page.locator('input[name=password]').fill('abc');
    await page.locator('input[name=confirm]').fill('abc');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByRole('alert')).toContainText('au moins 8 caractères');
    await page.locator('input[name=password]').fill('Bonmotdepasse1');
    await page.locator('input[name=confirm]').fill('Bonmotdepasse2');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByRole('alert')).toContainText('pas identiques');
  });

  test('refuse un e-mail déjà inscrit', async ({ page }) => {
    const email = await signUp(page);
    await page.getByRole('button', { name: 'Se déconnecter' }).first().click();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await signUp(page, { email, expect: null });
    await expect(page.getByRole('alert')).toContainText('existe déjà');
  });

  test('déconnexion, mauvais mot de passe, puis reconnexion avec les données conservées', async ({ page }) => {
    const email = await signUp(page);
    await addOperation(page, { type: 'Revenu', amount: 500, category: 'Salaire' });
    await page.getByRole('button', { name: 'Se déconnecter' }).first().click();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();

    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Mot de passe').fill('mauvais123');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toContainText('incorrect');

    await page.getByLabel('Mot de passe').fill(PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(capValue(page)).toHaveText(/500,00/);
  });

  test('la session reste ouverte après rechargement', async ({ page }) => {
    await signUp(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
  });

  test('confirmation par e-mail quand Supabase l’exige', async ({ page }) => {
    await useFakeBackend(page, { confirmEmail: true });
    const email = await signUp(page, { expect: null });
    await expect(page.getByRole('heading', { name: 'Vérifiez votre e-mail' })).toBeVisible();
    await expect(page.locator('.auth-card')).toContainText(email);
  });

  test('le lien « mot de passe oublié » ouvre l’écran Nouveau mot de passe puis l’appli', async ({ page }) => {
    await signUp(page);
    // Nouvelle page complète, comme un clic depuis l'e-mail (pas un simple changement de #)
    await page.goto('/index.html#access_token=x&refresh_token=y&expires_in=3600&token_type=bearer&type=recovery');
    await expect(page.getByRole('heading', { name: 'Nouveau mot de passe' })).toBeVisible({ timeout: 5000 });
    await page.locator('input[name=password]').fill('Nouveau2026ok');
    await page.locator('input[name=confirm]').fill('Nouveau2026ok');
    await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
    expect(page.url()).not.toContain('access_token');
  });

  test('si le serveur ne répond pas, l’appli ne reste pas figée sur le chargement', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('__fake_sb_hang', '1'));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible({ timeout: 12000 });
    await expect(page.getByRole('alert')).toContainText('prend trop de temps');
  });

  test('le bouton œil affiche puis masque le mot de passe', async ({ page }) => {
    await page.goto('/?inscription');
    const pwd = page.locator('input[name=password]');
    await pwd.fill('Secret2026');
    await expect(pwd).toHaveAttribute('type', 'password');
    const eye = page.locator('input[name=password] + .pwd-toggle');
    await eye.click();
    await expect(pwd).toHaveAttribute('type', 'text');
    await expect(eye).toHaveAttribute('aria-label', 'Cacher la saisie');
    await expect(pwd).toHaveValue('Secret2026');
    await eye.click();
    await expect(pwd).toHaveAttribute('type', 'password');
    // Chaque champ a son propre bouton (inscription : mot de passe + confirmation)
    await expect(page.locator('.pwd-toggle')).toHaveCount(2);
    // Le bouton n'envoie pas le formulaire
    await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible();
  });

  test('le lien ?inscription ouvre directement « Créer un compte »', async ({ page }) => {
    await page.goto('/?inscription');
    await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible();
  });

  test('mot de passe oublié envoie un lien', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
    await page.getByLabel('E-mail').fill('quelquun@cap75.test');
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();
    await expect(page.getByRole('alert')).toContainText('lien de réinitialisation');
  });
});

test.describe('Opérations et règle 75/15/10', () => {
  test('ajouter, modifier, dupliquer et supprimer des opérations', async ({ page }) => {
    await signUp(page);
    await addOperation(page, { type: 'Revenu', amount: 1000, category: 'Salaire' });
    await addOperation(page, { type: 'Dépense', amount: 700, category: 'Loyer' });
    await addOperation(page, { type: 'Épargne', amount: 100, category: 'Épargne mensuelle' });

    await expect(capValue(page)).toHaveText(/200,00/);
    await expect(page.locator('.cap-verdict')).toHaveText('Cap tenu ce mois-ci');

    // Dépassement : 900 de dépenses sur 1000 de revenus
    await addOperation(page, { type: 'Dépense', amount: 200, category: 'Transport' });
    await expect(page.locator('.cap-verdict')).toContainText('Dépenses trop hautes');

    await page.getByRole('button', { name: 'Opérations', exact: true }).first().click();
    const row = page.locator('tbody tr', { hasText: 'Transport' });
    await row.getByRole('button', { name: 'Modifier' }).click();
    await page.getByRole('dialog').getByLabel('Montant').fill('50');
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(row).toContainText('50,00');

    await row.getByRole('button', { name: 'Dupliquer' }).click();
    await page.getByRole('dialog').getByRole('button', { name: "Ajouter l'opération" }).click();
    await expect(page.locator('tbody tr', { hasText: 'Transport' })).toHaveCount(2);

    await page.locator('tbody tr', { hasText: 'Transport' }).first().getByRole('button', { name: 'Supprimer' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.locator('tbody tr', { hasText: 'Transport' })).toHaveCount(1);
  });

  test('filtrer et rechercher les opérations', async ({ page }) => {
    await signUp(page);
    await addOperation(page, { type: 'Revenu', amount: 1000, category: 'Salaire' });
    await addOperation(page, { type: 'Dépense', amount: 40, category: 'Pharmacie' });
    await page.getByRole('button', { name: 'Opérations', exact: true }).first().click();
    await page.getByLabel('Type').selectOption('Dépense');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Type').selectOption('ALL');
    await page.getByLabel('Rechercher').fill('pharma');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr')).toContainText('Pharmacie');
  });

  test('le formulaire refuse un montant vide', async ({ page }) => {
    await signUp(page);
    await page.getByRole('button', { name: 'Nouvelle opération' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: "Ajouter l'opération" }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('supérieur à 0');
  });

  test('navigation par mois', async ({ page }) => {
    await signUp(page);
    await addOperation(page, { type: 'Revenu', amount: 300, category: 'Vente', date: monthsAgo(1, 10) });
    await expect(capValue(page)).toHaveText(/300,00/);
    await page.getByRole('button', { name: 'Mois suivant' }).click();
    await expect(capValue(page)).toHaveText(/0,00/);
    await expect(page.locator('.stat.rev .delta')).toContainText('−100 %');
  });
});

test.describe('Comptes et devises', () => {
  test('compte M-Pesa en francs congolais et transfert depuis la caisse', async ({ page }) => {
    await signUp(page);
    await addOperation(page, { type: 'Revenu', amount: 200, category: 'Salaire' });
    await page.getByRole('button', { name: 'Comptes', exact: true }).first().click();
    await page.getByRole('button', { name: 'Ajouter un compte' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Nom du compte').fill('M-Pesa');
    await d.getByLabel('Type').selectOption('mobile');
    await d.getByLabel('Devise').selectOption('CDF');
    await d.getByLabel('Solde de départ').fill('28500');
    await d.getByRole('button', { name: 'Ajouter le compte' }).click();

    await addOperation(page, { type: 'Transfert', amount: 50, account: 'Caisse (USD)', toAccount: 'M-Pesa (CDF)' });
    const mpesa = page.locator('.account', { hasText: 'M-Pesa' });
    await expect(mpesa.locator('.balance')).toHaveText(/171\s?000 FC/);
    await expect(page.locator('.account', { hasText: 'Caisse' }).locator('.balance')).toHaveText(/150,00 \$/);
    // Avoir total : 150 $ + 171 000 FC / 2850 = 210 $
    await expect(page.locator('.stat.accent .value')).toHaveText(/210,00 \$/);
  });

  test('un compte avec des opérations est archivé au lieu d’être supprimé', async ({ page }) => {
    await signUp(page);
    await page.getByRole('button', { name: 'Comptes', exact: true }).first().click();
    await page.getByRole('button', { name: 'Ajouter un compte' }).click();
    await page.getByRole('dialog').getByLabel('Nom du compte').fill('Banque');
    await page.getByRole('dialog').getByRole('button', { name: 'Ajouter le compte' }).click();
    await addOperation(page, { type: 'Revenu', amount: 10, account: 'Banque (USD)' });
    await page.getByRole('button', { name: 'Supprimer Banque' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Archiver le compte' }).click();
    await expect(page.getByRole('heading', { name: 'Comptes archivés' })).toBeVisible();
  });

  test('changer la devise principale en francs congolais', async ({ page }) => {
    await signUp(page);
    await addOperation(page, { type: 'Revenu', amount: 100, category: 'Salaire' });
    await page.getByRole('button', { name: 'Paramètres' }).first().click();
    await page.getByLabel('Devise principale').selectOption('CDF');
    await page.getByLabel('1 USD = … CDF').fill('2800');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await page.getByRole('button', { name: 'Tableau de bord' }).first().click();
    await expect(capValue(page)).toHaveText(/280\s?000 FC/);
  });
});

test.describe('Récurrences', () => {
  test('les échéances passées sont créées automatiquement, sans doublon', async ({ page }) => {
    await signUp(page);
    await page.getByRole('button', { name: 'Récurrences' }).first().click();
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    const d = page.getByRole('dialog');
    await d.locator('label[for="rt-Dépense"]').click();
    await d.getByLabel('Montant').fill('300');
    await d.getByLabel('Catégorie').fill('Loyer');
    await d.getByLabel('Première date').fill(monthsAgo(2, 1));
    await d.getByRole('button', { name: 'Ajouter la récurrence' }).click();
    await expect(page.locator('.toast').last()).toContainText('3 opération(s) ajoutée(s)');

    await page.reload();
    await page.getByRole('button', { name: 'Opérations', exact: true }).first().click();
    await page.getByLabel('Tous les mois').check();
    await expect(page.locator('tbody tr', { hasText: 'Loyer' })).toHaveCount(3);
  });

  test('« Répéter automatiquement » depuis une opération, puis pause', async ({ page }) => {
    await signUp(page);
    await addOperation(page, { type: 'Revenu', amount: 900, category: 'Salaire', repeat: true });
    await page.getByRole('button', { name: 'Récurrences' }).first().click();
    const item = page.locator('.list-item', { hasText: 'Salaire' });
    await expect(item).toContainText('Prochaine');
    await item.getByRole('button', { name: 'Mettre en pause' }).click();
    await expect(page.locator('.list-item', { hasText: 'Salaire' })).toContainText('En pause');
  });
});

test.describe('Projets', () => {
  test('créer un projet et l’alimenter', async ({ page }) => {
    await signUp(page);
    await page.getByRole('button', { name: 'Projets' }).first().click();
    await page.getByRole('button', { name: 'Nouveau projet' }).first().click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Nom du projet').fill('Moto');
    await d.getByLabel(/Objectif/).fill('1000');
    await d.getByLabel('Déjà réuni avant Cap75').fill('200');
    await d.getByRole('button', { name: 'Créer le projet' }).click();
    await expect(page.locator('.project')).toContainText('20 %');

    await page.getByRole('button', { name: 'Alimenter ce projet' }).click();
    const c = page.getByRole('dialog');
    await c.getByLabel('Montant').fill('300');
    await c.getByRole('button', { name: "Ajouter l'opération" }).click();
    await expect(page.locator('.project')).toContainText('50 %');
    await expect(page.locator('.project')).toContainText('500,00 $');
  });
});

test.describe('Rapports, exports et import', () => {
  test('graphique, export CSV et sauvegarde JSON', async ({ page }) => {
    await signUp(page);
    await addOperation(page, { type: 'Revenu', amount: 1000, category: 'Salaire' });
    await addOperation(page, { type: 'Dépense', amount: 250, category: 'Loyer' });
    await page.getByRole('button', { name: 'Rapports' }).first().click();
    await expect(page.locator('#history-chart')).toBeVisible();
    await expect(page.locator('.bars').first()).toContainText('Loyer');

    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV du mois' }).click()]);
    expect(csv.suggestedFilename()).toMatch(/^cap75-operations-\d{4}-\d{2}\.csv$/);

    await page.getByRole('button', { name: 'Paramètres' }).first().click();
    const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Télécharger une sauvegarde' }).click()]);
    expect(json.suggestedFilename()).toMatch(/^cap75-sauvegarde-.*\.json$/);
  });

  test('importer un ancien carnet DOXTEHAD (JSON v1/v2)', async ({ page }) => {
    await signUp(page);
    await page.getByRole('button', { name: 'Paramètres' }).first().click();
    const legacy = {
      operations: [
        { id: 'op_1', type: 'Revenu', category: 'Salaire', amount: 800, date: today() },
        { id: 'op_2', type: 'Dépense', category: 'Œuvre & frais', amount: 200, date: today() }
      ],
      projects: [{ id: 'proj_1', title: 'Terrain', target: 5000, saved: 1000, deadline: '2028-01-01', status: 'En cours' }]
    };
    await page.locator('input[type=file]').setInputFiles({ name: 'ancien.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
    await expect(page.getByRole('dialog')).toContainText('2 opération(s) et 1 projet(s)');
    await page.getByRole('dialog').getByRole('button', { name: 'Importer' }).click();
    await page.getByRole('button', { name: 'Tableau de bord' }).first().click();
    await expect(capValue(page)).toHaveText(/600,00/);
    await page.getByRole('button', { name: 'Opérations', exact: true }).first().click();
    await expect(page.locator('tbody')).toContainText('Œuvre & frais');
  });

  test('règle budgétaire personnalisée', async ({ page }) => {
    await signUp(page);
    await page.getByRole('button', { name: 'Paramètres' }).first().click();
    await page.getByLabel('Dépenses max (%)').fill('80');
    await expect(page.locator('#rules-sum')).toContainText('dépasse 100 %');
    await page.getByLabel('Épargne min (%)').fill('5');
    await page.getByRole('button', { name: 'Enregistrer la règle' }).click();
    await page.getByRole('button', { name: 'Tableau de bord' }).first().click();
    await expect(page.locator('.cap-scale')).toContainText('80 %');
  });
});

test.describe('Hors ligne', () => {
  test('les saisies hors ligne sont gardées puis envoyées au retour du réseau', async ({ page }) => {
    await signUp(page);
    await page.evaluate(() => {
      window.__fakeOffline = true;
    });
    await addOperation(page, { type: 'Revenu', amount: 75, category: 'Vente' });
    await expect(page.locator('#sync-badge')).toContainText('à envoyer');
    await expect(capValue(page)).toHaveText(/75,00/);
    await page.evaluate(() => {
      window.__fakeOffline = false;
      window.dispatchEvent(new Event('online'));
    });
    await expect(page.locator('#sync-badge')).toHaveText('Synchronisé');
    await page.reload();
    await expect(capValue(page)).toHaveText(/75,00/);
  });
});

test.describe('Mobile @mobile', () => {
  test('barre d’onglets, menu Plus et bouton d’ajout @mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Vue mobile uniquement');
    await signUp(page);
    await expect(page.locator('.tabbar')).toBeVisible();
    await page.locator('.tabbar').getByRole('button', { name: 'Plus' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Récurrences' }).click();
    await expect(page.getByRole('heading', { name: 'Récurrences' })).toBeVisible();
    await page.locator('.topbar .btn-accent').click();
    await expect(page.getByRole('dialog')).toContainText('Nouvelle opération');
  });
});

test.describe('Sécurité du navigateur', () => {
  test('la politique CSP est active et ne bloque rien dans l’appli', async ({ page }) => {
    const violations = [];
    page.on('console', (msg) => {
      if (/Content Security Policy|Refused to/i.test(msg.text())) violations.push(msg.text());
    });
    await signUp(page);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    await addOperation(page, { type: 'Revenu', amount: 10, category: 'CSP' });
    for (const view of ['Comptes', 'Récurrences', 'Projets', 'Rapports', 'Paramètres']) {
      await page.locator('.sidebar').getByRole('button', { name: view }).click();
    }
    expect(violations).toEqual([]);
  });

  test('un script injecté dans une catégorie reste du texte', async ({ page }) => {
    await signUp(page);
    await addOperation(page, { type: 'Dépense', amount: 5, category: '<img src=x onerror="window.__pwned=1">' });
    await page.getByRole('button', { name: 'Opérations', exact: true }).first().click();
    await expect(page.locator('tbody')).toContainText('<img src=x');
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
});

test('les montants restent lisibles (pas de NaN ni undefined)', async ({ page }) => {
  await signUp(page);
  await addOperation(page, { type: 'Revenu', amount: 10, category: 'Test' });
  for (const view of ['Tableau de bord', 'Comptes', 'Récurrences', 'Projets', 'Rapports', 'Paramètres']) {
    await page.locator('.sidebar').getByRole('button', { name: view }).click();
    const text = money(await page.locator('#view').innerText());
    expect(text).not.toMatch(/NaN|undefined|\[object/);
  }
});
