/**
 * Resolve JWT expiresIn as seconds (jsonwebtoken always accepts a positive number).
 * Env may be seconds ("900") or timespan ("15m", "7d"). Invalid/empty → fallback.
 */
export function resolveJwtExpirySeconds(
  raw: string | number | undefined | null,
  fallbackSeconds: number,
): number {
  if (raw === undefined || raw === null) return fallbackSeconds;

  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallbackSeconds;
  }

  const s = String(raw).trim();
  if (!s) return fallbackSeconds;

  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n > 0 ? n : fallbackSeconds;
  }

  const timespan = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)$/i.exec(s);
  if (timespan) {
    const amount = parseFloat(timespan[1]);
    const unit = timespan[2].toLowerCase();
    const multipliers: Record<string, number> = {
      ms: 0.001,
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
      y: 31557600,
    };
    const mult = multipliers[unit];
    if (mult) {
      const sec = Math.floor(amount * mult);
      return sec > 0 ? sec : fallbackSeconds;
    }
  }

  return fallbackSeconds;
}
