import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { WalletService } from '../../src/wallet/wallet.service';
import { BetsService } from '../../src/bets/bets.service';
import { SentinelGateService } from '../../src/wallet/sentinelgate.service';

const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const describeIfDb = dbUrl ? describe : describe.skip;

describeIfDb('Wallet + bets flow (integration)', () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let wallet: WalletService;
  let bets: BetsService;
  let userId: string;
  let roundId: string;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const sentinelgate = { isEnabled: () => false } as SentinelGateService;
    wallet = new WalletService(prisma as never, sentinelgate);
    bets = new BetsService(prisma as never);

    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_SIMULATION_INSTANT = 'true';

    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const user = await prisma.user.create({
      data: {
        email: `test-${suffix}@integration.local`,
        username: `test_${suffix}`.slice(0, 20),
        passwordHash,
        balance: 0,
        currency: 'USD',
      },
    });
    userId = user.id;

    const round = await prisma.round.create({
      data: {
        roundNumber: 9_000_000 + Math.floor(Math.random() * 1000),
        crashPoint: 2.5,
        crashType: 'post',
        serverSeedHash: 'integration-test-hash',
        status: 'waiting',
      },
    });
    roundId = round.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.transaction.deleteMany({ where: { userId } });
      await prisma.bet.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    if (roundId) {
      await prisma.round.delete({ where: { id: roundId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it('deposit → balance → place bet deducts cash', async () => {
    const deposit = await wallet.deposit(userId, 100, 'manual');
    expect(deposit.status).toBe('completed');

    const balance = await wallet.getBalance(userId);
    expect(balance.playableBalance).toBe(100);

    const placed = await bets.placeBet(userId, roundId, 40);
    expect(placed.newBalance).toBe(60);

    const after = await wallet.getBalance(userId);
    expect(after.playableBalance).toBe(60);
  });

  it('withdraw queues without debiting balance; reserves available amount', async () => {
    const withdraw = await wallet.withdraw(userId, 10, 'bank_transfer');
    expect(withdraw.status).toBe('pending');

    const balance = await wallet.getBalance(userId);
    expect(balance.balance).toBe(60);

    await expect(
      wallet.withdraw(userId, 55, 'bank_transfer'),
    ).rejects.toThrow('Insufficient balance');
  });
});
