import { resolveJwtExpirySeconds } from './jwt-expiry';

describe('resolveJwtExpirySeconds', () => {
  it('uses fallback for empty values', () => {
    expect(resolveJwtExpirySeconds(undefined, 900)).toBe(900);
    expect(resolveJwtExpirySeconds('', 900)).toBe(900);
    expect(resolveJwtExpirySeconds('   ', 900)).toBe(900);
  });

  it('parses plain seconds', () => {
    expect(resolveJwtExpirySeconds('3600', 900)).toBe(3600);
  });

  it('parses timespan strings', () => {
    expect(resolveJwtExpirySeconds('15m', 900)).toBe(900);
    expect(resolveJwtExpirySeconds('7d', 900)).toBe(604800);
  });

  it('rejects invalid strings', () => {
    expect(resolveJwtExpirySeconds('not-a-time', 123)).toBe(123);
  });
});
