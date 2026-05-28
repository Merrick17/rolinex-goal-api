import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [PrismaModule, PlatformModule],
  controllers: [HealthController],
})
export class HealthModule {}
