import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlatformCapabilities } from '../core/domain/capabilities';

@Injectable()
export class CapabilitiesService {
  constructor(private readonly config: ConfigService) {}

  getCapabilities(): PlatformCapabilities {
    const redis = Boolean(this.config.get<string>('REDIS_URL')?.trim());
    const gameEngine =
      this.config.get<string>('GAME_ENGINE_ENABLED') !== 'false';

    return {
      product: 'prolinex-goal-api',
      version: process.env.npm_package_version ?? '0.0.1',
      integrations: {
        sentinelgate: Boolean(
          this.config.get<string>('SENTINELGATE_API_KEY')?.trim() &&
            this.config.get<string>('SENTINELGATE_API_SECRET')?.trim(),
        ),
        redis,
        gameEngine,
      },
      features: {
        localAuth: true,
        localCrashGame: true,
        localGameWallet: true,
      },
    };
  }
}
