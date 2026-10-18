import type { User } from '@clerk/nextjs/server';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { it } from 'node:test';
import { clerkPrincipal } from '../src/server/clerk-principal.ts';
import { database, migrateAuth, migrateWorkspace, workspaceFor } from '../src/server/database.ts';

const dir = mkdtempSync(join(tmpdir(), 'clerk-principal-'));
process.env.CC_BRIDGE_DATABASE_PATH = join(dir, 'app.sqlite');

function profile(id: string, subject: string, email = `${id}@example.com`) {
  return { id, firstName: id, lastName: '', emailAddresses: [{ emailAddress: email, verification: { status: 'verified' } }], externalAccounts: [{ provider: 'oauth_google', providerUserId: subject, emailAddress: email, verification: { status: 'verified' } }] } as unknown as User;
}

it('fresh schema migration is credential-free and idempotent', () => {
  const path = join(dir, 'fresh.sqlite');
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/migrate-auth.ts'], { env: { ...process.env, CC_BRIDGE_DATABASE_PATH: path }, stdio: 'pipe' });
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/migrate-auth.ts'], { env: { ...process.env, CC_BRIDGE_DATABASE_PATH: path }, stdio: 'pipe' });
  const db = new DatabaseSync(path);
  assert.equal(db.prepare('SELECT count(*) AS n FROM clerk_identity').get()!.n, 0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
});

it('legacy Google subject preserves principal/resource IDs and rejects conflicts or email takeover', () => {
  const db = database();
  // Existing Better Auth columns and unique email constraint remain intact.
  db.exec(`CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL, image TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE account (id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id), accessToken TEXT);
    CREATE TABLE session (id TEXT PRIMARY KEY, userId TEXT REFERENCES user(id), token TEXT);
    INSERT INTO user VALUES ('original-ID', 'Original', 'original@example.com', 1, NULL, '2026', '2026');
    INSERT INTO account VALUES ('old-account', 'google-original', 'google', 'original-ID', 'historical-secret');
    INSERT INTO session VALUES ('old-session', 'original-ID', 'old-cookie');`);
  migrateAuth();
  migrateWorkspace();
  const original = workspaceFor('original-ID');
  const first = clerkPrincipal(profile('user_original', 'google-original', 'original@example.com'));
  assert.equal(first.user.id, 'original-ID');
  assert.equal(clerkPrincipal(profile('user_original', 'google-original', 'original@example.com')).user.id, 'original-ID');
  migrateAuth();
  migrateWorkspace();
  assert.deepEqual(workspaceFor('original-ID'), original);
  assert.equal(db.prepare('SELECT accessToken FROM account').get()!.accessToken, 'historical-secret');
  assert.equal(db.prepare('SELECT token FROM session').get()!.token, 'old-cookie');
  assert.throws(() => clerkPrincipal(profile('user_other', 'other-subject', 'original@example.com')));
  assert.throws(() => clerkPrincipal(profile('user_other', 'google-original')));
  assert.throws(() => clerkPrincipal(profile('user_original', 'other-subject')));
  const alice = clerkPrincipal(profile('user_alice', 'google-alice'));
  const bob = clerkPrincipal(profile('user_bob', 'google-bob'));
  assert.notEqual(alice.user.id, bob.user.id);
  assert.equal(clerkPrincipal(profile('user_alice', 'google-alice')).user.id, alice.user.id);
  assert.notEqual(workspaceFor(alice.user.id).providerId, workspaceFor(bob.user.id).providerId);
  const invalid = profile('user_invalid', 'google-invalid');
  Object.assign(invalid.externalAccounts[0]!, { verification: { status: 'unverified' } });
  assert.throws(() => clerkPrincipal(invalid));
  for (const subject of ['', 'bad subject', 'x'.repeat(256), 123]) {
    const malformed = profile('user_malformed', 'placeholder');
    Object.assign(malformed.externalAccounts[0]!, { providerUserId: subject });
    assert.throws(() => clerkPrincipal(malformed));
  }
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(db.prepare('SELECT count(*) AS n FROM clerk_identity').get()!.n, 3);
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
