import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoundsService } from '../rounds/rounds.service';
import { BetsService } from '../bets/bets.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { EventEmitter } from 'events';

export type RoundPhase = 'waiting' | 'flying' | 'crashed';

@Injectable()
export class GameEngineService extends EventEmitter {
  private currentRound: {
    id: string;
    roundNumber: number;
    crashPoint: number;
    startTime: number;
  } | null = null;
  private phase: RoundPhase = 'waiting';
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private multiplier = 1.0;
  private countdown = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly roundsService: RoundsService,
    private readonly betsService: BetsService,
    private readonly leaderboardService: LeaderboardService,
  ) {
    super();
  }

  async startRoundLifecycle() {
    await this.startWaiting();
  }

  getCurrentState() {
    if (!this.currentRound) return null;
    return {
      roundId: this.currentRound.id,
      roundNumber: this.currentRound.roundNumber,
      multiplier: this.multiplier,
      phase: this.phase,
      ...(this.phase === 'waiting'
        ? { countdown: Math.max(0, this.countdown) }
        : {}),
    };
  }

  getCurrentMultiplier() {
    return this.multiplier;
  }

  private async startWaiting() {
    this.phase = 'waiting';
    this.roundsService.rotateServerSeed();
    const last = await this.prisma.round.findFirst({
      orderBy: { roundNumber: 'desc' },
    });
    const nextRoundNumber = (last?.roundNumber ?? 0) + 1;
    const roundId = crypto.randomUUID();
    const { crashPoint, crashType } =
      this.roundsService.generateCrashPoint(roundId);
    const serverSeedHash = this.roundsService.getServerSeedHash(roundId);

    const round = await this.prisma.round.create({
      data: {
        id: roundId,
        roundNumber: nextRoundNumber,
        crashPoint,
        crashType: crashType as unknown as never,
        serverSeedHash,
        status: 'waiting',
      },
    });

    this.currentRound = {
      id: round.id,
      roundNumber: round.roundNumber,
      crashPoint: Number(crashPoint),
      startTime: Date.now(),
    };
    this.countdown = 5;

    this.emit('round:waiting', {
      roundId: round.id,
      roundNumber: round.roundNumber,
      countdown: this.countdown,
    });

    const countdownInterval = setInterval(() => {
      this.countdown -= 1;
      this.emit('round:waiting', {
        roundId: round.id,
        roundNumber: round.roundNumber,
        countdown: this.countdown,
      });
      if (this.countdown <= 0) {
        clearInterval(countdownInterval);
        void this.startFlying();
      }
    }, 1000);
  }

  private async startFlying() {
    if (!this.currentRound) return;
    this.phase = 'flying';
    this.multiplier = 1.0;

    await this.prisma.round.update({
      where: { id: this.currentRound.id },
      data: { status: 'flying', startedAt: new Date() },
    });

    this.emit('round:started', {
      roundId: this.currentRound.id,
      roundNumber: this.currentRound.roundNumber,
      startedAt: new Date(),
    });

    this.tickInterval = setInterval(() => {
      if (!this.currentRound) return;
      const elapsed = (Date.now() - this.currentRound.startTime) / 1000;
      this.multiplier = parseFloat(Math.exp(elapsed * 0.06).toFixed(2));
      this.roundsService.currentMultiplier = this.multiplier;
      this.emit('round:multiplier', {
        roundId: this.currentRound.id,
        roundNumber: this.currentRound.roundNumber,
        multiplier: this.multiplier,
      });

      void this.checkAutoCashouts();

      if (this.multiplier >= this.currentRound.crashPoint) {
        void this.crash();
      }
    }, 66); // ~15 updates/sec
  }

  private async checkAutoCashouts() {
    if (!this.currentRound) return;
    const candidates = await this.prisma.bet.findMany({
      where: {
        roundId: this.currentRound.id,
        status: 'active',
        autoCashout: { not: null, lte: this.multiplier },
      },
      include: { user: { select: { id: true } } },
    });
    for (const bet of candidates) {
      try {
        const result = await this.betsService.cashout(
          bet.userId,
          bet.id,
          this.multiplier,
        );
        this.emit('round:goal', {
          roundNumber: this.currentRound.roundNumber,
          crashPoint: this.currentRound.crashPoint,
        });
        this.emit('bet:auto:cashout', {
          userId: bet.userId,
          betId: bet.id,
          multiplier: result.cashoutMultiplier,
          winnings: result.winnings,
        });
      } catch {
        // ignore if already cashed out or round crashed
      }
    }
  }

  private async crash() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.phase = 'crashed';
    if (!this.currentRound) return;

    const roundRecord = await this.prisma.round.findUnique({
      where: { id: this.currentRound.id },
    });

    await this.prisma.round.update({
      where: { id: this.currentRound.id },
      data: {
        status: 'crashed',
        endedAt: new Date(),
        serverSeed: this.roundsService.getServerSeed(),
      },
    });

    // Mark all active bets as lost
    const activeBets = await this.prisma.bet.findMany({
      where: { roundId: this.currentRound.id, status: 'active' },
    });
    for (const bet of activeBets) {
      await this.prisma.bet.update({
        where: { id: bet.id },
        data: { status: 'lost' },
      });
      this.emit('bet:lost', {
        betId: bet.id,
        crashPoint: this.currentRound.crashPoint,
      });
    }

    this.emit('round:crashed', {
      roundId: this.currentRound.id,
      roundNumber: this.currentRound.roundNumber,
      crashPoint: this.currentRound.crashPoint,
      crashType: roundRecord?.crashType ?? 'post',
    });

    // Emit leaderboard update
    try {
      const weekly = (await this.leaderboardService.weekly(1, 10)).leaderboard;
      const allTime = (await this.leaderboardService.allTime(1, 10))
        .leaderboard;
      this.emit('leaderboard:update', { weekly, allTime });
    } catch {
      // ignore leaderboard errors on crash
    }

    // Start next round after 2s
    setTimeout(() => {
      void this.startWaiting();
    }, 2000);
  }
}
