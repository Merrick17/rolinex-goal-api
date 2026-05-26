import { Module } from '@nestjs/common';
import { RoundsService } from './rounds.service';
import { RoundsController } from './rounds.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RoundsService],
  controllers: [RoundsController],
  exports: [RoundsService],
})
export class RoundsModule {}
