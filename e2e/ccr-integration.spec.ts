import { expect, test } from '@playwright/test';

// Only the dedicated config starts the real CCR fixture; regular demo tests remain independent.
test.skip(({ baseURL }) => baseURL !== 'http://127.0.0.1:3110', 'Run with bun run test:ccr');
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
  await page.goto('/dashboard');
  await expect(page.getByLabel('管理口令')).toBeVisible();
  expect((await request.get('/api/workspace')).status()).toBe(401);
  expect((await request.post('/api/workspace', { data: { action: 'rotate' } })).status()).toBe(401);
  await page.getByLabel('管理口令').fill('integration-only-workspace-admin-token');
  await page.getByRole('button', { name: '进入工作台', exact: true }).click();
  await expect(page.getByLabel('名称', { exact: true })).toBeVisible();
  await page.getByLabel('名称', { exact: true }).fill('Test GPT');
  await page.getByLabel('API 地址').fill('http://127.0.0.1:3470/v1');
  await page.getByLabel('GPT 密钥（API Key）', { exact: true }).fill('upstream-secret-stays-server-side');
  await page.getByLabel('模型', { exact: true }).fill('test-gpt');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑', exact: true })).toBeVisible({ timeout: 45_000 });
  await page.reload();
  await expect(page.getByRole('button', { name: '编辑', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(page.getByLabel('GPT 密钥（API Key）', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '下一步：生成密钥' }).click();
  await page.getByRole('button', { name: '生成访问密钥', exact: true }).click();
  const key = page.getByLabel('当前访问密钥');
  await expect(key).toBeVisible();
  const first = await key.inputValue();
  expect(first).toMatch(/^ccb_[a-f0-9]{64}$/);
  await page.getByRole('button', { name: '下一步：查看教程' }).click();
  const configuration = await page.getByLabel('Claude Code 配置命令').textContent();
  expect(configuration).toContain('http://127.0.0.1:3110');
  expect(configuration).toContain('Test GPT/test-gpt');
  expect(configuration).not.toMatch(/upstream-secret|CCR|claude-code-router|ccr-web/);

  const headers = { 'Authorization': `Bearer ${first}`, 'anthropic-version': '2023-06-01' };
  const data = { model: 'Test GPT/test-gpt', max_tokens: 128, messages: [{ role: 'user', content: 'Hello' }] };
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
  await page.evaluate(async (key) => {
    const controller = new AbortController();
    const response = await fetch('/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'Test GPT/test-gpt', max_tokens: 128, stream: true, messages: [{ role: 'user', content: 'wait-for-cancel' }] }),
      signal: controller.signal,
    });
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
  }, first);
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
  await page.getByRole('button', { name: '退出工作台', exact: true }).click();
  await expect(page.getByLabel('管理口令')).toBeVisible();
  expect((await authenticated.get('/api/workspace')).status()).toBe(401);
  const remaining = await rpc('getConfig');
  expect(remaining.Providers).toEqual([expect.objectContaining({ id: 'unrelated-provider', name: 'Unrelated', api_key: 'unrelated-upstream-secret' })]);
  expect(remaining.APIKEYS).toContainEqual(expect.objectContaining({ id: 'unrelated-key', key: 'unrelated-client-key' }));
  expect(remaining.APIKEYS.some((key: { id: string }) => key.id === 'cc-bridge-workspace-key')).toBe(false);
});
