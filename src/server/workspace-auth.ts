import { Buffer } from 'node:buffer';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const sessionCookie = 'cc_bridge_workspace';
export const sessionSeconds = 8 * 60 * 60;

export function liveWorkspaceEnabled() {
  return Boolean(process.env.CCR_MANAGEMENT_URL);
}

export function equalSecret(value: string, expected: string) {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function signingKey() {
  const key = process.env.CC_BRIDGE_ADMIN_TOKEN;
  if (!key || key.length < 32) {
    throw new Error('Workspace access is not configured');
  }
  return key;
}

export function verifyAdminToken(value: string) {
  return equalSecret(value, signingKey());
}

export function createSession() {
  const payload = `${Math.floor(Date.now() / 1000) + sessionSeconds}.${randomBytes(24).toString('hex')}`;
  return `${payload}.${createHmac('sha256', signingKey()).update(payload).digest('hex')}`;
}

export function validSession(value: string | undefined) {
  if (!value) {
    return false;
  }
  const parts = value.split('.');
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]!) || Number(parts[0]) <= Date.now() / 1000) {
    return false;
  }
  const signature = createHmac('sha256', signingKey()).update(`${parts[0]}.${parts[1]}`).digest('hex');
  return equalSecret(parts[2]!, signature);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.CC_BRIDGE_PUBLIC_URL || new URL(request.url).origin;
  return origin === new URL(expected).origin;
}
