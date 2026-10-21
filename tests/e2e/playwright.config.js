import { defineConfig, devices } from '@playwright/test'

// Run against the docker-compose stack:  docker compose up -d --build
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,          // orders mutate shared state; keep it deterministic
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /auth\.spec\.js/ },
  ],
})
