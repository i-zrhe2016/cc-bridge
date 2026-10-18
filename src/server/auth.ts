import { Buffer } from 'node:buffer';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { clerkPrincipal } from './clerk-principal.ts';

export function authConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
    && process.env.CC_BRIDGE_PUBLIC_URL && process.env.CC_BRIDGE_DATABASE_PATH);
}

export async function userSession(_headers: Headers) {
  if (!authConfigured()) {
    return null;
  }
  try {
    const session = await auth({ acceptsToken: 'session_token' });
    const frontendApi = Buffer.from(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!.slice(8), 'base64')
      .toString('utf8')
      .replace(/\$$/, '');
    // Clerk's SDK verifies signatures/expiry/azp; bind authenticated claims to this instance too.
    if (!session.isAuthenticated || !session.userId || session.sessionClaims?.iss !== `https://${frontendApi}`) {
      return null;
    }
    // Refresh authoritative Google verification on every protected request.
    const profile = await (await clerkClient()).users.getUser(session.userId);
    if (profile.id !== session.userId) {
      return null;
    }
    return clerkPrincipal(profile);
  }
  catch {
    return null;
  }
}
