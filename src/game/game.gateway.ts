import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameEngineService } from './game-engine.service';
import { BetsService } from '../bets/bets.service';
import { PrismaService } from '../prisma/prisma.service';

interface PlaceBetPayload {
  roundId: string;
  amount: number;
  autoCashout?: number;
  userId: string;
}

interface CashoutPayload {
  betId: string;
  userId: string;
}

interface RateLimitEntry {
  count: number;
  lastReset: number;
}

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? '*' },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly wsRateLimit = 10; // messages per second
  private readonly wsRateWindow = 1000; // ms

  constructor(
    private readonly gameEngine: GameEngineService,
    private readonly betsService: BetsService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.gameEngine.on('round:waiting', (data) => {
      this.server.emit('round:waiting', data);
    });
    this.gameEngine.on('round:started', (data) => {
      this.server.emit('round:started', data);
    });
    this.gameEngine.on('round:multiplier', (data) => {
      this.server.emit('round:multiplier', data);
    });
    this.gameEngine.on('round:crashed', (data) => {
      this.server.emit('round:crashed', data);
    });
    this.gameEngine.on('round:goal', (data) => {
      this.server.emit('round:goal', data);
    });
    this.gameEngine.on('leaderboard:update', (data) => {
      this.server.emit('leaderboard:update', data);
    });
    this.gameEngine.on('bet:auto:cashout', (data) => {
      this.server.emit('bet:auto:cashout', data);
    });
    void this.gameEngine.startRoundLifecycle();
  }

  handleConnection(client: Socket) {
    const playerCount = this.server.engine.clientsCount ?? 0;
    this.server.emit('player_count', { count: playerCount });
    const current = this.gameEngine.getCurrentState();
    if (current) client.emit('round:multiplier', current);
  }

  handleDisconnect(client: Socket) {
    this.rateLimitMap.delete(client.id);
    const playerCount = this.server.engine.clientsCount ?? 0;
    this.server.emit('player_count', { count: playerCount });
  }

  private enforceRateLimit(client: Socket): boolean {
    const now = Date.now();
    const entry = this.rateLimitMap.get(client.id);
    if (!entry) {
      this.rateLimitMap.set(client.id, { count: 1, lastReset: now });
      return true;
    }
    if (now - entry.lastReset > this.wsRateWindow) {
      this.rateLimitMap.set(client.id, { count: 1, lastReset: now });
      return true;
    }
    if (entry.count >= this.wsRateLimit) {
      client.emit('rate_limited', { message: 'Too many messages. Slow down.' });
      return false;
    }
    entry.count += 1;
    return true;
  }

  @SubscribeMessage('join_round')
  async handleJoin(client: Socket, payload: { roundId: string }) {
    if (!this.enforceRateLimit(client)) return;
    await client.join(payload.roundId);
    const round = await this.prisma.round.findUnique({
      where: { id: payload.roundId },
    });
    if (round) {
      client.emit('round:multiplier', {
        roundNumber: round.roundNumber,
        multiplier: this.gameEngine.getCurrentMultiplier(),
      });
    }
  }

  @SubscribeMessage('leave_round')
  handleLeave(client: Socket, payload: { roundId: string }) {
    if (!this.enforceRateLimit(client)) return;
    void client.leave(payload.roundId);
  }

  @SubscribeMessage('place_bet')
  async handlePlaceBet(client: Socket, payload: PlaceBetPayload) {
    if (!this.enforceRateLimit(client)) return;
    try {
      const bet = await this.betsService.placeBet(
        payload.userId,
        payload.roundId,
        payload.amount,
        payload.autoCashout,
      );
      client.emit('bet:confirmed', {
        betId: bet.betId,
        amount: bet.amount,
        roundNumber: bet.roundNumber,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      client.emit('bet:error', { message });
    }
  }

  @SubscribeMessage('cashout')
  async handleCashout(client: Socket, payload: CashoutPayload) {
    if (!this.enforceRateLimit(client)) return;
    try {
      const multiplier = this.gameEngine.getCurrentMultiplier();
      const result = await this.betsService.cashout(
        payload.userId,
        payload.betId,
        multiplier,
      );
      client.emit('bet:cashout', {
        betId: result.betId,
        multiplier: result.cashoutMultiplier,
        winnings: result.winnings,
      });
      client.emit('round:goal', {
        roundNumber: this.gameEngine.getCurrentState()?.roundNumber ?? null,
        crashPoint: this.gameEngine.getCurrentMultiplier(),
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      client.emit('bet:error', { message });
    }
  }
}
