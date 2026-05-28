import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { SentinelGateService } from './sentinelgate.service';
import { isPaymentSimulationAllowed } from '../config/wallet-env';
import { isProductionNode } from '../config/production-guard';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sentinelgate: SentinelGateService,
  ) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, currency: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const balance = Number(user.balance);
    return {
      balance,
      currency: user.currency,
      playableBalance: balance,
    };
  }

  async deposit(userId: string, amount: number, paymentMethod: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.accountFrozen) {
      throw new BadRequestException('Account is suspended');
    }

    if (
      isProductionNode() &&
      process.env.PAYMENT_SIMULATION_INSTANT === 'true'
    ) {
      throw new ServiceUnavailableException(
        'Payment simulation is disabled in production',
      );
    }

    const method = paymentMethod.toLowerCase();
    if (method === 'card' || method === 'sentinelgate') {
      return this.depositSentinelGate(user, amount);
    }

    return this.depositLegacy(user, amount, paymentMethod);
  }

  private async depositSentinelGate(
    user: { id: string; email: string; balance: unknown },
    amount: number,
  ) {
    const forceSimulation = isPaymentSimulationAllowed();
    const useSentinelgate = this.sentinelgate.isEnabled() && !forceSimulation;

    if (isProductionNode() && !this.sentinelgate.isEnabled()) {
      throw new ServiceUnavailableException(
        'Card payments are not configured',
      );
    }

    if (!useSentinelgate) {
      throw new ServiceUnavailableException(
        'SentinelGate is not configured for card deposits',
      );
    }

    const tx = await this.prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'deposit',
        amount,
        balanceAfter: Number(user.balance),
        txStatus: 'pending',
      },
    });

    const session = await this.sentinelgate.createHostedCheckoutSession({
      userId: user.id,
      email: user.email,
      transactionId: tx.id,
      amount,
    });

    const paymentUrl = session.redirect_url ?? session.hosted_url;
    if (!paymentUrl) {
      throw new ServiceUnavailableException(
        'SentinelGate did not return a checkout URL',
      );
    }

    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: { referenceId: session.sentinel_transaction_id },
    });

    return {
      transactionId: tx.id,
      status: 'pending',
      amount,
      paymentUrl,
      paymentMethod: 'card',
      provider: 'sentinelgate' as const,
    };
  }

  private async depositLegacy(
    user: { id: string; balance: unknown },
    amount: number,
    paymentMethod: string,
  ) {
    const forceSimulation = isPaymentSimulationAllowed();
    const simulateInstant =
      forceSimulation ||
      (!isProductionNode() &&
        !this.sentinelgate.isEnabled() &&
        process.env.PAYMENT_SIMULATION_INSTANT !== 'false');

    if (!simulateInstant) {
      const tx = await this.prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'deposit',
          amount,
          balanceAfter: Number(user.balance),
          txStatus: 'pending',
        },
      });
      const paymentBase = process.env.PAYMENT_BASE_URL?.replace(/\/$/, '');
      return {
        transactionId: tx.id,
        status: 'pending',
        amount,
        paymentUrl: paymentBase ? `${paymentBase}/pay/${tx.id}` : null,
        paymentMethod,
        provider: 'manual' as const,
        webhookHint:
          'POST /api/webhooks/payment/deposit-confirmed with transactionId, eventId, and X-Payment-Webhook-Secret',
      };
    }

    const newBalance = Number(user.balance) + amount;
    const [, created] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { balance: newBalance },
      }),
      this.prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'deposit',
          amount,
          balanceAfter: newBalance,
          txStatus: 'completed',
        },
      }),
    ]);

    return {
      transactionId: created.id,
      status: 'completed',
      amount,
      paymentUrl: null,
      paymentMethod,
      provider: 'simulation' as const,
    };
  }

  async withdraw(userId: string, amount: number, payoutMethod: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.accountFrozen) {
      throw new BadRequestException('Account is suspended');
    }

    const available = await this.getAvailableBalance(userId, Number(user.balance));
    if (available < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'withdraw',
        amount: -amount,
        balanceAfter: Number(user.balance),
        txStatus: 'pending',
      },
    });

    return {
      transactionId: tx.id,
      status: 'pending',
      amount,
      payoutMethod,
      webhookHint:
        'POST /api/webhooks/payment/withdraw-confirmed with transactionId, eventId, and X-Payment-Webhook-Secret',
    };
  }

  private async getAvailableBalance(
    userId: string,
    currentBalance: number,
  ): Promise<number> {
    const pending = await this.prisma.transaction.aggregate({
      where: { userId, type: 'withdraw', txStatus: 'pending' },
      _sum: { amount: true },
    });
    const reserved = Math.abs(Number(pending._sum.amount ?? 0));
    return currentBalance - reserved;
  }

  async getTransactions(
    userId: string,
    page: number,
    limit: number,
    type?: string,
  ) {
    const where: Prisma.TransactionWhereInput = { userId };
    if (type) where.type = type as Prisma.TransactionWhereInput['type'];
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balance: Number(t.balanceAfter),
        status: t.txStatus,
        createdAt: t.createdAt,
      })),
      total,
      page,
    };
  }
}
