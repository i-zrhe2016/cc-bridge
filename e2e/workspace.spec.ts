import { expect, test } from '@playwright/test';

test('unconfigured workspace never exposes an unauthenticated demo', async ({ page, request }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('alert').filter({ hasText: 'Google 登录尚未配置' })).toContainText('Google 登录尚未配置');
  await expect(page.locator('input')).toHaveCount(0);
  expect((await request.get('/api/workspace')).status()).toBe(503);
  expect((await request.post('/api/workspace/session', { data: { token: 'old-password' } })).status()).toBe(410);
});
