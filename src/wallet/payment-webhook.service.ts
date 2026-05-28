import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const AMOUNT_TOLERANCE = 0.01;

@Injectable()
export class PaymentWebhookService {
  constructor(private readonly prisma: PrismaService) {}

  amountsMatch(expected: number, paid: number): boolean {
    return Math.abs(expected - paid) <= AMOUNT_TOLERANCE;
  }

  async handleDepositConfirmed(
    eventId: string,
    transactionId: string,
    paidAmount?: number,
  ) {
    const existing = await this.prisma.webhookDelivery.findUnique({
      where: { eventKey: eventId },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.type !== 'deposit') {
      throw new BadRequestException('Not a deposit transaction');
    }
    if (tx.txStatus !== 'pending') {
      return { ok: true, duplicate: true, reason: 'already_completed' };
    }

    const amount = Number(tx.amount);
    if (amount <= 0) throw new BadRequestException('Invalid deposit amount');

    if (
      paidAmount !== undefined &&
      !this.amountsMatch(amount, paidAmount)
    ) {
      await this.prisma.$transaction([
        this.prisma.webhookDelivery.create({
          data: { eventKey: eventId },
        }),
        this.prisma.transaction.update({
          where: { id: transactionId },
          data: { txStatus: 'failed' },
        }),
      ]);
      return { ok: false, reason: 'amount_mismatch' };
    }

    const user = tx.user;
    const newBalance = Number(user.balance) + amount;

    await this.prisma.$transaction([
      this.prisma.webhookDelivery.create({
        data: { eventKey: eventId },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { balance: newBalance },
      }),
      this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          txStatus: 'completed',
          balanceAfter: newBalance,
        },
      }),
    ]);

    return { ok: true, duplicate: false, newBalance };
  }

  async handleDepositFailed(eventId: string, transactionId: string) {
    const existing = await this.prisma.webhookDelivery.findUnique({
      where: { eventKey: eventId },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.type !== 'deposit') {
      throw new BadRequestException('Not a deposit transaction');
    }
    if (tx.txStatus !== 'pending') {
      return { ok: true, duplicate: true, reason: 'not_pending' };
    }

    await this.prisma.$transaction([
      this.prisma.webhookDelivery.create({
        data: { eventKey: eventId },
      }),
      this.prisma.transaction.update({
        where: { id: transactionId },
        data: { txStatus: 'failed' },
      }),
    ]);

    return { ok: true, duplicate: false };
  }

  async handleDepositRefunded(
    eventId: string,
    transactionId: string,
    refundAmountMajor: number,
  ) {
    const existing = await this.prisma.webhookDelivery.findUnique({
      where: { eventKey: eventId },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    if (refundAmountMajor <= 0) {
      throw new BadRequestException('Invalid refund amount');
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.type !== 'deposit') {
      throw new BadRequestException('Not a deposit transaction');
    }
    if (tx.txStatus !== 'completed') {
      await this.prisma.webhookDelivery.create({
        data: { eventKey: eventId },
      });
      return { ok: true, skipped: true, reason: 'deposit_not_completed' };
    }

    const user = tx.user;
    const currentBalance = Number(user.balance);
    const debit = Math.min(refundAmountMajor, currentBalance);
    const newBalance = currentBalance - debit;

    await this.prisma.$transaction([
      this.prisma.webhookDelivery.create({
        data: { eventKey: eventId },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { balance: newBalance },
      }),
      this.prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'deposit',
          amount: -debit,
          balanceAfter: newBalance,
          txStatus: 'completed',
          referenceId: `refund:${transactionId}`,
        },
      }),
    ]);

    return { ok: true, duplicate: false, newBalance, debited: debit };
  }

  async handleDepositDispute(eventId: string, transactionId: string) {
    const existing = await this.prisma.webhookDelivery.findUnique({
      where: { eventKey: eventId },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.type !== 'deposit') {
      throw new BadRequestException('Not a deposit transaction');
    }

    await this.prisma.$transaction([
      this.prisma.webhookDelivery.create({
        data: { eventKey: eventId },
      }),
      this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          referenceId: tx.referenceId
            ? `${tx.referenceId}:disputed`
            : 'disputed',
        },
      }),
    ]);

    return { ok: true, duplicate: false, flagged: true };
  }

  async handleWithdrawConfirmed(eventId: string, transactionId: string) {
    const existing = await this.prisma.webhookDelivery.findUnique({
      where: { eventKey: eventId },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.type !== 'withdraw') {
      throw new BadRequestException('Not a withdraw transaction');
    }
    if (tx.txStatus !== 'pending') {
      return { ok: true, duplicate: true, reason: 'already_completed' };
    }

    const amount = Math.abs(Number(tx.amount));
    if (amount <= 0) throw new BadRequestException('Invalid withdraw amount');

    const user = tx.user;
    if (Number(user.balance) < amount) {
      await this.prisma.$transaction([
        this.prisma.webhookDelivery.create({
          data: { eventKey: eventId },
        }),
        this.prisma.transaction.update({
          where: { id: transactionId },
          data: { txStatus: 'failed' },
        }),
      ]);
      return { ok: false, reason: 'insufficient_balance' };
    }

    const newBalance = Number(user.balance) - amount;

    await this.prisma.$transaction([
      this.prisma.webhookDelivery.create({
        data: { eventKey: eventId },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { balance: newBalance },
      }),
      this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          txStatus: 'completed',
          balanceAfter: newBalance,
        },
      }),
    ]);

    return { ok: true, duplicate: false, newBalance };
  }

  async handleWithdrawFailed(eventId: string, transactionId: string) {
    const existing = await this.prisma.webhookDelivery.findUnique({
      where: { eventKey: eventId },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.type !== 'withdraw') {
      throw new BadRequestException('Not a withdraw transaction');
    }
    if (tx.txStatus !== 'pending') {
      return { ok: true, duplicate: true, reason: 'not_pending' };
    }

    await this.prisma.$transaction([
      this.prisma.webhookDelivery.create({
        data: { eventKey: eventId },
      }),
      this.prisma.transaction.update({
        where: { id: transactionId },
        data: { txStatus: 'failed' },
      }),
    ]);

    return { ok: true, duplicate: false };
  }

  async findDepositByPaymentReference(
    paymentIntentId: string | null | undefined,
    chargeId: string | null | undefined,
  ) {
    if (paymentIntentId) {
      const byPi = await this.prisma.transaction.findFirst({
        where: {
          type: 'deposit',
          referenceId: paymentIntentId,
        },
      });
      if (byPi) return byPi;
    }
    if (chargeId) {
      const byCharge = await this.prisma.transaction.findFirst({
        where: {
          type: 'deposit',
          referenceId: chargeId,
        },
      });
      if (byCharge) return byCharge;
    }
    return null;
  }
}
