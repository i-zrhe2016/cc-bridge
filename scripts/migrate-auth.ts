import { migrateAuth, migrateWorkspace } from '../src/server/database.ts';

migrateAuth();
migrateWorkspace();
console.log('Application principal, Clerk binding and workspace migrations complete.');
