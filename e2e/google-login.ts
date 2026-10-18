import type { Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

export function clerkToken(user = 'alice', overrides: Record<string, unknown> = {}) {
  const fixture = JSON.parse(readFileSync('/dev/shm/ga-clerk-fixture.json', 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${encode({ alg: 'RS256', typ: 'JWT', kid: 'integration-key' })}.${encode({ iss: 'https://clerk.fixture.test', sub: `user_${user}`, sid: `sess_${user}`, azp: 'http://localhost:3110', iat: now, nbf: now - 5, exp: now + 3600, ...overrides })}`;
  return `${body}.${createSign('RSA-SHA256').update(body).sign(fixture.privateKey, 'base64url')}`;
}

// Uses the real Clerk middleware JWT verifier and backend profile client.
// It does not simulate the hosted Google consent or Clerk browser UI.
export async function googleLogin(page: Page, user = 'alice') {
  await page.context().addCookies([
    { name: '__session', value: clerkToken(user), url: 'http://localhost:3110' },
    { name: '__client_uat', value: String(Math.floor(Date.now() / 1000)), url: 'http://localhost:3110' },
    { name: '__clerk_db_jwt', value: 'fixture-signed-in-browser', url: 'http://localhost:3110' },
  ]);
  await page.route('https://clerk.fixture.test/**', route => route.abort());
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText(`${user} · ${user}@example.com`, { exact: true })).toBeVisible();
}
