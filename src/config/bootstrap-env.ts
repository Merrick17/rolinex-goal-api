/**
 * Fill safe defaults before production-guard runs (Render public-test deploys).
 */
export function bootstrapRuntimeEnv(): void {
  const apiUrl = process.env.RENDER_EXTERNAL_URL?.trim();
  if (!process.env.API_PUBLIC_URL?.trim() && apiUrl) {
    process.env.API_PUBLIC_URL = apiUrl.replace(/\/$/, '');
  }

  const publicTest = process.env.DEPLOY_PROFILE?.trim() === 'public-test';
  if (!publicTest) return;

  if (!process.env.CORS_ORIGIN?.trim()) {
    process.env.CORS_ORIGIN = [
      'https://prolinexgoal.vercel.app',
      'http://localhost:3000',
      'http://localhost:3080',
    ].join(',');
    console.warn(
      '[bootstrap] CORS_ORIGIN unset — using defaults for public-test',
    );
  }

  const front = 'https://prolinexgoal.vercel.app';
  if (!process.env.SENTINELGATE_SUCCESS_URL?.trim()) {
    process.env.SENTINELGATE_SUCCESS_URL = `${front}/wallet/deposit/success`;
  }
  if (!process.env.SENTINELGATE_CANCEL_URL?.trim()) {
    process.env.SENTINELGATE_CANCEL_URL = `${front}/wallet/deposit/cancel`;
  }
}
