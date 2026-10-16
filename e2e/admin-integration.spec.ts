import type { APIRequestContext } from '@playwright/test';
import { expect as baseExpect, test } from '@playwright/test';

test.skip(({ baseURL }) => baseURL !== 'http://127.0.0.1:3110', 'Run with bun run test:ccr');
test.setTimeout(240_000);
test.use({ actionTimeout: 20_000 });
const expect = baseExpect.configure({ timeout: 20_000 });

const origin = 'http://127.0.0.1:3110';
const operationsToken = 'integration-only-operations-admin-token';

async function rpc(request: APIRequestContext, method: string, args: unknown[] = []) {
  const response = await request.post('http://127.0.0.1:3468/api/ccr/rpc', { headers: { 'x-ccr-web-auth': 'integration-only-ccr-management-token' }, data: { method, args } });
  expect(response.status()).toBe(200);
  return (await response.json()).value;
}

test('independent admin manages providers, keys, usage and gateway without breaking workspace', async ({ page, request, browser }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const original = await rpc(request, 'getConfig');
  const seed = await rpc(request, 'getConfig');
  seed.Providers.push({ id: 'cc-bridge-workspace', name: 'Workspace GPT', type: 'openai_chat_completions', protocolDetectionMode: 'manual', api_base_url: 'http://127.0.0.1:3470/v1', api_key: 'workspace-upstream-secret', models: ['test-gpt'], enabled: true, extraHeaders: { 'x-test-preserved': 'keep-me' } });
  seed.Providers.push({ id: 'foreign-provider', name: 'Foreign', type: 'anthropic', api_base_url: 'https://example.invalid/v1', api_key: 'foreign-upstream-secret', models: ['foreign-model'], enabled: false });
  await rpc(request, 'saveConfig', [seed, { applyProfile: false }]);
  await rpc(request, 'saveApiKeys', [[...seed.APIKEYS, { id: 'cc-bridge-workspace-key', name: 'Workspace', key: 'workspace-client-secret', createdAt: new Date().toISOString() }]]);
  try {
    await page.goto('/admin/providers');
    await expect(page).toHaveURL('/admin/login');
    expect((await request.get('/api/admin/providers')).status()).toBe(401);
    expect((await request.post('/api/admin/providers', { headers: { Origin: origin }, data: { action: 'delete' } })).status()).toBe(401);
    expect((await request.post('/api/admin/session', { headers: { Origin: origin }, data: { token: 'integration-only-workspace-admin-token' } })).status()).toBe(401);
    expect((await request.post('/api/admin/session', { headers: { Origin: 'https://evil.example' }, data: { token: operationsToken } })).status()).toBe(403);
    await page.getByLabel('后台管理口令').fill(operationsToken);
    await page.getByRole('button', { name: '登录管理后台', exact: true }).click();
    await expect(page).toHaveURL('/admin');
    await expect(page.getByRole('heading', { name: '概览', exact: true })).toBeVisible();
    const authenticated = page.context().request;
    expect((await authenticated.get('/api/workspace')).status()).toBe(401);
    const cookies = await page.context().cookies();
    const session = cookies.find(cookie => cookie.name === 'cc_bridge_operations');
    expect(session).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' });
    const other = await browser.newContext();
    await other.addCookies([{ ...session!, name: 'cc_bridge_workspace', path: '/api/workspace' }]);
    expect((await other.request.get(`${origin}/api/workspace`)).status()).toBe(401);
    await other.close();

    await page.getByRole('navigation', { name: '管理后台导航' }).getByRole('link', { name: '上游连接', exact: true }).click();
    await expect(page.getByText('Workspace GPT', { exact: true })).toBeVisible();
    const safe = await authenticated.get('/api/admin/providers');
    expect(await safe.text()).not.toMatch(/workspace-upstream-secret|foreign-upstream-secret|configRevision|integration-only/);
    const providers = await safe.json();
    expect((await authenticated.post('/api/admin/providers', { headers: { Origin: 'https://evil.example' }, data: { action: 'delete', id: 'foreign-provider', revision: providers.revision } })).status()).toBe(403);
    expect((await authenticated.post('/api/admin/providers', { headers: { Origin: origin }, data: { action: 'delete', id: 'cc-bridge-workspace', revision: providers.revision } })).status()).toBe(400);
    expect((await authenticated.post('/api/admin/providers', { headers: { Origin: origin }, data: { action: 'toggle', id: 'cc-bridge-workspace', enabled: false, revision: providers.revision } })).status()).toBe(400);

    await page.getByRole('button', { name: '新增连接', exact: true }).click();
    await page.getByLabel('连接名称', { exact: true }).fill('Admin GPT');
    await page.getByLabel('API 地址', { exact: true }).fill('http://127.0.0.1:3470/v1');
    await page.getByLabel('API Key', { exact: true }).fill('admin-upstream-secret');
    await page.getByLabel('模型（每行一个）').fill('test-gpt\nother-model');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Admin GPT', { exact: true })).toBeVisible();
    await page.reload();
    const row = page.getByRole('row').filter({ has: page.getByText('Admin GPT', { exact: true }) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(page.getByLabel('连接名称', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('API Key（留空保留原值）')).toHaveValue('');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const config = await rpc(request, 'getConfig');
    expect(config.Providers.find((provider: { name: string }) => provider.name === 'Admin GPT').api_key).toBe('admin-upstream-secret');
    expect(config.Providers.find((provider: { id: string }) => provider.id === 'cc-bridge-workspace').extraHeaders).toEqual({ 'x-test-preserved': 'keep-me' });
    const stale = await (await authenticated.get('/api/admin/providers')).json();
    config.Providers.find((provider: { name: string }) => provider.name === 'Admin GPT').models = ['test-gpt'];
    await rpc(request, 'saveConfig', [config, { applyProfile: false }]);
    const id = stale.providers.find((provider: { name: string }) => provider.name === 'Admin GPT').id;
    expect((await authenticated.post('/api/admin/providers', { headers: { Origin: origin }, data: { action: 'toggle', id, enabled: false, revision: stale.revision } })).status()).toBe(409);
    await page.getByRole('button', { name: '刷新', exact: true }).click();
    await row.getByRole('button', { name: '停用', exact: true }).click();
    await page.getByRole('button', { name: '确认停用连接', exact: true }).click();
    await expect(row.getByText('已停用', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: '启用', exact: true }).click();
    await page.getByRole('button', { name: '确认启用连接', exact: true }).click();
    await expect(row.getByText('已启用', { exact: true })).toBeVisible();

    await page.getByRole('navigation', { name: '管理后台导航' }).getByRole('link', { name: '访问密钥', exact: true }).click();
    await expect(page.getByText('Workspace', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '新建密钥', exact: true }).click();
    await page.getByLabel('密钥名称', { exact: true }).fill('Admin client');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const secret = page.getByLabel('新访问密钥');
    await expect(secret).toBeVisible();
    const first = await secret.inputValue();
    expect(first).toMatch(/^ccb_[a-f0-9]{64}$/);
    await page.getByRole('button', { name: '已保存，关闭', exact: true }).click();
    const keyRow = page.getByRole('row').filter({ has: page.getByText('Admin client', { exact: true }) });
    await expect(keyRow).toBeVisible();
    const keys = await (await authenticated.get('/api/admin/keys')).json();
    expect((await authenticated.post('/api/admin/keys', { headers: { Origin: origin }, data: { action: 'create', name: 'Expired', expiresAt: '2000-01-01T00:00:00.000Z', revision: keys.revision } })).status()).toBe(400);
    expect(JSON.stringify(keys)).not.toMatch(new RegExp(`${first}|workspace-client-secret`));
    expect((await authenticated.post('/api/admin/keys', { headers: { Origin: origin }, data: { action: 'delete', id: 'cc-bridge-workspace-key', revision: keys.revision } })).status()).toBe(400);
    const data = { model: 'Admin GPT/test-gpt', max_tokens: 64, messages: [{ role: 'user', content: 'Hello' }] };
    const modelRequest = (key: string) => request.post('/v1/messages', { headers: { Authorization: `Bearer ${key}` }, data });
    expect((await modelRequest(first)).status()).toBe(200);
    await keyRow.getByRole('button', { name: '更换', exact: true }).click();
    await page.getByRole('button', { name: '确认更换密钥', exact: true }).click();
    await expect(secret).toBeVisible();
    const second = await secret.inputValue();
    expect(second).not.toBe(first);
    expect((await modelRequest(first)).status()).toBe(401);
    expect((await modelRequest(second)).status()).toBe(200);
    await page.getByRole('button', { name: '已保存，关闭', exact: true }).click();
    await keyRow.getByRole('button', { name: '撤销', exact: true }).click();
    await page.getByRole('button', { name: '确认撤销密钥', exact: true }).click();
    await expect(keyRow.getByText('已失效', { exact: true })).toBeVisible();
    expect((await modelRequest(second)).status()).toBe(401);
    await page.reload();
    await expect(page.getByLabel('新访问密钥')).toHaveCount(0);

    await page.getByRole('navigation', { name: '管理后台导航' }).getByRole('link', { name: '用量统计', exact: true }).click();
    await page.getByLabel('统计周期').selectOption('30d');
    await page.getByLabel('统计连接').selectOption({ label: 'Admin GPT' });
    await expect.poll(async () => (await (await authenticated.get(`/api/admin/usage?range=30d&provider=${id}`)).json()).requests, { timeout: 20_000 }).toBeGreaterThan(0);
    expect((await authenticated.get('/api/admin/usage?range=bad')).status()).toBe(400);
    await page.getByRole('navigation', { name: '管理后台导航' }).getByRole('link', { name: '系统状态', exact: true }).click();
    await expect(page.getByText('运行中', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '停止网关', exact: true }).click();
    await page.getByRole('button', { name: '确认停止网关', exact: true }).click();
    await expect(page.getByText('已停止', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '启动网关', exact: true }).click();
    await page.getByRole('button', { name: '确认启动网关', exact: true }).click();
    await expect(page.getByText('运行中', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '重启网关', exact: true }).click();
    await page.getByRole('button', { name: '确认重启网关', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('运行中', { exact: true })).toBeVisible();

    await page.route('**/api/admin/gateway', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '测试：服务暂不可用。' }) }));
    await page.getByRole('button', { name: '刷新', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: '管理服务不可达' })).toContainText('管理服务不可达');
    await expect(page.getByRole('button', { name: '启动网关', exact: true })).toBeDisabled();
    await page.unroute('**/api/admin/gateway');
    await page.getByRole('button', { name: '刷新', exact: true }).click();
    await expect(page.getByText('运行中', { exact: true })).toBeVisible();

    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto('/admin/providers');
      await expect(page.getByText('Admin GPT', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/admin-${width}.png`, fullPage: true });
    }
    await row.getByRole('button', { name: '删除', exact: true }).click();
    await page.getByRole('button', { name: '确认删除连接', exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.getByRole('navigation', { name: '管理后台导航' }).getByRole('link', { name: '访问密钥', exact: true }).click();
    await keyRow.getByRole('button', { name: '删除', exact: true }).click();
    await page.getByRole('button', { name: '确认删除密钥', exact: true }).click();
    await expect(keyRow).toHaveCount(0);
    // Native CCR creates a credential for an empty list: protect the last key.
    await rpc(request, 'saveApiKeys', [[original.APIKEYS[0]]]);
    const finalKeys = await (await authenticated.get('/api/admin/keys')).json();
    expect(finalKeys.keys).toHaveLength(1);
    expect((await authenticated.post('/api/admin/keys', { headers: { Origin: origin }, data: { action: 'delete', id: finalKeys.keys[0].id, revision: finalKeys.revision } })).status()).toBe(400);
    expect((await authenticated.post('/api/admin/keys', { headers: { Origin: origin }, data: { action: 'revoke', id: finalKeys.keys[0].id, revision: finalKeys.revision } })).status()).toBe(200);
    const revokedFinal = await (await authenticated.get('/api/admin/keys')).json();
    expect(revokedFinal.keys).toHaveLength(1);
    expect(revokedFinal.keys[0].active).toBe(false);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: '打开后台导航', exact: true }).click();
    await page.getByRole('dialog').getByRole('link', { name: '系统状态', exact: true }).click();
    await expect(page.getByRole('heading', { name: '系统状态', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '打开后台导航', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '退出后台', exact: true }).click();
    await expect(page).toHaveURL('/admin/login');
    expect((await authenticated.get('/api/admin/keys')).status()).toBe(401);
    expect(pageErrors).toEqual([]);
  }
  finally {
    const current = await rpc(request, 'getConfig');
    await rpc(request, 'saveConfig', [{ ...original, configRevision: current.configRevision }, { applyProfile: false }]);
    await rpc(request, 'saveApiKeys', [original.APIKEYS]);
  }
});
