/**
 * DEMO ONLY — used when DATABASE_URL is not set (e.g. Render without linked Postgres).
 * Uses the same Supabase project as local dev. Rotate credentials if this repo is public.
 */
export const DEMO_DATABASE_URL =
  'postgresql://postgres.icwrnjvvvtgfwioszvts:01161590Safwen@@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

export const DEMO_DIRECT_URL =
  'postgresql://postgres.icwrnjvvvtgfwioszvts:01161590Safwen@@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';

export const DEMO_JWT_SECRET =
  'prolinex-demo-jwt-secret-for-render-and-public-test-32ch';

export const DEMO_JWT_REFRESH_SECRET =
  'prolinex-demo-refresh-secret-for-render-public-test-32ch';

export function isDemoHardcodedDeploy(): boolean {
  if (process.env.DEMO_HARDCODED === 'false') return false;
  if (process.env.DEMO_HARDCODED === 'true') return true;
  if (process.env.DEPLOY_PROFILE === 'public-test') return true;
  if (process.env.RENDER === 'true' && !process.env.DATABASE_URL?.trim()) {
    return true;
  }
  return !process.env.DATABASE_URL?.trim();
}

export function applyDemoHardcodedEnv(): void {
  if (!isDemoHardcodedDeploy()) return;

  if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = DEMO_DATABASE_URL;
  }
  if (!process.env.DIRECT_URL?.trim()) {
    process.env.DIRECT_URL =
      process.env.DATABASE_URL?.trim() || DEMO_DIRECT_URL;
  }
  if (!process.env.DEPLOY_PROFILE?.trim()) {
    process.env.DEPLOY_PROFILE = 'public-test';
  }
  if (!process.env.JWT_SECRET?.trim() || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = DEMO_JWT_SECRET;
  }
  if (
    !process.env.JWT_REFRESH_SECRET?.trim() ||
    process.env.JWT_REFRESH_SECRET.length < 32
  ) {
    process.env.JWT_REFRESH_SECRET = DEMO_JWT_REFRESH_SECRET;
  }
  if (!process.env.NODE_ENV?.trim()) {
    process.env.NODE_ENV = 'production';
  }
  if (!process.env.CORS_ORIGIN?.trim()) {
    process.env.CORS_ORIGIN = [
      'https://prolinexgoal.vercel.app',
      'http://localhost:3000',
      'http://localhost:3080',
    ].join(',');
  }
  if (process.env.PAYMENT_SIMULATION_INSTANT !== 'false') {
    process.env.PAYMENT_SIMULATION_INSTANT = 'true';
  }
  if (process.env.GAME_ENGINE_ENABLED !== 'false') {
    process.env.GAME_ENGINE_ENABLED = 'true';
  }

  const front = 'https://prolinexgoal.vercel.app';
  if (!process.env.SENTINELGATE_SUCCESS_URL?.trim()) {
    process.env.SENTINELGATE_SUCCESS_URL = `${front}/wallet/deposit/success`;
  }
  if (!process.env.SENTINELGATE_CANCEL_URL?.trim()) {
    process.env.SENTINELGATE_CANCEL_URL = `${front}/wallet/deposit/cancel`;
  }

  console.warn(
    '[demo] Using hardcoded demo env (DATABASE_URL / JWT / CORS). Not for real money.',
  );
}
