/**
 * One-time demo account for client pitches.
 * Run: npm run seed:demo
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "../src/generated/prisma/client";

const DEMO_EMAIL = "demo@prolinexgoal.demo";
const DEMO_USERNAME = "DemoPlayer";
const DEMO_PASSWORD = "DemoGoal26!";
const DEMO_BALANCE = 10_000;

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DIRECT_URL or DATABASE_URL");

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      username: DEMO_USERNAME,
      passwordHash,
      balance: DEMO_BALANCE,
      currency: "USD",
      referralCode: "DEMO2026",
    },
    update: {
      passwordHash,
      balance: DEMO_BALANCE,
      currency: "USD",
      accountFrozen: false,
    },
  });

  console.log("Demo account ready:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Balance:  ${DEMO_BALANCE} USD`);
  console.log(`  User id:  ${user.id}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
