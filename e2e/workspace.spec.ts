import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

type Section = '我的 GPT' | '访问密钥' | '使用教程' | '使用统计';
async function selectSection(page: Page, name: Section) {
  const button = page.getByRole('navigation', { name: '工作台导航' }).getByRole('button', { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
}

async function saveConnection(page: Page) {
  await selectSection(page, '我的 GPT');
  await page.getByLabel('名称', { exact: true }).fill('我的测试连接');
  await page.getByLabel('API 地址').fill('https://provider.example/v1');
  await page.getByLabel('GPT 密钥（API Key）', { exact: true }).fill('secret-upstream-never-store');
  await page.getByLabel('模型', { exact: true }).fill('test-gpt');
  await page.getByRole('button', { name: '保存', exact: true }).click();
}

async function generateKey(page: Page) {
  await selectSection(page, '访问密钥');
  await page.getByRole('button', { name: '生成访问密钥' }).click();
}

test('four sections retain drafts and guide users through prerequisites', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('我的 GPT');
  await page.getByLabel('名称', { exact: true }).fill('未保存的草稿');
  await page.getByLabel('GPT 密钥（API Key）', { exact: true }).fill('draft-test-key');
  await selectSection(page, '使用统计');
  await expect(page.getByText('示例数据', { exact: true })).toBeVisible();
  await expect(page.getByLabel('名称', { exact: true })).toBeHidden();
  await selectSection(page, '我的 GPT');
  await expect(page.getByLabel('名称', { exact: true })).toHaveValue('未保存的草稿');
  await expect(page.getByLabel('GPT 密钥（API Key）', { exact: true })).toHaveValue('draft-test-key');
  await selectSection(page, '访问密钥');
  await expect(page.getByRole('button', { name: '生成访问密钥' })).toBeDisabled();
  await page.getByRole('button', { name: '去填写' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('我的 GPT');
  await selectSection(page, '使用教程');
  await page.getByRole('button', { name: '去填写' }).click();
  await saveConnection(page);
  await selectSection(page, '使用教程');
  await page.getByRole('button', { name: '去生成密钥' }).click();
  await page.getByRole('button', { name: '生成访问密钥' }).click();
  await page.getByRole('button', { name: '下一步：查看教程' }).click();
  await expect(page.getByRole('button', { name: '复制命令' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('我的 GPT');
  await expect(page.getByLabel('名称', { exact: true })).toHaveValue('');
});

test('connection, bridge key and configuration form a complete in-memory workflow', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('form [role="alert"]')).toHaveText('请填写名称、API 地址、GPT 密钥、模型。');
  await page.getByLabel('名称', { exact: true }).fill('test');
  await page.getByLabel('GPT 密钥（API Key）', { exact: true }).fill('test');
  await page.getByLabel('模型', { exact: true }).fill('test');
  await page.getByLabel('API 地址').fill('javascript:alert(1)');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('form [role="alert"]')).toContainText('http:// 或 https://');
  await saveConnection(page);
  await expect(page.getByText('已保存，尚未测试', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '下一步：生成密钥' }).click();
  await page.getByRole('button', { name: '生成访问密钥' }).click();
  const firstKey = await page.getByLabel('当前访问密钥').inputValue();
  expect(firstKey).toMatch(/^ccb_demo_/);
  await page.getByRole('button', { name: '下一步：查看教程' }).click();
  const config = page.getByLabel('Claude Code 配置命令');
  await expect(config).toContainText(firstKey);
  await expect(config).not.toContainText('secret-upstream');
  await selectSection(page, '我的 GPT');
  await page.getByRole('button', { name: '编辑' }).click();
  await expect(page.getByLabel('GPT 密钥（API Key）', { exact: true })).toHaveValue('');
  await page.getByLabel('模型', { exact: true }).fill('model\'$(echo test)');
  await selectSection(page, '使用统计');
  await selectSection(page, '我的 GPT');
  await expect(page.getByLabel('模型', { exact: true })).toHaveValue('model\'$(echo test)');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await selectSection(page, '使用教程');
  await expect(config).toContainText('model\'\\\'\'$(echo test)');
  await selectSection(page, '访问密钥');
  await page.getByRole('button', { name: '更换密钥', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByLabel('当前访问密钥')).toHaveValue(firstKey);
  await page.getByRole('button', { name: '更换密钥', exact: true }).click();
  await page.getByRole('button', { name: '确认更换密钥', exact: true }).click();
  await expect(page.getByLabel('当前访问密钥')).not.toHaveValue(firstKey);
  await selectSection(page, '使用教程');
  await expect(config).not.toContainText(firstKey);
  await selectSection(page, '访问密钥');
  await page.getByRole('button', { name: '停用密钥', exact: true }).click();
  await page.getByRole('button', { name: '确认停用密钥', exact: true }).click();
  await selectSection(page, '使用教程');
  await expect(page.getByRole('button', { name: '复制命令' })).toBeDisabled();
  await generateKey(page);
  await selectSection(page, '我的 GPT');
  await page.getByRole('button', { name: '删除配置', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '编辑' })).toBeVisible();
  await page.getByRole('button', { name: '删除配置', exact: true }).click();
  await page.getByRole('button', { name: '确认删除配置', exact: true }).click();
  await selectSection(page, '访问密钥');
  await expect(page.getByRole('button', { name: '生成访问密钥' })).toBeDisabled();
  await selectSection(page, '使用教程');
  await expect(config).not.toContainText('ANTHROPIC_AUTH_TOKEN');
});

test('secrets cause no requests or persistence; copy supports clipboard and fallback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await saveConnection(page);
  await generateKey(page);
  await selectSection(page, '使用教程');
  await page.getByRole('button', { name: '复制命令' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('ccb_demo_');
  await expect(page.getByRole('status')).toHaveText('已复制');
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new Error('unavailable')) }));
  await page.getByRole('button', { name: '复制命令' }).click();
  await expect(page.getByRole('status')).toHaveText('内容已选中，请手动复制。');
  expect(await page.evaluate(() => window.getSelection()?.toString())).toContain('ANTHROPIC_MODEL');
  await selectSection(page, '访问密钥');
  await page.getByRole('button', { name: '复制密钥', exact: true }).click();
  await expect(page.getByLabel('当前访问密钥')).toHaveAttribute('type', 'text');
  expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))).toEqual({ local: [], session: [] });
  expect(await context.cookies()).toEqual([]);
  expect(requests).toEqual([]);
  await page.reload();
  await expect(page.getByLabel('名称', { exact: true })).toHaveValue('');
});

for (const width of [375, 768, 1440, 1920]) {
  test(`workspace sections fit ${width}px with CC Bridge branding`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/dashboard');
    const nav = page.getByRole('navigation', { name: '工作台导航' });
    await expect(nav.getByRole('button')).toHaveCount(4);
    await expect(page.locator('.demo-note')).toHaveText('演示版：请使用测试密钥。刷新后数据会清空，生成的密钥和命令暂不能实际使用。');
    await expect(page.getByText('交互演示', { exact: true })).toHaveCount(0);
    await saveConnection(page);
    await generateKey(page);
    for (const name of ['我的 GPT', '访问密钥', '使用教程', '使用统计'] as const) {
      await selectSection(page, name);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('region')).toHaveCount(1);
      await page.screenshot({ path: `test-results/workspace-${width}-${name}.png`, fullPage: true });
    }
    await expect(page.locator('body')).not.toContainText(/musistudio|claude-code-router|CCR|Apptension/);
    const selected = nav.getByRole('button', { name: '使用统计', exact: true });
    await selected.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(nav.getByRole('button', { name: '使用教程', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
}

test('homepage offers a localized workspace entry', async ({ page }) => {
  await page.goto('/');
  await page.locator('#language').selectOption('en');
  await expect(page.getByRole('link', { name: 'Try workspace' })).toHaveAttribute('href', '/dashboard');
  await page.locator('#language').selectOption('zh-Hans');
  await page.getByRole('link', { name: '体验工作台' }).click();
  await expect(page).toHaveURL('/dashboard');
});
