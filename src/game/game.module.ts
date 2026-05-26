import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameEngineService } from './game-engine.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BetsModule } from '../bets/bets.module';
import { RoundsModule } from '../rounds/rounds.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [PrismaModule, BetsModule, RoundsModule, LeaderboardModule],
  providers: [GameGateway, GameEngineService],
  exports: [GameEngineService],
})
export class GameModule {}
