import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    locale: 'zh-CN',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun run start --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/auth/sign-in',
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: '',
      NEXT_PUBLIC_SENTRY_DSN: '',
      NEXT_PUBLIC_SENTRY_DISABLED: 'true'
    }
  }
});
