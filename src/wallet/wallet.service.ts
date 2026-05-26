import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, currency: true },
    });
    if (!user) throw new Error('User not found');
    return { balance: Number(user.balance), currency: user.currency };
  }

  async deposit(userId: string, amount: number, paymentMethod: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = paymentMethod;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const newBalance = Number(user.balance) + amount;
    await this.prisma.user.update({
      where: { id: userId },
      data: { balance: newBalance },
    });
    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'deposit',
        amount,
        balanceAfter: newBalance,
      },
    });
    return {
      transactionId: tx.id,
      status: 'pending',
      amount,
      paymentUrl: 'https://payment.example.com/pay/' + tx.id,
    };
  }

  async withdraw(userId: string, amount: number, payoutMethod: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = payoutMethod;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (Number(user.balance) < amount) {
      throw new Error('INSUFFICIENT_BALANCE');
    }
    const newBalance = Number(user.balance) - amount;
    await this.prisma.user.update({
      where: { id: userId },
      data: { balance: newBalance },
    });
    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'withdraw',
        amount: -amount,
        balanceAfter: newBalance,
      },
    });
    return { transactionId: tx.id, status: 'processing', amount };
  }

  async getTransactions(
    userId: string,
    page: number,
    limit: number,
    type?: string,
  ) {
    const where: Prisma.TransactionWhereInput = { userId };
    if (type) (where as Record<string, unknown>).type = type;
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
        createdAt: t.createdAt,
      })),
      total,
      page,
    };
  }
}
