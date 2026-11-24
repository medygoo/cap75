import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const fakeSupabase = readFileSync(resolve(here, '../fake-supabase.js'), 'utf8');
const testConfig = "window.CAP75_CONFIG = { supabaseUrl: 'https://test.local', supabaseAnonKey: 'test' };";

export const PASSWORD = 'Cap75test2026';

// Remplace la bibliothèque Supabase et la config par la fausse base de test
export async function useFakeBackend(page, opts = {}) {
  await page.route('**/js/vendor/supabase.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: fakeSupabase })
  );
  await page.route('**/js/config.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: testConfig })
  );
  if (opts.confirmEmail) {
    await page.addInitScript(() => localStorage.setItem('__fake_sb_confirm', '1'));
  }
}

export function uniqueEmail() {
  return `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@cap75.test`;
}

// expect : 'dashboard' (attend l'entrée dans l'appli) ou null (le test vérifie lui-même la suite)
export async function signUp(page, { name = 'Test Cap75', email = uniqueEmail(), expect = 'dashboard' } = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await page.getByLabel('Votre nom').fill(name);
  await page.getByLabel('E-mail').fill(email);
  await page.locator('input[name=password]').fill(PASSWORD);
  await page.locator('input[name=confirm]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  if (expect === 'dashboard') {
    await page.locator('#sync-badge').waitFor({ state: 'attached', timeout: 15000 });
  }
  return email;
}

// Ajoute une opération via le formulaire
export async function addOperation(page, { type = 'Dépense', amount, category, currency, account, toAccount, project, date, repeat }) {
  await page.locator('.topbar').getByRole('button', { name: 'Nouvelle opération' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator(`label[for="t-${type}"]`).click();
  await dialog.getByLabel('Montant').fill(String(amount));
  if (currency) await dialog.getByLabel('Devise').selectOption(currency);
  if (account) await dialog.locator('select[name=account_id]').selectOption({ label: account });
  if (toAccount) await dialog.locator('select[name=to_account_id]').selectOption({ label: toAccount });
  if (project) await dialog.locator('select[name=project_id]').selectOption({ label: project });
  if (category) await dialog.getByLabel('Catégorie').fill(category);
  if (date) await dialog.getByLabel('Date').fill(date);
  if (repeat) await dialog.getByLabel('Répéter automatiquement').check();
  await dialog.getByRole('button', { name: "Ajouter l'opération" }).click();
  await dialog.waitFor({ state: 'detached' });
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthsAgo(n, day = 1) {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth() - n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

// Normalise les espaces insécables des montants formatés en français
export const money = (s) => s.replace(/[  ]/g, ' ');
