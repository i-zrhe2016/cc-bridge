import type { APIRequestContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { expect } from '@playwright/test';
import { test } from './fixtures/ccr-test';
import { clerkToken, googleLogin } from './google-login';

test.skip(({ baseURL }) => baseURL !== 'http://localhost:3110', 'Run with bun run test:ccr');
test.setTimeout(180_000);
const origin = 'http://localhost:3110';
const authEnv = () => ({ ...process.env, CC_BRIDGE_PUBLIC_URL: origin, CC_BRIDGE_DATABASE_PATH: readFileSync('/tmp/cc-bridge-auth-test-db-path', 'utf8'), CCR_MANAGEMENT_URL: 'http://127.0.0.1:3468', CCR_WEB_AUTH_TOKEN: 'integration-only-ccr-management-token' });

async function change(request: APIRequestContext, data: unknown) {
  const response = await request.post('/api/workspace', { headers: { Origin: origin }, data });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

async function rpc(request: APIRequestContext, method: string, args: unknown[] = []) {
  const response = await request.post('http://127.0.0.1:3468/api/ccr/rpc', { headers: { 'x-ccr-web-auth': 'integration-only-ccr-management-token' }, data: { method, args } });
  expect(response.status()).toBe(200);
  return (await response.json()).value;
}

test('Google accounts persist and user resources, models and sessions are isolated', async ({ browser, page, request }) => {
  await googleLogin(page, 'alice');
  await page.reload();
  await expect(page.getByText('alice · alice@example.com', { exact: true })).toBeVisible();
  await page.goto('/auth/sign-in');
  await expect(page).toHaveURL('/dashboard');
  const input = { name: '同名连接', endpoint: 'http://127.0.0.1:3470/v1', apiKey: 'alice-upstream-secret', model: 'test-gpt' };
  for (const endpoint of ['http://169.254.169.254/latest', 'http://127.0.0.1:3468/api/ccr/rpc', 'https://untrusted.example/v1']) {
    expect((await page.request.post('/api/workspace', { headers: { Origin: origin }, data: { action: 'save', input: { ...input, endpoint } } })).status()).toBe(400);
  }
  await change(page.request, { action: 'save', input });
  const alice = await change(page.request, { action: 'rotate' });
  const other = await browser.newContext({ baseURL: origin });
  try {
    const bobPage = await other.newPage();
    await googleLogin(bobPage, 'bob');
    const empty = await (await other.request.get(`${origin}/api/workspace`)).json();
    expect(empty.state).toEqual({ connection: null, bridgeKey: null });
    await change(other.request, { action: 'save', input: { ...input, apiKey: 'bob-upstream-secret' } });
    const bob = await change(other.request, { action: 'rotate' });
    expect(bob.gatewayModel).not.toBe(alice.gatewayModel);
    const data = { model: alice.gatewayModel, max_tokens: 32, messages: [{ role: 'user', content: 'Hello' }] };
    const headers = { 'x-api-key': alice.state.bridgeKey };
    expect((await request.post('/v1/messages', { headers, data })).status()).toBe(200);
    expect((await request.post('/v1/messages', { headers, data: { ...data, model: bob.gatewayModel } })).status()).toBe(403);
    expect((await request.post('/v1/messages/count_tokens', { headers, data: { ...data, model: bob.gatewayModel } })).status()).toBe(403);
    expect((await request.post('/v1/messages', { headers: { ...headers, 'x-target-provider': bob.gatewayModel.split('/')[0], 'x-target-model': bob.gatewayModel }, data })).status()).toBe(200);
    const models = await (await request.get('/v1/models', { headers })).json();
    expect(models.data.map((item: { id: string }) => item.id)).toEqual([alice.gatewayModel]);
    const total = async (client: APIRequestContext) => (await (await client.get('/api/workspace')).json()).usage.reduce((sum: number, day: { requests: number }) => sum + day.requests, 0);
    await expect.poll(() => total(page.request), { timeout: 20_000 }).toBe(2);
    expect(await total(other.request)).toBe(0);
    const aliceRequests = await total(page.request);
    expect((await request.post('/v1/messages', { headers: { 'x-api-key': bob.state.bridgeKey }, data: { ...data, model: bob.gatewayModel } })).status()).toBe(200);
    await expect.poll(() => total(other.request), { timeout: 20_000 }).toBe(1);
    expect(await total(page.request)).toBe(aliceRequests);
    // Global CCR request rewrites are rejected, even when the key/model are otherwise valid.
    const config = await rpc(request, 'getConfig');
    for (const change of [
      { Router: { ...config.Router, builtInRules: { 'claude-code': { enabled: true } } } },
      { Router: { ...config.Router, fallback: { mode: 'sequential', models: [bob.gatewayModel], retryCount: 1 } } },
    ]) {
      try {
        await rpc(request, 'saveConfig', [{ ...await rpc(request, 'getConfig'), ...change }, { applyProfile: false }]);
        expect((await request.post('/v1/messages', { headers, data })).status()).toBe(503);
      }
      finally {
        await rpc(request, 'saveConfig', [await rpc(request, 'getConfig').then(current => ({ ...current, Router: config.Router })), { applyProfile: false }]);
      }
    }
    const bobSnapshot = await (await other.request.get(`${origin}/api/workspace`)).text();
    expect(bobSnapshot).not.toContain(alice.state.bridgeKey);
    expect(bobSnapshot).not.toContain('alice-upstream-secret');
    expect((await page.request.post('/api/workspace', { headers: { Origin: 'https://evil.example' }, data: { action: 'delete' } })).status()).toBe(403);
    expect((await page.request.post('/api/auth/sign-out', { data: {} })).status()).toBe(410);
    expect((await request.post('/api/auth/sign-in/email', { data: { email: 'alice@example.com', password: 'password' } })).status()).not.toBe(200);
    // A browser session grants no operations privileges.
    expect((await page.request.get('/api/admin/providers')).status()).toBe(401);
    // Managed browser logout/refresh requires real instance keys; server expiry is tested below.
    await page.context().addCookies([{ name: '__session', value: clerkToken('alice', { exp: 1 }), url: origin }]);
    expect((await page.request.get('/api/workspace')).status()).toBe(401);
    await googleLogin(page, 'alice');
    expect((await (await page.request.get('/api/workspace')).json()).state.bridgeKey).toBe(alice.state.bridgeKey);
    await change(other.request, { action: 'delete' });
  }
  finally {
    await other.close();
    await googleLogin(page, 'alice');
    await change(page.request, { action: 'delete' });
  }
});

test('retired auth routes deny access and legacy migration is explicit and repeatable', async ({ browser, page, request }) => {
  expect((await request.get('/api/auth/callback/google?code=alice&state=forged')).status()).toBe(410);
  await googleLogin(page, 'legacy');
  const config = await rpc(request, 'getConfig');
  config.Providers.push({ id: 'cc-bridge-workspace', name: 'Legacy GPT', type: 'openai_chat_completions', protocolDetectionMode: 'manual', api_base_url: 'http://127.0.0.1:3470/v1', api_key: 'legacy-upstream-secret', models: ['test-gpt'], enabled: true });
  await rpc(request, 'saveConfig', [config, { applyProfile: false }]);
  await rpc(request, 'saveApiKeys', [[...config.APIKEYS, { id: 'cc-bridge-workspace-key', name: 'Legacy', key: 'legacy-bridge-secret', createdAt: new Date().toISOString() }]]);
  const legacyCall = await request.post('http://127.0.0.1:3466/v1/messages', {
    headers: { 'x-api-key': 'legacy-bridge-secret' },
    data: { model: 'Legacy GPT/test-gpt', max_tokens: 32, messages: [{ role: 'user', content: 'Hello' }] },
  });
  expect(legacyCall.status(), await legacyCall.text()).toBe(200);
  await expect.poll(async () => (await rpc(request, 'getUsageStats', ['7d', { provider: 'Legacy GPT', includeProxy: false }])).series.reduce((sum: number, day: { requestCount: number }) => sum + day.requestCount, 0), { timeout: 20_000 }).toBe(1);
  const args = ['--experimental-strip-types', 'scripts/migrate-workspace.ts', '--email=legacy@example.com'];
  const run = (apply = false) => execFileSync(process.execPath, [...args, ...(apply ? ['--apply'] : [])], { env: authEnv(), encoding: 'utf8', timeout: 15_000 });
  expect(run()).toContain('"mode":"preview"');
  expect((await (await page.request.get('/api/workspace')).json()).state.connection).toBeNull();
  expect((await request.get('/v1/models', { headers: { 'x-api-key': 'legacy-bridge-secret' } })).status()).toBe(403);
  // A verified account with resources cannot have them replaced by legacy migration.
  const bobContext = await browser.newContext({ baseURL: origin });
  try {
    const bobPage = await bobContext.newPage();
    await googleLogin(bobPage, 'bob');
    await change(bobContext.request, { action: 'save', input: { name: 'Bob', endpoint: 'http://127.0.0.1:3470/v1', apiKey: 'bob-secret', model: 'test-gpt' } });
    expect(() => execFileSync(process.execPath, [...args.slice(0, -1), '--email=bob@example.com', '--apply'], { env: authEnv(), stdio: 'pipe', timeout: 15_000 })).toThrow();
    await change(bobContext.request, { action: 'delete' });
  }
  finally {
    await bobContext.close();
  }
  expect(run(true)).toContain('Ownership migrated');
  expect(() => execFileSync(process.execPath, [...args.slice(0, -1), '--email=bob@example.com', '--apply'], { env: authEnv(), stdio: 'pipe', timeout: 15_000 })).toThrow();
  expect(run(true)).toContain('"alreadyMigrated":true');
  const migrated = await (await page.request.get('/api/workspace')).json();
  expect(migrated.state.bridgeKey).toBe('legacy-bridge-secret');
  expect(migrated.gatewayModel).toBe('Legacy GPT/test-gpt');
  expect(migrated.usage.reduce((sum: number, day: { requests: number }) => sum + day.requests, 0)).toBe(1);
  expect((await request.get('/v1/models', { headers: { 'x-api-key': 'legacy-bridge-secret' } })).status()).toBe(200);
  const unchanged = await rpc(request, 'getConfig');
  expect(unchanged.Providers.find((item: { id: string }) => item.id === 'cc-bridge-workspace').api_key).toBe('legacy-upstream-secret');
  expect(() => execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/migrate-workspace.ts', '--email=nobody@example.com', '--apply'], { env: authEnv(), stdio: 'pipe', timeout: 15_000 })).toThrow();
  await change(page.request, { action: 'delete' });
});

test('Clerk SDK rejects forged, expired and foreign sessions before principal provisioning', async ({ request }) => {
  const db = new DatabaseSync(authEnv().CC_BRIDGE_DATABASE_PATH);
  const count = () => Number(db.prepare('SELECT count(*) AS n FROM clerk_identity').get()!.n);
  try {
    const before = count();
    for (const token of [
      'forged',
      clerkToken('negative', { exp: 1 }),
      clerkToken('negative', { exp: undefined }),
      clerkToken('negative', { sub: undefined }),
      clerkToken('negative', { iat: Math.floor(Date.now() / 1000) + 3600 }),
      clerkToken('negative', { nbf: Math.floor(Date.now() / 1000) + 3600 }),
      clerkToken('negative', { iss: 'https://other.clerk.accounts.dev' }),
      clerkToken('negative', { azp: 'https://evil.example' }),
      `${clerkToken('negative').slice(0, -10)}aaaaaaaaaa`,
    ]) {
      expect((await request.get('/api/workspace', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);
      expect(count()).toBe(before);
    }
    // Establish Alice, then ensure a different Google subject cannot acquire her principal.
    expect((await request.get('/api/workspace', { headers: { Authorization: `Bearer ${clerkToken('alice')}` } })).status()).toBe(200);
    const boundCount = count();
    for (const user of ['no-google', 'unverified']) {
      expect((await request.get('/api/workspace', { headers: { Authorization: `Bearer ${clerkToken(user)}` } })).status()).toBe(401);
      expect(count()).toBe(boundCount);
      // A valid SDK session rejected by the app must stay on an explicit recovery screen,
      // rather than rendering SignIn (which redirects signed-in users back to dashboard).
      for (const path of ['/dashboard', '/auth/sign-in']) {
        const rejected = await request.get(path, { headers: { Authorization: `Bearer ${clerkToken(user)}` }, maxRedirects: 0 });
        expect(rejected.status()).toBe(200);
        const html = await rejected.text();
        expect(html).toContain('无法访问工作台');
        expect(html).toContain('退出当前账号');
      }
    }
    const sameEmail = await request.get('/api/workspace', { headers: { Authorization: `Bearer ${clerkToken('same-email')}` } });
    expect(sameEmail.status()).toBe(200);
    const aliceId = db.prepare('SELECT userId FROM clerk_identity WHERE clerkUserId = ?').get('user_alice')!.userId;
    const otherId = db.prepare('SELECT userId FROM clerk_identity WHERE clerkUserId = ?').get('user_same-email')!.userId;
    expect(otherId).not.toBe(aliceId);
    expect((await sameEmail.json()).state.connection).toBeNull();
    const aliceWorkspace = db.prepare('SELECT providerId, keyId FROM workspace WHERE userId = ?').get(String(aliceId))!;
    const otherWorkspace = db.prepare('SELECT providerId, keyId FROM workspace WHERE userId = ?').get(String(otherId))!;
    expect(otherWorkspace.providerId).not.toBe(aliceWorkspace.providerId);
    expect(otherWorkspace.keyId).not.toBe(aliceWorkspace.keyId);
    expect((await request.get('/api/workspace', { headers: { 'x-clerk-auth-user-id': 'user_alice', 'x-clerk-auth-status': 'signed-in', 'x-clerk-auth-token': clerkToken('alice'), 'Cookie': 'better-auth.session_token=forged' } })).status()).toBe(401);
    expect(count()).toBe(boundCount + 1);
  }
  finally {
    db.close();
  }
});
