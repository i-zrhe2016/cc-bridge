import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';

export function liveWorkspaceEnabled() {
  return Boolean(process.env.CCR_MANAGEMENT_URL);
}

export function equalSecret(value: string, expected: string) {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.CC_BRIDGE_PUBLIC_URL || new URL(request.url).origin;
  return origin === new URL(expected).origin;
}
