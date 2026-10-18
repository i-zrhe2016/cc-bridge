import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { expect } from '@playwright/test';
import { test } from './fixtures/ccr-test';
import { googleLogin } from './google-login';

// Only the dedicated config starts the real CCR fixture; regular demo tests remain independent.
test.skip(({ baseURL }) => baseURL !== 'http://localhost:3110', 'Run with bun run test:ccr');
test.setTimeout(120_000);

test('real CCR persists configuration, rotates keys, forwards tool streams and reports usage', async ({ page, request }) => {
  async function rpc(method: string, args: unknown[] = []) {
    const response = await request.post('http://127.0.0.1:3468/api/ccr/rpc', { headers: { 'x-ccr-web-auth': 'integration-only-ccr-management-token' }, data: { method, args } });
    expect(response.status()).toBe(200);
    return (await response.json()).value;
  }
  const original = await rpc('getConfig');
  original.Providers.push({ id: 'unrelated-provider', name: 'Unrelated', type: 'openai_chat_completions', api_base_url: 'http://127.0.0.1:3470/v1', api_key: 'unrelated-upstream-secret', models: ['other-model'] });
  await rpc('saveConfig', [original, { applyProfile: false }]);
  await rpc('saveApiKeys', [[...original.APIKEYS, { id: 'unrelated-key', name: 'Unrelated', key: 'unrelated-client-key', createdAt: new Date().toISOString() }]]);
  // A new development browser is synchronized by Clerk before app redirects.
  const anonymous = await request.get('/dashboard', { headers: { Accept: 'text/html' }, maxRedirects: 0 });
  expect(anonymous.status()).toBe(307);
  const handshake = new URL(anonymous.headers().location!);
  expect(handshake.origin).toBe('https://clerk.fixture.test');
  expect(handshake.pathname).toBe('/v1/client/handshake');
  expect(handshake.searchParams.get('__clerk_hs_reason')).toBe('dev-browser-missing');
  // A synchronized signed-out browser has a dev-browser marker, not a session.
  await page.context().addCookies([{ name: '__clerk_db_jwt', value: 'fixture-signed-out-browser', url: 'http://localhost:3110' }]);
  await page.route('https://clerk.fixture.test/**', route => route.abort());
  await page.goto('/');
  const browserPrefetch = await page.evaluate(async () => {
    const response = await fetch('/dashboard?_rsc=browser-probe', { headers: { 'rsc': '1', 'next-router-prefetch': '1' } });
    return { status: response.status, contentType: response.headers.get('content-type') };
  });
  expect(browserPrefetch.status).toBe(200);
  expect(browserPrefetch.contentType).toContain('text/x-component');
  await page.locator('a[href="/dashboard"]').click();
  await expect(page).toHaveURL('/auth/sign-in');
  const prefetch = await request.get('/dashboard?_rsc=anonymous-probe', { headers: { 'rsc': '1', 'next-router-prefetch': '1', 'Accept': '*/*' }, maxRedirects: 0 });
  expect(prefetch.status()).toBe(200);
  expect(prefetch.headers()['content-type']).toContain('text/x-component');
  expect(await prefetch.text()).toContain('dashboard');
  expect((await request.get('/api/workspace')).status()).toBe(401);
  expect((await request.post('/api/workspace', { data: { action: 'rotate' } })).status()).toBe(401);
  await googleLogin(page, 'workspace');
  await expect(page.getByLabel('名称', { exact: true })).toBeVisible();
  await page.getByLabel('名称', { exact: true }).fill('Test GPT');
  await page.getByLabel('API 地址').fill('http://127.0.0.1:3470/v1');
  await page.getByLabel('GPT 密钥（API Key）', { exact: true }).fill('upstream-secret-stays-server-side');
  await page.getByLabel('模型', { exact: true }).fill('test-gpt');
  const saved = page.waitForResponse(response => response.url().endsWith('/api/workspace') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  expect((await saved).status()).toBe(200);
  const db = new DatabaseSync(readFileSync('/tmp/cc-bridge-auth-test-db-path', 'utf8'));
  const principal = db.prepare('SELECT userId FROM clerk_identity WHERE clerkUserId = ?').get('user_workspace')!;
  const digest = createHash('sha256').update(String(principal.userId)).digest('hex').slice(0, 48);
  db.close();
  const providerId = `ccb_user_${digest}`;
  const keyId = `ccb_key_${digest}`;
  const persisted = await rpc('getConfig');
  expect(persisted.Providers).toContainEqual(expect.objectContaining({ id: providerId }));
  expect((await (await page.request.get('/api/workspace')).json()).gatewayModel).toBe(`${providerId}/test-gpt`);
  await expect(page.getByRole('button', { name: '编辑', exact: true })).toBeVisible({ timeout: 45_000 });
  await page.reload();
  await expect(page.getByRole('button', { name: '编辑', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(page.getByLabel('GPT 密钥（API Key）', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '下一步：生成密钥' }).click();
  const generated = page.waitForResponse(response => response.url().endsWith('/api/workspace') && response.request().method() === 'POST' && response.request().postDataJSON().action === 'rotate', { timeout: 45_000 });
  await page.getByRole('button', { name: '生成访问密钥', exact: true }).click();
  const generatedResponse = await generated;
  expect(generatedResponse.status(), await generatedResponse.text()).toBe(200);
  const key = page.getByLabel('当前访问密钥');
  await expect(key).toBeVisible();
  const first = await key.inputValue();
  expect((await rpc('getConfig')).APIKEYS).toContainEqual(expect.objectContaining({ id: keyId, key: first }));
  expect(first).toMatch(/^ccb_[a-f0-9]{64}$/);
  await page.getByRole('button', { name: '下一步：查看教程' }).click();
  const configuration = await page.getByLabel('Claude Code 配置命令').textContent();
  expect(configuration).toContain('http://localhost:3110');
  const selector = (await (await page.request.get('/api/workspace')).json()).gatewayModel;
  expect(configuration).toContain(selector);
  expect(configuration).not.toMatch(/upstream-secret|CCR|claude-code-router|ccr-web/);

  const headers = { 'Authorization': `Bearer ${first}`, 'anthropic-version': '2023-06-01' };
  const data = { model: selector, max_tokens: 128, messages: [{ role: 'user', content: 'Hello' }] };
  const reply = await request.post('/v1/messages', { headers, data });
  expect(reply.status(), await reply.text()).toBe(200);
  expect(await reply.json()).toMatchObject({ type: 'message', content: [{ type: 'text', text: 'Hello from the test upstream.' }] });
  expect(reply.headers()).not.toHaveProperty('x-powered-by');
  const count = await request.post('/v1/messages/count_tokens', { headers, data });
  expect(count.status(), await count.text()).toBe(200);
  expect((await count.json()).input_tokens).toBeGreaterThan(0);

  const tools = [{ name: 'read_file', description: 'Read a file', input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } }];
  const streamed = await request.post('/v1/messages', { headers, data: { ...data, stream: true, tools } });
  expect(streamed.status(), await streamed.text()).toBe(200);
  expect(streamed.headers()['content-type']).toContain('text/event-stream');
  const stream = await streamed.text();
  expect(stream).toContain('tool_use');
  expect(stream).toContain('read_file');
  expect(stream).toContain('input_json_delta');
  expect(stream).toContain('message_stop');
  await page.evaluate(async ({ key, selector }) => {
    const controller = new AbortController();
    const response = await fetch('/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: selector, max_tokens: 128, stream: true, messages: [{ role: 'user', content: 'wait-for-cancel' }] }),
      signal: controller.signal,
    });
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/event-stream')) {
      throw new Error(`Cancellation probe expected SSE 200, received ${response.status}`);
    }
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (!text.includes('cancel-ready')) {
      const chunk = await reader.read();
      if (chunk.done) {
        throw new Error('Stream ended before incremental data arrived');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    controller.abort();
    await reader.cancel().catch(() => undefined);
  }, { key: first, selector });
  await expect.poll(async () => (await (await request.get('http://127.0.0.1:3470/test-status')).json()).cancelledStreams).toBeGreaterThan(0);
  const followup = await request.post('/v1/messages', { headers, data: {
    ...data,
    tools,
    messages: [
      ...data.messages,
      { role: 'assistant', content: [{ type: 'tool_use', id: 'call_read_file', name: 'read_file', input: { path: 'README.md' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_read_file', content: 'File contents' }] },
    ],
  } });
  expect(followup.status(), await followup.text()).toBe(200);
  expect(await followup.text()).toContain('Tool result received.');
  const models = await request.get('/v1/models', { headers });
  expect(models.status(), await models.text()).toBe(200);
  const invalid = await request.post('/v1/messages', { headers: { Authorization: 'Bearer invalid' }, data });
  expect(invalid.status()).toBe(401);
  expect(await invalid.text()).not.toMatch(/CCR|claude-code-router|127\.0\.0\.1|integration-only|upstream-secret/);
  expect((await request.post('/v1/api/ccr/rpc', { headers, data: { method: 'getConfig' } })).status()).toBe(404);

  const authenticated = page.context().request;
  expect((await authenticated.post('/api/workspace', { headers: { Origin: 'https://evil.example' }, data: { action: 'revoke' } })).status()).toBe(403);
  const stateResponse = await authenticated.get('/api/workspace');
  expect(await stateResponse.text()).not.toMatch(/upstream-secret|integration-only|configRevision/);
  expect(await stateResponse.text()).not.toMatch(/Unrelated|unrelated-client-key/);
  await expect.poll(async () => {
    const snapshot = await (await authenticated.get('/api/workspace')).json();
    return snapshot.usage.reduce((sum: number, day: { requests: number }) => sum + day.requests, 0);
  }, { timeout: 15_000 }).toBeGreaterThan(0);

  await page.getByRole('navigation', { name: '工作台导航' }).getByRole('button', { name: '访问密钥', exact: true }).click();
  await page.getByRole('button', { name: '更换密钥', exact: true }).click();
  await page.getByRole('button', { name: '确认更换密钥', exact: true }).click();
  await expect(key).not.toHaveValue(first);
  const second = await key.inputValue();
  expect((await request.post('/v1/messages', { headers, data })).status()).toBe(401);
  expect((await request.post('/v1/messages', { headers: { Authorization: `Bearer ${second}` }, data })).status()).toBe(200);
  await page.getByRole('button', { name: '停用密钥', exact: true }).click();
  await page.getByRole('button', { name: '确认停用密钥', exact: true }).click();
  await expect(key).toHaveCount(0);
  expect((await request.post('/v1/messages', { headers: { Authorization: `Bearer ${second}` }, data })).status()).toBe(401);
  await page.getByRole('navigation', { name: '工作台导航' }).getByRole('button', { name: '我的 GPT', exact: true }).click();
  await page.getByRole('button', { name: '删除配置', exact: true }).click();
  await page.getByRole('button', { name: '确认删除配置', exact: true }).click();
  await expect(page.getByLabel('名称', { exact: true })).toHaveValue('');
  // Remote Clerk browser logout awaits real keys; losing the verified token denies access.
  await page.context().clearCookies({ name: /^(?:__session|__client_uat)$/ });
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/auth/sign-in');
  expect((await authenticated.get('/api/workspace')).status()).toBe(401);
  const remaining = await rpc('getConfig');
  expect(remaining.Providers).toEqual([expect.objectContaining({ id: 'unrelated-provider', name: 'Unrelated', api_key: 'unrelated-upstream-secret' })]);
  expect(remaining.APIKEYS).toContainEqual(expect.objectContaining({ id: 'unrelated-key', key: 'unrelated-client-key' }));
  expect(remaining.APIKEYS.some((key: { id: string }) => key.id === 'cc-bridge-workspace-key')).toBe(false);
});
