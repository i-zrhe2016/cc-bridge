import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['ccr-integration.spec.ts', 'admin-integration.spec.ts', 'google-auth.spec.ts'],
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3110', locale: 'zh-CN', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/fixtures/auth-server.mjs',
      url: 'http://localhost:3110/dashboard',
      reuseExistingServer: false,
      env: {
        CC_BRIDGE_UPSTREAM_ORIGINS: 'http://127.0.0.1:3470',
        CCR_MANAGEMENT_URL: 'http://127.0.0.1:3468',
        CCR_GATEWAY_URL: 'http://127.0.0.1:3466',
        CCR_WEB_AUTH_TOKEN: 'integration-only-ccr-management-token',
        CC_BRIDGE_ADMIN_TOKEN: 'integration-only-workspace-admin-token',
        CC_BRIDGE_OPERATIONS_TOKEN: 'integration-only-operations-admin-token',
        CC_BRIDGE_PUBLIC_URL: 'http://localhost:3110',
      },
    },
  ],
});
