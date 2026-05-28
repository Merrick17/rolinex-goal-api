import { ConfigService } from '@nestjs/config';
import { CapabilitiesService } from './capabilities.service';

describe('CapabilitiesService', () => {
  it('reports game-only capabilities', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'REDIS_URL') return '';
        if (key === 'GAME_ENGINE_ENABLED') return 'true';
        if (key === 'SENTINELGATE_API_KEY') return 'sg_key_test';
        if (key === 'SENTINELGATE_API_SECRET') return 'sg_secret_test';
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new CapabilitiesService(config);
    const caps = service.getCapabilities();

    expect(caps.product).toBe('prolinex-goal-api');
    expect(caps.features).toEqual({
      localAuth: true,
      localCrashGame: true,
      localGameWallet: true,
    });
    expect(caps.integrations.sentinelgate).toBe(true);
    expect(caps.integrations.gameEngine).toBe(true);
    expect(Object.keys(caps.integrations).sort()).toEqual([
      'gameEngine',
      'redis',
      'sentinelgate',
    ]);
  });
});
