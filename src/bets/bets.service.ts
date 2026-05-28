import {
  ConflictException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BetsService {
  constructor(private readonly prisma: PrismaService) {}

  async placeBet(
    userId: string,
    roundId: string,
    amount: number,
    autoCashout?: number,
  ) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
    });
    if (!round || round.status !== 'waiting') {
      throw new BadRequestException('Round not active');
    }
    if (amount < 10 || amount > 5000) {
      throw new BadRequestException('Bet amount out of range');
    }
    if (autoCashout !== undefined && autoCashout < 1.01) {
      throw new BadRequestException('Auto cashout must be at least 1.01');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.accountFrozen) {
      throw new BadRequestException('Account is suspended');
    }
    if (Number(user.balance) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const existing = await this.prisma.bet.findFirst({
      where: { userId, roundId },
    });
    if (existing) {
      throw new ConflictException('Already placed a bet this round');
    }

    const newBalance = Number(user.balance) - amount;
    const [bet] = await this.prisma.$transaction([
      this.prisma.bet.create({
        data: {
          userId,
          roundId,
          amount,
          autoCashout: autoCashout ? autoCashout : null,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { balance: newBalance },
      }),
      this.prisma.transaction.create({
        data: {
          userId,
          type: 'bet',
          amount: -amount,
          balanceAfter: newBalance,
          referenceId: null,
          txStatus: 'completed',
        },
      }),
    ]);

    return {
      betId: bet.id,
      roundId: bet.roundId,
      roundNumber: round.roundNumber,
      amount: Number(bet.amount),
      autoCashout: bet.autoCashout ? Number(bet.autoCashout) : null,
      status: bet.status,
      newBalance,
      createdAt: bet.createdAt,
    };
  }

  async cashout(userId: string, betId: string, currentMultiplier: number) {
    const bet = await this.prisma.bet.findFirst({
      where: { id: betId, userId, status: 'active' },
      include: { round: true },
    });
    if (!bet || bet.round.status !== 'flying') {
      throw new BadRequestException('Bet not found or round already crashed');
    }

    const winnings = Number(
      (Number(bet.amount) * currentMultiplier).toFixed(2),
    );
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.accountFrozen) {
      throw new BadRequestException('Account is suspended');
    }

    const updatedBalance = Number((Number(user.balance) + winnings).toFixed(2));

    await this.prisma.$transaction([
      this.prisma.bet.update({
        where: { id: betId },
        data: {
          status: 'won',
          cashoutMultiplier: currentMultiplier,
          winnings,
          cashedOutAt: new Date(),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { balance: updatedBalance },
      }),
      this.prisma.transaction.create({
        data: {
          userId,
          type: 'win',
          amount: winnings,
          balanceAfter: updatedBalance,
          referenceId: null,
          txStatus: 'completed',
        },
      }),
    ]);

    return {
      betId,
      cashoutMultiplier: currentMultiplier,
      winnings,
      newBalance: updatedBalance,
    };
  }

  async getUserBets(
    userId: string,
    page: number,
    limit: number,
    status?: string,
  ) {
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    const [bets, total] = await Promise.all([
      this.prisma.bet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { round: true },
      }),
      this.prisma.bet.count({ where }),
    ]);

    return {
      bets: bets.map((b) => ({
        betId: b.id,
        roundNumber: b.round.roundNumber,
        amount: Number(b.amount),
        cashoutMultiplier: b.cashoutMultiplier
          ? Number(b.cashoutMultiplier)
          : null,
        winnings: b.winnings ? Number(b.winnings) : null,
        status: b.status,
        crashPoint: b.round.crashPoint ? Number(b.round.crashPoint) : null,
        createdAt: b.createdAt,
      })),
      total,
      page,
    };
  }
}
