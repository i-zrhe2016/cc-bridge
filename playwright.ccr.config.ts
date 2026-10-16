import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'ccr-integration.spec.ts',
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3110', locale: 'zh-CN', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node e2e/fixtures/ccr-server.mjs', url: 'http://127.0.0.1:3471', timeout: 90_000, reuseExistingServer: false },
    {
      command: 'bun run start --hostname 127.0.0.1 --port 3110',
      url: 'http://127.0.0.1:3110/dashboard',
      reuseExistingServer: false,
      env: {
        CCR_MANAGEMENT_URL: 'http://127.0.0.1:3468',
        CCR_GATEWAY_URL: 'http://127.0.0.1:3466',
        CCR_WEB_AUTH_TOKEN: 'integration-only-ccr-management-token',
        CC_BRIDGE_ADMIN_TOKEN: 'integration-only-workspace-admin-token',
        CC_BRIDGE_PUBLIC_URL: 'http://127.0.0.1:3110',
      },
    },
  ],
});
