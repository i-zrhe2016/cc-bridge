import { expect, test } from '@playwright/test';
import translations from '../src/features/landing/translations.json';

test('Google authentication fails clearly when credentials are missing', async ({ page, request }) => {
  await page.goto('/auth/sign-in');
  await expect(page).toHaveTitle('登录 | CC Bridge');
  await expect(page.getByRole('heading', { name: '欢迎使用 CC Bridge' })).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '使用 Google 继续' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('Google 登录尚未配置');
  expect((await request.post('/api/auth/sign-in/social', { data: { provider: 'google' } })).status()).toBe(410);
  expect(await page.context().cookies()).toEqual([]);
});

test('all registration and template authentication URLs use the shared entry', async ({ request }) => {
  for (const path of ['/auth', '/auth/sign-up', '/auth/sign-up/verify-email-address', '/sign-in', '/sign-in/callback', '/sign-up', '/sign-up/verify-email-address']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers().location, path).toMatch(/\/auth\/sign-in$/);
  }
  const login = await request.get('/auth/sign-in');
  expect(login.status()).toBe(200);
  expect(await login.text()).toContain('欢迎使用 CC Bridge');
});

test('old dashboard and example APIs have been removed', async ({ request }) => {
  for (const path of ['/dashboard/overview', '/dashboard/profile', '/api/products', '/api/users']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const response = await request.fetch('/api/products', { method, data: { title: 'must not be created' } });
    expect(response.status()).toBe(404);
  }
});

test('homepage retains all languages, saved preference, anchors and authentication links', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const selector = page.locator('#language');
  await expect(selector).toHaveValue('zh-Hans');
  for (const [language, content] of Object.entries(translations)) {
    await selector.selectOption(language);
    await expect(page.locator('h1')).toHaveText(`${content[5]}${content[6]}`);
    await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  }
  await page.reload();
  await expect(selector).toHaveValue('ko');
  await selector.selectOption('zh-Hans');
  await expect(page.getByRole('link', { name: '接入指南' })).toHaveAttribute('href', '#start');
  await page.getByRole('link', { name: '接入指南' }).click();
  await expect(page).toHaveURL('/#start');
  await expect(page.locator('#start')).toBeInViewport();
  expect(await page.locator('a[href="/auth/sign-in"]').count()).toBe(4);
  await page.getByRole('link', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎使用 CC Bridge' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await page.getByRole('link', { name: '返回首页' }).click();
  await expect(page).toHaveURL('/');
  expect(errors).toEqual([]);
});

test('configuration copy and clipboard fallback both remain usable', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const copy = page.locator('#copy');
  await copy.click();
  await expect(copy).toHaveText('已复制 ✓');
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('ANTHROPIC_BASE_URL="https://your-gateway.example"');
  expect(clipboard).toContain('ANTHROPIC_AUTH_TOKEN="your-api-key"');
  expect(clipboard).toContain('ANTHROPIC_MODEL="your-gpt-model"');
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: () => Promise.reject(new Error('Clipboard unavailable')),
    });
  });
  await copy.click();
  await expect(page.getByRole('status')).toHaveText('已选中配置，请手动复制');
  expect(await page.evaluate(() => window.getSelection()?.toString())).toContain(
    'ANTHROPIC_BASE_URL=',
  );
});

for (const width of [375, 768, 1440]) {
  test(`public pages fit ${width}px and preserve the appropriate layout`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/auth/sign-in');
    await expect(page.getByRole('button', { name: '使用 Google 继续' })).toBeVisible();
    await expect(page.getByRole('region', { name: '欢迎使用 CC Bridge' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/sign-in-${width}.png`, fullPage: true });
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('link', { name: '登录', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
    if (width < 1024) {
      await page.getByRole('link', { name: '登录', exact: true }).click();
      await expect(page).toHaveURL('/auth/sign-in');
    }
  });
}
