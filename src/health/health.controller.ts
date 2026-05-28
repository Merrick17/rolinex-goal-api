import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { CapabilitiesService } from '../platform/capabilities.service';

@Controller('api/health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilitiesService: CapabilitiesService,
  ) {}

  @Get()
  live() {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', db: true };
  }

  @Get('capabilities')
  capabilities() {
    return this.capabilitiesService.getCapabilities();
  }
}
