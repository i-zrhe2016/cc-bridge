import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const state = globalThis as typeof globalThis & { ccBridgeDatabase?: DatabaseSync };

export function database() {
  if (!state.ccBridgeDatabase) {
    const path = process.env.CC_BRIDGE_DATABASE_PATH;
    if (!path) {
      throw new Error('CC_BRIDGE_DATABASE_PATH is required');
    }
    mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    state.ccBridgeDatabase = db;
  }
  return state.ccBridgeDatabase;
}

// Historical account records remain inert, solely for subject-based migration.
export function migrateAuth() {
  database().exec(`CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
    emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS clerk_identity (
    clerkUserId TEXT PRIMARY KEY, googleSubject TEXT NOT NULL UNIQUE,
    userId TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE RESTRICT,
    verifiedEmail TEXT NOT NULL
  );`);
}

export function migrateWorkspace() {
  database().exec(`CREATE TABLE IF NOT EXISTS workspace (
    userId TEXT PRIMARY KEY REFERENCES user(id) ON DELETE RESTRICT,
    providerId TEXT NOT NULL UNIQUE,
    keyId TEXT NOT NULL UNIQUE,
    displayName TEXT NOT NULL DEFAULT ''
  );`);
}

export interface OwnedWorkspace { userId: string; providerId: string; keyId: string; displayName: string }

export function workspaceFor(userId: string): OwnedWorkspace {
  const db = database();
  // CCR normalizes IDs to lowercase and truncates them to 72 characters.
  // A 192-bit digest keeps both prefixed resource IDs comfortably within that limit.
  const stableId = createHash('sha256').update(userId).digest('hex').slice(0, 48);
  db.prepare('INSERT OR IGNORE INTO workspace (userId, providerId, keyId) VALUES (?, ?, ?)')
    .run(userId, `ccb_user_${stableId}`, `ccb_key_${stableId}`);
  return db.prepare('SELECT * FROM workspace WHERE userId = ?').get(userId) as unknown as OwnedWorkspace;
}

export function workspaceByKey(keyId: string): OwnedWorkspace | undefined {
  return database().prepare('SELECT * FROM workspace WHERE keyId = ?').get(keyId) as unknown as OwnedWorkspace | undefined;
}

export function renameWorkspace(userId: string, name: string) {
  database().prepare('UPDATE workspace SET displayName = ? WHERE userId = ?').run(name, userId);
}

export function isWorkspaceProvider(id?: string) {
  return id === 'cc-bridge-workspace' || Boolean(id?.startsWith('ccb_user_'));
}

export function isWorkspaceKey(id: string) {
  return id === 'cc-bridge-workspace-key' || id.startsWith('ccb_key_');
}
