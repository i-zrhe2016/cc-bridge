import { expect, test } from '@playwright/test';
import translations from '../src/features/landing/translations.json';

test('public Google entry works without Clerk and never starts an OAuth request', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/auth/sign-in');
  await expect(page).toHaveTitle('登录 | CC Bridge');
  await expect(page.getByRole('heading', { name: '欢迎使用 CC Bridge' })).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
  await expect(page.locator('script[src*="clerk"]')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const button = page.getByRole('button', { name: '使用 Google 继续' });
  await button.click();
  await button.click();
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Google 登录即将开放，请稍后再试。');
  await expect(page.getByRole('status').locator('p')).toHaveCount(1);
  await expect(button).toBeFocused();
  await expect(page).toHaveURL('/auth/sign-in');
  expect(await button.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
  expect(await page.context().cookies()).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('registration and every dashboard entry return to the shared sign-in page', async ({
  request
}) => {
  for (const path of [
    '/auth/sign-up',
    '/auth/sign-up/verify-email-address',
    '/dashboard',
    '/dashboard/overview',
    '/dashboard/profile'
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers().location, path).toMatch(/\/auth\/sign-in$/);
  }
  const login = await request.get('/auth/sign-in');
  expect(login.status()).toBe(200);
  expect(await login.text()).toContain('欢迎使用 CC Bridge');
});

test('unconfigured template APIs refuse reads and mutations', async ({ request }) => {
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const response = await request.fetch('/api/products', {
      method,
      data: { title: 'must not be created' }
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({ error: 'Authentication is not configured.' });
  }
});

test('homepage retains all languages, saved preference, anchors and authentication links', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const selector = page.locator('#language');
  await expect(selector).toHaveValue('zh-Hans');
  for (const [language, content] of Object.entries(translations)) {
    await selector.selectOption(language);
    await expect(page.locator('h1')).toHaveText(content[5] + content[6]);
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
      value: () => Promise.reject(new Error('Clipboard unavailable'))
    });
  });
  await copy.click();
  await expect(page.getByRole('status')).toHaveText('已选中配置，请手动复制');
  expect(await page.evaluate(() => window.getSelection()?.toString())).toContain(
    'ANTHROPIC_BASE_URL='
  );
});

for (const width of [375, 768, 1440]) {
  test(`public pages fit ${width}px and preserve the appropriate layout`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/auth/sign-in');
    await expect(page.getByRole('button', { name: '使用 Google 继续' })).toBeVisible();
    const aside = page.getByRole('complementary');
    if (width >= 1024) await expect(aside).toBeVisible();
    else await expect(aside).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({ path: `test-results/sign-in-${width}.png`, fullPage: true });
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('link', { name: '登录', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
    if (width < 1024) {
      await page.getByRole('link', { name: '登录', exact: true }).click();
      await expect(page).toHaveURL('/auth/sign-in');
    }
  });
}
