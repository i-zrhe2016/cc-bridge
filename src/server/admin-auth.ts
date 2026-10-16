import { Buffer } from 'node:buffer';
import { createHmac, randomBytes } from 'node:crypto';
import { equalSecret, liveWorkspaceEnabled } from './workspace-auth';

export const adminCookie = 'cc_bridge_operations';
export const adminSessionSeconds = 8 * 60 * 60;

function signingKey() {
  const key = process.env.CC_BRIDGE_OPERATIONS_TOKEN;
  if (!liveWorkspaceEnabled() || !key || key.length < 32
    || key === process.env.CC_BRIDGE_ADMIN_TOKEN || key === process.env.CCR_WEB_AUTH_TOKEN) {
    throw new Error('Operations access is not configured');
  }
  return key;
}

export function adminEnabled() {
  try {
    signingKey();
    return true;
  }
  catch {
    return false;
  }
}

export function verifyOperationsToken(token: string) {
  return equalSecret(token, signingKey());
}

export function adminSignature(value: string) {
  return createHmac('sha256', signingKey()).update(`operations:${value}`).digest('hex');
}

export function createAdminSession() {
  const payload = `${Math.floor(Date.now() / 1000) + adminSessionSeconds}.${randomBytes(24).toString('hex')}`;
  return `${payload}.${adminSignature(payload)}`;
}

export function validAdminSession(value?: string) {
  if (!value || !adminEnabled() || Buffer.byteLength(value) > 256) {
    return false;
  }
  const parts = value.split('.');
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]!) || !/^[a-f0-9]{48}$/.test(parts[1]!)
    || !/^[a-f0-9]{64}$/.test(parts[2]!) || Number(parts[0]) <= Date.now() / 1000) {
    return false;
  }
  return equalSecret(parts[2]!, adminSignature(`${parts[0]}.${parts[1]}`));
}
