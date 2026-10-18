import type { Config } from '../src/server/ccr.ts';
import type { OwnedWorkspace } from '../src/server/database.ts';
import { keyId, providerId, rpc } from '../src/server/ccr.ts';
import { database } from '../src/server/database.ts';

// Stop web traffic while applying; this command changes ownership, never CCR secrets.
const email = process.argv.find(value => value.startsWith('--email='))?.slice(8).trim().toLowerCase();
if (!email) {
  throw new Error('Usage: workspace:migrate --email=verified@example.com [--apply]');
}
const db = database();
const candidates = db.prepare(`SELECT user.id, clerk_identity.verifiedEmail AS email FROM user
  JOIN clerk_identity ON clerk_identity.userId = user.id
  WHERE lower(clerk_identity.verifiedEmail) = ?`).all(email) as { id: string; email: string }[];
if (candidates.length !== 1) {
  throw new Error('Target must be one existing verified Clerk Google principal.');
}
const user = candidates[0]!;
const config = await rpc<Config>('getConfig');
const provider = config.Providers.find(item => item.id === providerId);
if (!provider || config.Providers.filter(item => item.name === provider.name).length !== 1) {
  throw new Error('A unique legacy workspace provider is required.');
}
const previous = db.prepare('SELECT * FROM workspace WHERE userId = ? OR providerId = ? OR keyId = ?').all(user.id, providerId, keyId) as unknown as OwnedWorkspace[];
if (previous.some(row => row.userId !== user.id)) {
  throw new Error('Legacy resources already belong to another account.');
}
const current = previous.find(row => row.userId === user.id);
if (current && current.providerId !== providerId
  && (config.Providers.some(item => item.id === current.providerId) || config.APIKEYS.some(item => item.id === current.keyId))) {
  throw new Error('Target already has resources; migration would replace its workspace.');
}
console.log(JSON.stringify({ email: user.email, providerId, keyId, hasKey: config.APIKEYS.some(item => item.id === keyId), alreadyMigrated: current?.providerId === providerId, mode: process.argv.includes('--apply') ? 'apply' : 'preview' }));
if (process.argv.includes('--apply')) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO workspace (userId, providerId, keyId, displayName) VALUES (?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET providerId = excluded.providerId, keyId = excluded.keyId, displayName = excluded.displayName`)
      .run(user.id, providerId, keyId, provider.name);
    db.exec('COMMIT');
    console.log('Ownership migrated. CCR identifiers, credentials and historical usage are unchanged.');
  }
  catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
