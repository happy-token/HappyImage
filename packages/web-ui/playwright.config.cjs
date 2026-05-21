const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.cjs/,
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    channel: 'chrome',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'NODE_ENV=production bun run server/index.ts',
    url: 'http://localhost:3100/api/health',
    reuseExistingServer: !process.env.CI,
  },
})
