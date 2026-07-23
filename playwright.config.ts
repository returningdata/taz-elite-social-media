import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL: 'http://localhost:8889',
    headless: true,
    contextOptions: { reducedMotion: 'reduce' }
  },
  reporter: [['list']]
});
