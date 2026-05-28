import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Direct connection for migrate/introspect (Supabase pooler needs DIRECT_URL)
    url: env("DIRECT_URL"),
  },
});
