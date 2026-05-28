import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import {
  DEMO_DATABASE_URL,
  DEMO_DIRECT_URL,
} from './src/config/demo-hardcoded';

const BUILD_PLACEHOLDER =
  'postgresql://build:build@127.0.0.1:5432/build';

function getDatasourceUrl(): string {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
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
