import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { RoundsModule } from './rounds/rounds.module';
import { BetsModule } from './bets/bets.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { ReferralsModule } from './referrals/referrals.module';
import { GameModule } from './game/game.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60000, limit: 30 }],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    WalletModule,
    RoundsModule,
    BetsModule,
    LeaderboardModule,
    ReferralsModule,
    GameModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
