import { Module } from '@nestjs/common';
import { BetsService } from './bets.service';
import { BetsController } from './bets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RoundsModule } from '../rounds/rounds.module';

@Module({
  imports: [PrismaModule, RoundsModule],
  providers: [BetsService],
  controllers: [BetsController],
  exports: [BetsService],
})
export class BetsModule {}
