import { applyDemoHardcodedEnv } from './demo-hardcoded';

/**
 * Fill safe defaults before production-guard runs (Render public-test deploys).
 */
export function bootstrapRuntimeEnv(): void {
  applyDemoHardcodedEnv();

  const apiUrl = process.env.RENDER_EXTERNAL_URL?.trim();
  if (!process.env.API_PUBLIC_URL?.trim() && apiUrl) {
    process.env.API_PUBLIC_URL = apiUrl.replace(/\/$/, '');
  }
}
