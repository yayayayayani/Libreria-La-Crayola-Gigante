import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5179', channel: 'msedge', headless: true },
  webServer: {
    command: 'npm.cmd run dev -- --host 127.0.0.1 --port 5179 --strictPort',
    url: 'http://127.0.0.1:5179',
    env: { VITE_API_URL: 'http://127.0.0.1:5179/api' },
    reuseExistingServer: false
  }
});
