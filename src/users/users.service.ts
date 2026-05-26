import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new Error('User not found');
    const stats = await this.getStats(userId);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      balance: Number(user.balance),
      currency: user.currency,
      totalBets: stats.totalBets,
      totalWon: stats.totalWon,
      bestMultiplier: stats.bestMultiplier,
      createdAt: user.createdAt,
      kycStatus: user.kycStatus,
    };
  }

  async updateProfile(userId: string, updates: { username?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updates,
    });
    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  }

  private async getStats(userId: string) {
    const bets = await this.prisma.bet.findMany({
      where: { userId },
    });
    const wonBets = bets.filter((b) => b.status === 'won');
    let totalWon = 0;
    let bestMultiplier: number | null = null;
    for (const b of wonBets) {
      totalWon += Number(b.winnings ?? 0);
      const mult = b.cashoutMultiplier ? Number(b.cashoutMultiplier) : 0;
      if (bestMultiplier === null || mult > bestMultiplier) {
        bestMultiplier = mult;
      }
    }
    return {
      totalBets: bets.length,
      totalWon,
      bestMultiplier,
    };
  }
}
