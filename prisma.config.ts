import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const BUILD_PLACEHOLDER =
  'postgresql://build:build@127.0.0.1:5432/build';

/** Keep in sync with src/config/demo-hardcoded.ts (not imported — absent in Docker runner before npm ci). */
const DEMO_DATABASE_URL =
  'postgresql://postgres.icwrnjvvvtgfwioszvts:01161590Safwen@@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const DEMO_DIRECT_URL =
  'postgresql://postgres.icwrnjvvvtgfwioszvts:01161590Safwen@@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';

function getDatasourceUrl(): string {
  const url =
    process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (url) return url;
  if (process.env.npm_lifecycle_event === 'postinstall') {
    return BUILD_PLACEHOLDER;
  }
  return DEMO_DIRECT_URL || DEMO_DATABASE_URL;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: getDatasourceUrl(),
  },
});
