/**
 * Fail fast when NODE_ENV=production and required secrets or unsafe flags are missing.
 */
/** Public smoke-test deploys (Render/Vercel) without live SentinelGate yet. */
function isPublicTestDeploy(): boolean {
  return process.env.DEPLOY_PROFILE?.trim() === 'public-test';
}

export function assertProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors: string[] = [];
  const publicTest = isPublicTestDeploy();

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }
  if (
    !process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_REFRESH_SECRET.length < 32
  ) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters');
  }

  const cors = process.env.CORS_ORIGIN?.trim();
  if ((!cors || cors === '*') && !publicTest) {
    errors.push(
      'CORS_ORIGIN must list your frontend origin(s), comma-separated (not *)',
    );
  }

  if (
    process.env.PAYMENT_SIMULATION_INSTANT === 'true' &&
    !publicTest
  ) {
    errors.push('PAYMENT_SIMULATION_INSTANT must not be true in production');
  }

  if (!publicTest) {
    if (!process.env.SENTINELGATE_API_KEY?.trim()) {
      errors.push('SENTINELGATE_API_KEY is required in production');
    }
    if (!process.env.SENTINELGATE_API_SECRET?.trim()) {
      errors.push('SENTINELGATE_API_SECRET is required in production');
    }
    if (!process.env.SENTINELGATE_WEBHOOK_SECRET?.trim()) {
      errors.push('SENTINELGATE_WEBHOOK_SECRET is required in production');
    }
    if (!process.env.SENTINELGATE_SUCCESS_URL?.trim()) {
      errors.push('SENTINELGATE_SUCCESS_URL is required');
    }
    if (!process.env.SENTINELGATE_CANCEL_URL?.trim()) {
      errors.push('SENTINELGATE_CANCEL_URL is required');
    }
    if (
      !process.env.SENTINELGATE_CALLBACK_URL?.trim() &&
      !process.env.API_PUBLIC_URL?.trim()
    ) {
      errors.push(
        'SENTINELGATE_CALLBACK_URL or API_PUBLIC_URL is required for payment webhooks',
      );
    }
  } else {
    console.warn(
      '[production] DEPLOY_PROFILE=public-test — SentinelGate checks skipped (game/auth only)',
    );
  }

  if (errors.length > 0) {
    console.error(
      '\n[FATAL] Production environment validation failed:\n' +
        errors.map((e) => `  • ${e}`).join('\n') +
        '\n',
    );
    process.exit(1);
  }

  console.log('[production] Environment validation passed');
}

export function getCorsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) {
    return process.env.NODE_ENV === 'production' ? [] : true;
  }
  if (raw === '*') return true;
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

export function isProductionNode(): boolean {
  return process.env.NODE_ENV === 'production';
}
