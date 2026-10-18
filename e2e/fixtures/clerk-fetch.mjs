// Test-only HTTPS boundary fixture. Production never imports this file.
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync('/dev/shm/ga-clerk-fixture.json', 'utf8'));
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname === 'api.clerk.com') {
    if (url.pathname === '/v1/jwks') {
      return Response.json({ keys: [fixture.jwk] });
    }
    const match = url.pathname.match(/^\/v1\/users\/user_([a-z-]+)$/);
    if (match) {
      const name = match[1];
      const subject = name === 'same-email' ? 'different-subject' : `google-${name}`;
      const email = `${name === 'same-email' ? 'alice' : name}@example.com`;
      return Response.json({
        id: `user_${name}`,
        object: 'user',
        first_name: name,
        last_name: '',
        primary_email_address_id: `email_${name}`,
        created_at: Date.now(),
        updated_at: Date.now(),
        email_addresses: [{ id: `email_${name}`, object: 'email_address', email_address: email, verification: { status: 'verified', strategy: 'from_oauth_google' }, linked_to: [] }],
        external_accounts: name === 'no-google' ? [] : [{ id: `eac_${name}`, object: 'external_account', provider: 'oauth_google', provider_user_id: subject, email_address: email, verification: { status: name === 'unverified' ? 'unverified' : 'verified', strategy: 'oauth_google' } }],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
      });
    }
    throw new Error(`Unexpected Clerk fixture API request: ${url.pathname}`);
  }
  if (url.hostname === 'clerk.fixture.test') {
    throw new Error(`Unexpected Clerk FAPI request: ${url.pathname}`);
  }
  return originalFetch(input, init);
};
