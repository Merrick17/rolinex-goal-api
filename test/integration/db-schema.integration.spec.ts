import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../src/generated/prisma/client';

const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const describeIfDb = dbUrl ? describe : describe.skip;

describeIfDb('Database schema (integration)', () => {
  let prisma: PrismaClient;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it('users table has no legacy kyc/echips columns', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
    `;
    const names = columns.map((c) => c.column_name);
    expect(names).toContain('balance');
    expect(names).toContain('currency');
    expect(names).not.toContain('kyc_status');
    expect(names).not.toContain('token_balance');
  });

  it('bets table has no wallet_source column', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bets'
    `;
    const names = columns.map((c) => c.column_name);
    expect(names).not.toContain('wallet_source');
  });

  it('kyc_submissions table was removed', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'kyc_submissions'
    `;
    expect(tables).toHaveLength(0);
  });

  it('TransactionType enum has no token_deposit', async () => {
    const values = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'TransactionType'
      ORDER BY e.enumsortorder
    `;
    const labels = values.map((v) => v.enumlabel);
    expect(labels).toEqual([
      'deposit',
      'withdraw',
      'bet',
      'win',
      'admin_credit',
      'admin_debit',
    ]);
  });
});
