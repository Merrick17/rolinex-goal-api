import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface LeaderboardEntry {
  userId: string;
  username: string;
  totalWinnings: number;
  bestMultiplier: number;
  roundsWon: number;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async weekly(page: number, limit: number) {
    const startOfWeek = new Date();
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());
    startOfWeek.setUTCHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 7);
    endOfWeek.setUTCHours(23, 59, 59, 999);

    const bets = await this.prisma.bet.findMany({
      where: {
        status: 'won',
        createdAt: { gte: startOfWeek, lte: endOfWeek },
      },
      include: { user: { select: { id: true, username: true } } },
    });

    const stats = new Map<string, LeaderboardEntry>();
    for (const b of bets) {
      const existing = stats.get(b.userId);
      const next: LeaderboardEntry = existing
        ? {
            ...existing,
            totalWinnings: existing.totalWinnings + Number(b.winnings),
            roundsWon: existing.roundsWon + 1,
            bestMultiplier: Math.max(
              existing.bestMultiplier,
              Number(b.cashoutMultiplier),
            ),
          }
        : {
            userId: b.user.id,
            username: b.user.username,
            totalWinnings: Number(b.winnings),
            bestMultiplier: Number(b.cashoutMultiplier),
            roundsWon: 1,
          };
      stats.set(b.userId, next);
    }

    const board = Array.from(stats.values())
      .sort((a, b) => b.totalWinnings - a.totalWinnings)
      .map((s, i) => ({ rank: i + 1, ...s }));

    return {
      leaderboard: board.slice((page - 1) * limit, page * limit),
      total: board.length,
      page,
      resetsAt: endOfWeek,
    };
  }

  async allTime(page: number, limit: number) {
    const bets = await this.prisma.bet.findMany({
      where: { status: 'won' },
      include: { user: { select: { id: true, username: true } } },
    });

    const stats = new Map<string, LeaderboardEntry>();
    for (const b of bets) {
      const existing = stats.get(b.userId);
      const next: LeaderboardEntry = existing
        ? {
            ...existing,
            totalWinnings: existing.totalWinnings + Number(b.winnings),
            roundsWon: existing.roundsWon + 1,
            bestMultiplier: Math.max(
              existing.bestMultiplier,
              Number(b.cashoutMultiplier),
            ),
          }
        : {
            userId: b.user.id,
            username: b.user.username,
            totalWinnings: Number(b.winnings),
            bestMultiplier: Number(b.cashoutMultiplier),
            roundsWon: 1,
          };
      stats.set(b.userId, next);
    }

    const board = Array.from(stats.values())
      .sort((a, b) => b.totalWinnings - a.totalWinnings)
      .map((s, i) => ({ rank: i + 1, ...s }));

    return {
      leaderboard: board.slice((page - 1) * limit, page * limit),
      total: board.length,
      page,
    };
  }

  async me(userId: string) {
    const weeklyBoard = (await this.weekly(1, Number.MAX_SAFE_INTEGER))
      .leaderboard;
    const allTimeBoard = (await this.allTime(1, Number.MAX_SAFE_INTEGER))
      .leaderboard;
    const weeklyEntry = weeklyBoard.find((d) => d.userId === userId);
    const allTimeEntry = allTimeBoard.find((d) => d.userId === userId);
    return {
      weekly: weeklyEntry
        ? {
            rank: weeklyEntry.rank,
            totalWinnings: weeklyEntry.totalWinnings,
            bestMultiplier: weeklyEntry.bestMultiplier,
          }
        : null,
      allTime: allTimeEntry
        ? {
            rank: allTimeEntry.rank,
            totalWinnings: allTimeEntry.totalWinnings,
            bestMultiplier: allTimeEntry.bestMultiplier,
          }
        : null,
    };
  }
}
