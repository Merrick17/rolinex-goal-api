import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GameEngineService } from './game-engine.service';
import { BetsService } from '../bets/bets.service';
import { PrismaService } from '../prisma/prisma.service';
import { getCorsOrigins } from '../config/production-guard';

interface PlaceBetPayload {
  roundId: string;
  amount: number;
  autoCashout?: number;
}

interface CashoutPayload {
  betId: string;
}

interface RateLimitEntry {
  count: number;
  lastReset: number;
}

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
  };
}

@WebSocketGateway({
  cors: { origin: getCorsOrigins(), credentials: true },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly wsRateLimit = 10;
  private readonly wsRateWindow = 1000;

  constructor(
    private readonly gameEngine: GameEngineService,
    private readonly betsService: BetsService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
    if (process.env.GAME_ENGINE_ENABLED !== 'false') {
      void this.gameEngine.startRoundLifecycle();
    }
  }

  private getConnectedCount(): number {
    const engineCount = this.server?.engine?.clientsCount;
    if (typeof engineCount === 'number') return engineCount;
    return this.server?.sockets?.sockets?.size ?? 0;
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }

  async handleConnection(client: AuthenticatedSocket) {
    const token = this.extractToken(client);
    if (token) {
      try {
        const payload = this.jwtService.verify<{ sub: string }>(token, {
          secret: this.configService.getOrThrow('JWT_SECRET'),
        });
        client.data.userId = payload.sub;
      } catch {
        client.emit('error', { message: 'Invalid or expired token' });
        client.disconnect(true);
        return;
      }
    }

    const playerCount = this.getConnectedCount();
    this.server.emit('player_count', { count: playerCount });
    const current = this.gameEngine.getCurrentState();
    if (current) {
      client.emit('round:sync', current);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.rateLimitMap.delete(client.id);
    const playerCount = this.getConnectedCount();
    this.server.emit('player_count', { count: playerCount });
  }

  private getUserId(client: AuthenticatedSocket): string {
    const userId = client.data.userId;
    if (!userId) throw new Error('Unauthenticated socket');
    return userId;
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
  async handleJoin(client: AuthenticatedSocket, payload: { roundId: string }) {
    if (!this.enforceRateLimit(client)) return;
    await client.join(payload.roundId);
    const round = await this.prisma.round.findUnique({
      where: { id: payload.roundId },
    });
    if (round) {
      client.emit('round:multiplier', {
        roundId: round.id,
        roundNumber: round.roundNumber,
        multiplier: this.gameEngine.getCurrentMultiplier(),
        phase: round.status,
      });
    }
  }

  @SubscribeMessage('leave_round')
  handleLeave(client: AuthenticatedSocket, payload: { roundId: string }) {
    if (!this.enforceRateLimit(client)) return;
    void client.leave(payload.roundId);
  }

  @SubscribeMessage('place_bet')
  async handlePlaceBet(client: AuthenticatedSocket, payload: PlaceBetPayload) {
    if (!this.enforceRateLimit(client)) return;
    if (!client.data.userId) {
      client.emit('bet:error', { message: 'Authentication required' });
      return;
    }
    try {
      const userId = this.getUserId(client);
      const bet = await this.betsService.placeBet(
        userId,
        payload.roundId,
        payload.amount,
        payload.autoCashout,
      );
      client.emit('bet:confirmed', {
        betId: bet.betId,
        amount: bet.amount,
        roundNumber: bet.roundNumber,
        roundId: bet.roundId,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      client.emit('bet:error', { message });
    }
  }

  @SubscribeMessage('cashout')
  async handleCashout(client: AuthenticatedSocket, payload: CashoutPayload) {
    if (!this.enforceRateLimit(client)) return;
    if (!client.data.userId) {
      client.emit('bet:error', { message: 'Authentication required' });
      return;
    }
    try {
      const userId = this.getUserId(client);
      const multiplier = this.gameEngine.getCurrentMultiplier();
      const result = await this.betsService.cashout(
        userId,
        payload.betId,
        multiplier,
      );
      client.emit('bet:cashout', {
        betId: result.betId,
        multiplier: result.cashoutMultiplier,
        winnings: result.winnings,
        newBalance: result.newBalance,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      client.emit('bet:error', { message });
    }
  }
}
