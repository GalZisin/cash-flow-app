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

  // space for the chat = 8000 - 2400 (summary) - 1000 (answer) = 4600 tokens; 2 chars per token
  const text = (tokens: number) => 'x'.repeat(tokens * 2);

  it('a new chat starts at 0% of the space left after the summary and the answer', () => {
    const m = contextMeter(context, [], '');
    expect(m.percent).toBe(0);
    expect(m.spaceTokens).toBe(4600);
    expect(m.requestTokens).toBe(3400);
    expect(m.level).toBe('ok');
  });

  it('counts the history and the text being typed', () => {
    const m = contextMeter(context, [text(1000), text(1000)], text(300));
    expect(m.conversationTokens).toBe(2300);
    expect(m.percent).toBe(50);
    expect(m.requestTokens).toBe(3400 + 2300);
    expect(m.sentMessages).toBe(2);
  });

  it('warns from 80% while everything still fits', () => {
    const m = contextMeter(context, [text(2000), text(1700)], '');
    expect(m.percent).toBe(80);
    expect(m.level).toBe('warn');
  });

  it('over the space: keeps the newest messages that fit and reports the trimmed ones', () => {
    const m = contextMeter(context, [text(2000), text(2000), text(2000)], text(100));
    expect(m.sentMessages).toBe(2);
    expect(m.totalMessages).toBe(3);
    expect(m.percent).toBe(100);
    expect(m.requestTokens).toBe(3400 + 4100);
    expect(m.level).toBe('trimmed');
  });

  it('is full only when the question alone does not fit', () => {
    expect(contextMeter(context, [], text(4600)).level).toBe('warn'); // fills the space exactly: still sent
    expect(contextMeter(context, [text(10)], text(4601)).level).toBe('full');
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
