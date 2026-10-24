import { AiUsage } from '../../../services/ai.service';
import { contextMeter, quotaMeter } from './chat-usage';

describe('chat usage meters', () => {
  const context: AiUsage['context'] = {
    usedTokens: 3400, limitTokens: 8000, percent: 43, baseTokens: 2400, reserveTokens: 1000, charsPerToken: 2
  };
  const now = Date.parse('2026-10-24T10:00:00.000Z');
  const usage = (quota: AiUsage['quota']): AiUsage => ({ provider: 'openai', model: 'm', quota, context });
  const window = (limit: number, remaining: number, resetInMs: number) =>
    ({ limit, remaining, resetAt: new Date(now + resetInMs).toISOString() });

  it('adds the base prompt, the answer reserve and the message text', () => {
    const m = contextMeter(context, 2000); // 1000 tokens of messages
    expect(m.usedTokens).toBe(4400);
    expect(m.percent).toBe(55);
    expect(m.level).toBe('ok');
  });

  it('warns from 80% and is full only above the limit', () => {
    expect(contextMeter(context, 2 * (6400 - 3400)).level).toBe('warn');        // 6400 = 80%
    expect(contextMeter(context, 2 * (8000 - 3400)).level).toBe('warn');        // exactly the limit still fits
    const full = contextMeter(context, 2 * (8000 - 3400) + 2);
    expect(full.level).toBe('full');
    expect(full.percent).toBe(100);
  });

  it('has no quota meter until the provider reports one', () => {
    expect(quotaMeter(usage(null), 3400, now)).toBeNull();
  });

  it('shows the used share of the minute and of the day', () => {
    const q = quotaMeter(usage({ tokens: window(8000, 6000, 20_000), requests: window(1000, 990, 60_000), updatedAt: '' }), 1000, now)!;
    expect(q.tokensPercent).toBe(25);
    expect(q.requestsUsed).toBe(10);
    expect(q.requestsLimit).toBe(1000);
    expect(q.requestsLow).toBeFalse();
    expect(q.waitSeconds).toBe(0);
  });

  it('asks to wait when the next request does not fit the minute, and treats a reset window as full again', () => {
    const quota = { tokens: window(8000, 2000, 12_500), requests: window(1000, 50, 60_000), updatedAt: '' };
    const q = quotaMeter(usage(quota), 3400, now)!;
    expect(q.waitSeconds).toBe(13);
    expect(q.requestsLow).toBeTrue();

    const later = quotaMeter(usage(quota), 3400, now + 13_000)!;
    expect(later.tokensPercent).toBe(0);
    expect(later.waitSeconds).toBe(0);
  });

  it('does not ask to wait for a request larger than the whole window (that is a full context)', () => {
    const quota = { tokens: window(8000, 8000, 0), requests: null, updatedAt: '' };
    expect(quotaMeter(usage(quota), 9000, now)!.waitSeconds).toBe(0);
  });
});
