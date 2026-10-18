import type { User } from '@clerk/nextjs/server';
import { randomUUID } from 'node:crypto';
import { database } from './database.ts';

// Only backend API resources are accepted here, never session metadata or email alone.
export function clerkPrincipal(profile: User) {
  const google = profile.externalAccounts.filter(account => account.provider === 'oauth_google' || account.provider === 'google');
  if (google.length !== 1) {
    throw new Error('A single verified Google identity is required');
  }
  const account = google[0]!;
  const email = profile.emailAddresses.find(item => item.emailAddress === account.emailAddress);
  if (account.verification?.status !== 'verified' || email?.verification?.status !== 'verified'
    || typeof account.providerUserId !== 'string' || !account.providerUserId || account.providerUserId.length > 255 || /\s/.test(account.providerUserId)
    || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(account.emailAddress) || account.emailAddress.length > 320) {
    throw new Error('A verified Google identity and email are required');
  }
  const db = database();
  db.exec('BEGIN IMMEDIATE');
  try {
    const bindings = db.prepare('SELECT * FROM clerk_identity WHERE clerkUserId = ? OR googleSubject = ?')
      .all(profile.id, account.providerUserId) as { clerkUserId: string; googleSubject: string; userId: string }[];
    if (bindings.some(binding => binding.clerkUserId !== profile.id || binding.googleSubject !== account.providerUserId)) {
      throw new Error('Conflicting identity binding');
    }
    const legacy = db.prepare('SELECT DISTINCT userId FROM account WHERE providerId = \'google\' AND accountId = ?')
      .all(account.providerUserId) as { userId: string }[];
    if (legacy.length > 1 || (bindings[0] && legacy[0] && bindings[0].userId !== legacy[0].userId)) {
      throw new Error('Conflicting legacy identity');
    }
    const userId = bindings[0]?.userId ?? legacy[0]?.userId ?? randomUUID();
    const existing = db.prepare('SELECT clerkUserId FROM clerk_identity WHERE userId = ?').get(userId);
    if (existing && existing.clerkUserId !== profile.id) {
      throw new Error('Principal is already bound');
    }
    const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || account.emailAddress;
    db.prepare(`INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, emailVerified = 1, updatedAt = excluded.updatedAt`)
      .run(userId, name, account.emailAddress, new Date().toISOString(), new Date().toISOString());
    db.prepare(`INSERT INTO clerk_identity (clerkUserId, googleSubject, userId, verifiedEmail) VALUES (?, ?, ?, ?)
      ON CONFLICT(clerkUserId) DO UPDATE SET verifiedEmail = excluded.verifiedEmail`)
      .run(profile.id, account.providerUserId, userId, account.emailAddress);
    db.exec('COMMIT');
    return { user: { id: userId, name, email: account.emailAddress } };
  }
  catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
