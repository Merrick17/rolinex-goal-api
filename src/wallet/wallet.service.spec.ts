import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { SentinelGateService } from './sentinelgate.service';

describe('WalletService', () => {
  let service: WalletService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    transaction: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      aggregate: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let sentinelgate: { isEnabled: jest.Mock; createHostedCheckoutSession: jest.Mock };

  const user = {
    id: 'user-1',
    email: 'player@example.com',
    balance: 200,
    currency: 'USD',
    accountFrozen: false,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({ ...user, balance: 300 }),
      },
      transaction: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'tx-new', ...data }),
        ),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
    };
    sentinelgate = {
      isEnabled: jest.fn().mockReturnValue(false),
      createHostedCheckoutSession: jest.fn(),
    };
    service = new WalletService(
      prisma as unknown as PrismaService,
      sentinelgate as unknown as SentinelGateService,
    );
    delete process.env.PAYMENT_SIMULATION_INSTANT;
    process.env.NODE_ENV = 'test';
  });

  describe('getBalance', () => {
    it('returns cash balance as playableBalance', async () => {
      const result = await service.getBalance('user-1');
      expect(result).toEqual({
        balance: 200,
        currency: 'USD',
        playableBalance: 200,
      });
    });

    it('throws when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getBalance('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deposit', () => {
    it('credits instantly in simulation mode for non-card methods', async () => {
      process.env.PAYMENT_SIMULATION_INSTANT = 'true';
      const result = await service.deposit('user-1', 100, 'manual');
      expect(result).toMatchObject({
        status: 'completed',
        amount: 100,
        provider: 'simulation',
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('requires SentinelGate when card is requested and PSP is disabled', async () => {
      process.env.PAYMENT_SIMULATION_INSTANT = 'false';
      await expect(service.deposit('user-1', 50, 'card')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('rejects deposits for frozen accounts', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, accountFrozen: true });
      await expect(service.deposit('user-1', 10, 'manual')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('withdraw', () => {
    it('creates pending withdraw without debiting balance', async () => {
      const result = await service.withdraw('user-1', 50, 'bank_transfer');
      expect(result).toMatchObject({
        status: 'pending',
        amount: 50,
        payoutMethod: 'bank_transfer',
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'withdraw',
            txStatus: 'pending',
            amount: -50,
          }),
        }),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects withdraw when available balance is too low', async () => {
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: -150 },
      });
      await expect(
        service.withdraw('user-1', 100, 'bank_transfer'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
