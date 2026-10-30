import { DEFAULT_USD_ILS_RATE, effectiveUsdIlsRate } from './exchange-rate.service';

describe('effectiveUsdIlsRate', () => {
  it('rejects 1, which was stored as a sentinel on ILS-native rows', () => {
    expect(effectiveUsdIlsRate(1)).toBe(DEFAULT_USD_ILS_RATE);
  });

  it('keeps a real USD/ILS rate', () => {
    expect(effectiveUsdIlsRate(3.65)).toBe(3.65);
  });

  it('falls back to the default when both stored and fallback rates are implausible', () => {
    expect(effectiveUsdIlsRate(1, 1)).toBe(DEFAULT_USD_ILS_RATE);
  });
});
