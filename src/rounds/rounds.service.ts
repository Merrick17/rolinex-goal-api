import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class RoundsService {
  private serverSeed: string;
  currentMultiplier = 1.0;

  constructor(private readonly prisma: PrismaService) {
    this.rotateServerSeed();
  }

  rotateServerSeed() {
    this.serverSeed = crypto.randomBytes(32).toString('hex');
  }

  generateCrashPoint(roundId: string): {
    crashPoint: number;
    crashType: string;
  } {
    const hmac = crypto
      .createHmac('sha256', this.serverSeed)
      .update(roundId)
      .digest('hex');
    const hashPrefix = parseInt(hmac.slice(0, 8), 16);
    const probability = hashPrefix / 0xffffffff;
    const crashPoint = Math.max(
      1.0,
      +(0.97 * (1 / (1 - probability))).toFixed(2),
    );
    const types = ['post', 'miss', 'save'];
    const crashType = types[hashPrefix % types.length];
    return { crashPoint, crashType };
  }

  async getCurrentRound() {
    return this.prisma.round.findFirst({
      where: { status: { in: ['waiting', 'flying'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHistory(page: number, limit: number) {
    const [rounds, total] = await Promise.all([
      this.prisma.round.findMany({
        where: { status: 'crashed' },
        orderBy: { roundNumber: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          bets: true,
        },
      }),
      this.prisma.round.count({ where: { status: 'crashed' } }),
    ]);

    return {
      rounds: rounds.map((r) => {
        const totalBets = r.bets.reduce((sum, b) => sum + Number(b.amount), 0);
        return {
          roundId: r.id,
          roundNumber: r.roundNumber,
          crashPoint: Number(r.crashPoint),
          phase: r.status,
          crashType: r.crashType,
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          playerCount: r.bets.length,
          totalBets,
        };
      }),
      total,
      page,
    };
  }

  async getRoundDetails(roundId: string) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: { bets: { include: { user: { select: { username: true } } } } },
    });
    if (!round) return null;
    return {
      roundId: round.id,
      roundNumber: round.roundNumber,
      crashPoint: Number(round.crashPoint),
      crashType: round.crashType,
      startedAt: round.startedAt,
      endedAt: round.endedAt,
      bets: round.bets.map((b) => ({
        userId: b.userId,
        username: b.user.username,
        amount: Number(b.amount),
        cashoutMultiplier: b.cashoutMultiplier
          ? Number(b.cashoutMultiplier)
          : null,
        winnings: b.winnings ? Number(b.winnings) : null,
        cashedOut: b.status === 'won',
      })),
    };
  }
}
