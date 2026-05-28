import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { BetsService } from './bets.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BetsService', () => {
  let service: BetsService;
  let prisma: {
    round: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock; update: jest.Mock };
    bet: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    transaction: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const round = {
    id: 'round-1',
    roundNumber: 42,
    status: 'waiting',
    crashPoint: 2.5,
  };

  const user = {
    id: 'user-1',
    balance: 500,
    accountFrozen: false,
  };

  beforeEach(() => {
    prisma = {
      round: {
        findUnique: jest.fn().mockResolvedValue(round),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn(),
      },
      bet: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'bet-1',
          roundId: 'round-1',
          amount: 50,
          autoCashout: null,
          status: 'active',
          createdAt: new Date(),
        }),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      transaction: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
    };
    service = new BetsService(prisma as unknown as PrismaService);
  });

  describe('placeBet', () => {
    it('deducts balance and records bet transaction', async () => {
      const result = await service.placeBet('user-1', 'round-1', 50);
      expect(result).toMatchObject({
        betId: 'bet-1',
        amount: 50,
        newBalance: 450,
        roundNumber: 42,
      });
      expect(prisma.bet.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          roundId: 'round-1',
          amount: 50,
          autoCashout: null,
        },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('rejects bet when round is not waiting', async () => {
      prisma.round.findUnique.mockResolvedValue({ ...round, status: 'flying' });
      await expect(
        service.placeBet('user-1', 'round-1', 50),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects duplicate bet in same round', async () => {
      prisma.bet.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.placeBet('user-1', 'round-1', 50),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects bet when balance is insufficient', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, balance: 10 });
      await expect(
        service.placeBet('user-1', 'round-1', 50),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cashout', () => {
    it('credits winnings at current multiplier', async () => {
      prisma.bet.findFirst.mockResolvedValue({
        id: 'bet-1',
        userId: 'user-1',
        amount: 50,
        status: 'active',
        round: { status: 'flying', crashPoint: 3 },
      });

      const result = await service.cashout('user-1', 'bet-1', 2);
      expect(result).toMatchObject({
        betId: 'bet-1',
        cashoutMultiplier: 2,
        winnings: 100,
        newBalance: 600,
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
