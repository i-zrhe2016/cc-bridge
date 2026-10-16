import { expect, test } from '@playwright/test';

test.skip(({ baseURL }) => baseURL !== 'http://127.0.0.1:3100', 'Demo mode only');
test('admin stays disabled without an independent operations token', async ({ page, request }) => {
  await page.goto('/admin/providers');
  await expect(page).toHaveURL('/admin/login');
  await expect(page.getByText(/管理后台尚未启用/)).toBeVisible();
  await expect(page.getByLabel('后台管理口令')).toHaveCount(0);
  expect((await request.get('/api/admin/providers')).status()).toBe(503);
  expect((await request.post('/api/admin/session', { headers: { Origin: 'http://127.0.0.1:3100' }, data: { token: 'incorrect' } })).status()).toBe(503);
});
