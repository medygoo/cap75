import { defineConfig, devices } from '@playwright/test';

// Les tests remplacent Supabase par tests/fake-supabase.js (voir tests/e2e/helpers.js) :
// ils vérifient toute l'interface sans toucher à la vraie base.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8090',
    locale: 'fr-FR',
    timezoneId: 'Africa/Kinshasa',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] }, grep: /@mobile/ }
  ],
  webServer: {
    command: 'npx http-server . -p 8090 -c-1 -s',
    url: 'http://localhost:8090',
    reuseExistingServer: !process.env.CI
  }
});
