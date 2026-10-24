import { defineConfig, devices } from '@playwright/test';

// Separate ports and database from `npm run dev`, so tests never run against demo data.
const API_PORT = 3101;
const WEB_PORT = 5174;
const baseURL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Seeds a fresh test database, then starts the API on it.
      command: 'npm run seed && npm start',
      cwd: '../backend',
      env: { PORT: String(API_PORT), DATABASE_PATH: 'data/e2e.db' },
      url: `http://localhost:${API_PORT}/api/ideas`,
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      env: { PORT: String(API_PORT) },
      url: baseURL,
      reuseExistingServer: false,
    },
  ],
});
