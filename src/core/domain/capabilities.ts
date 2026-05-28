/**
 * Platform capability flags — what is wired in this deployment.
 * Used by health checks and future feature gates.
 */
export type IntegrationId =
  | 'sentinelgate'
  | 'redis'
  | 'gameEngine';

export type PlatformCapabilities = {
  product: 'prolinex-goal-api';
  version: string;
  integrations: Record<IntegrationId, boolean>;
  features: {
    localAuth: boolean;
    localCrashGame: boolean;
    localGameWallet: boolean;
  };
};
