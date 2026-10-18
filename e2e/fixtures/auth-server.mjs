import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = await mkdtemp(path.join(tmpdir(), 'cc-bridge-auth-'));
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
writeFileSync('/dev/shm/ga-clerk-fixture.json', JSON.stringify({ privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }), jwk: { ...publicKey.export({ format: 'jwk' }), kid: 'integration-key', alg: 'RS256', use: 'sig' } }), { mode: 0o600 });
const env = { ...process.env, CC_BRIDGE_DATABASE_PATH: path.join(dir, 'auth.sqlite'), NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('clerk.fixture.test$').toString('base64')}`, CLERK_SECRET_KEY: 'sk_test_local_fixture_only_not_a_cloud_key' };
await (await import('node:fs/promises')).writeFile('/tmp/cc-bridge-auth-test-db-path', env.CC_BRIDGE_DATABASE_PATH);
const migrate = spawn(process.execPath, ['--experimental-strip-types', 'scripts/migrate-auth.ts'], { env, stdio: 'inherit' });
const code = await new Promise(resolve => migrate.on('exit', resolve));
if (code !== 0) {
  process.exit(1);
}
const child = spawn(process.execPath, ['--import', './e2e/fixtures/clerk-fetch.mjs', './node_modules/next/dist/bin/next', 'start', '--hostname', 'localhost', '--port', '3110'], { env, stdio: 'inherit' });
let stopping = false;
async function stop() {
  if (stopping) {
    return;
  }
  stopping = true;
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  await rm(dir, { recursive: true, force: true });
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => {
  if (!stopping) {
    process.exit(code || 0);
  }
});
