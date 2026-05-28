import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const BUILD_PLACEHOLDER =
  'postgresql://build:build@127.0.0.1:5432/build';

function getDatasourceUrl(): string {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (url) return url;
  // `prisma generate` during Docker/CI build — no live DB required
  if (process.env.npm_lifecycle_event === 'postinstall') {
    return BUILD_PLACEHOLDER;
  }
  throw new Error(
    'Set DIRECT_URL or DATABASE_URL before running Prisma (migrate deploy / generate).',
  );
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
