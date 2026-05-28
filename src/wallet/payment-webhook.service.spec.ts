import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentWebhookService } from './payment-webhook.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentWebhookService', () => {
  let service: PaymentWebhookService;
  let prisma: {
    webhookDelivery: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    transaction: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    user: {
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const pendingDeposit = {
    id: 'tx-1',
    userId: 'user-1',
    type: 'deposit' as const,
    amount: 100,
    balanceAfter: 0,
    txStatus: 'pending' as const,
    referenceId: 'cs_test',
    user: { id: 'user-1', balance: 50 },
  };

  beforeEach(() => {
    prisma = {
      webhookDelivery: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'wd-1', eventKey: data.eventKey }),
        ),
      },
      transaction: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
    };

    service = new PaymentWebhookService(prisma as unknown as PrismaService);
  });

  describe('handleDepositConfirmed', () => {
    it('credits balance once and is idempotent on duplicate eventId', async () => {
      prisma.transaction.findUnique.mockResolvedValue(pendingDeposit);

      const first = await service.handleDepositConfirmed('evt-1', 'tx-1', 100);
      expect(first).toMatchObject({ ok: true, duplicate: false, newBalance: 150 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      prisma.webhookDelivery.findUnique.mockResolvedValue({ eventKey: 'evt-1' });
      const second = await service.handleDepositConfirmed('evt-1', 'tx-1', 100);
      expect(second).toMatchObject({ ok: true, duplicate: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('marks deposit failed when paid amount does not match', async () => {
      prisma.transaction.findUnique.mockResolvedValue(pendingDeposit);

      const result = await service.handleDepositConfirmed('evt-2', 'tx-1', 99);
      expect(result).toMatchObject({ ok: false, reason: 'amount_mismatch' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { txStatus: 'failed' },
      });
    });

    it('throws when transaction is missing', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);
      await expect(
        service.handleDepositConfirmed('evt-3', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('handleDepositFailed', () => {
    it('marks pending deposit as failed idempotently', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        ...pendingDeposit,
        user: undefined,
      });

      const first = await service.handleDepositFailed('evt-fail-1', 'tx-1');
      expect(first).toMatchObject({ ok: true, duplicate: false });

      prisma.webhookDelivery.findUnique.mockResolvedValue({ eventKey: 'evt-fail-1' });
      const second = await service.handleDepositFailed('evt-fail-1', 'tx-1');
      expect(second).toMatchObject({ ok: true, duplicate: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleDepositRefunded', () => {
    it('debits balance and records compensating transaction idempotently', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        ...pendingDeposit,
        txStatus: 'completed',
        user: { id: 'user-1', balance: 150 },
      });

      const first = await service.handleDepositRefunded('evt-ref-1', 'tx-1', 40);
      expect(first).toMatchObject({
        ok: true,
        duplicate: false,
        newBalance: 110,
        debited: 40,
      });

      prisma.webhookDelivery.findUnique.mockResolvedValue({ eventKey: 'evt-ref-1' });
      const second = await service.handleDepositRefunded('evt-ref-1', 'tx-1', 40);
      expect(second).toMatchObject({ ok: true, duplicate: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid refund amounts', async () => {
      await expect(
        service.handleDepositRefunded('evt-ref-2', 'tx-1', 0),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('amountsMatch', () => {
    it('allows minor floating-point drift', () => {
      expect(service.amountsMatch(100, 100.005)).toBe(true);
      expect(service.amountsMatch(100, 100.02)).toBe(false);
    });
  });
});
