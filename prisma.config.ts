import 'dotenv/config';
import { defineConfig } from 'prisma/config';

function getDatasourceUrl(): string {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'Set DIRECT_URL or DATABASE_URL before running Prisma (migrate deploy / generate).',
    );
  }
  return url;
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
