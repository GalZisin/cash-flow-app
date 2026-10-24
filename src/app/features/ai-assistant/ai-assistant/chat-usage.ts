import { AiUsage } from '../../../services/ai.service';

/** warn = מתקרב לגבול; trimmed = הודעות ישנות כבר לא נשלחות; full = השאלה לבדה גדולה מהמקום (השליחה נחסמת). */
export type ContextLevel = 'ok' | 'warn' | 'trimmed' | 'full';

/** מעל אחוז זה מוצגת אזהרה שבקרוב הודעות ישנות יפסיקו להישלח. */
export const CONTEXT_WARN_PERCENT = 80;

export interface ContextMeter {
  /** כמה מהמקום של השיחה (אחרי הסיכום והמקום לתשובה) תופסות כל ההודעות + מה שמוקלד. 0 בשיחה חדשה, עד 100 */
  percent: number;
  conversationTokens: number;
  spaceTokens: number;
  /** גודל הבקשה הבאה כפי שתישלח (סיכום + מקום לתשובה + ההודעות שנכנסות) */
  requestTokens: number;
  sentMessages: number;
  totalMessages: number;
  level: ContextLevel;
}

export interface QuotaMeter {
  model: string;
  /** אחוז הטוקנים שנוצלו בדקה הנוכחית (null אם הספק לא מדווח) */
  tokensPercent: number | null;
  requestsUsed: number | null;
  requestsLimit: number | null;
  requestsRemaining: number | null;
  /** פחות מ-10% מהבקשות היומיות נותרו */
  requestsLow: boolean;
  /** השאלה הבאה לא תיכנס למכסת הדקה: כמה שניות לחכות (0 = אפשר לשאול) */
  waitSeconds: number;
}

/**
 * אותו חישוב כמו chatContext בשרת: לשיחה נשאר limit - סיכום - מקום לתשובה. השאלה תמיד נשלחת,
 * ומההיסטוריה נשלחות ההודעות האחרונות שנכנסות (מהחדשה לישנה). history = תוכן ההודעות לפי הסדר.
 */
export function contextMeter(context: AiUsage['context'], history: string[], question: string): ContextMeter {
  const tokens = (text: string) => Math.ceil(text.length / context.charsPerToken);
  const spaceTokens = Math.max(0, context.limitTokens - context.baseTokens - context.reserveTokens);
  const questionTokens = tokens(question);

  let sentTokens = questionTokens, sentMessages = 0, totalTokens = questionTokens;
  let fits = true;
  for (let i = history.length - 1; i >= 0; i--) {
    const t = tokens(history[i]);
    totalTokens += t;
    if (fits && sentTokens + t <= spaceTokens) {
      sentTokens += t;
      sentMessages += 1;
    } else {
      fits = false;
    }
  }

  const percent = spaceTokens ? Math.min(100, Math.floor((totalTokens / spaceTokens) * 100)) : 100;
  const level: ContextLevel = questionTokens > spaceTokens ? 'full'
    : sentMessages < history.length ? 'trimmed'
    : percent >= CONTEXT_WARN_PERCENT ? 'warn'
    : 'ok';
  return {
    percent, conversationTokens: totalTokens, spaceTokens,
    requestTokens: context.baseTokens + context.reserveTokens + sentTokens,
    sentMessages, totalMessages: history.length, level
  };
}

/** מכסת הספק להצגה. חלון שזמן האיפוס שלו עבר נחשב מלא שוב. nextRequestTokens = גודל הבקשה הבאה. */
export function quotaMeter(usage: AiUsage, nextRequestTokens: number, now = Date.now()): QuotaMeter | null {
  const quota = usage.quota;
  if (!quota) return null;
  const tokens = quota.tokens && Date.parse(quota.tokens.resetAt) <= now ? { ...quota.tokens, remaining: quota.tokens.limit } : quota.tokens;
  const requests = quota.requests;
  return {
    model: usage.model,
    tokensPercent: tokens ? Math.round(((tokens.limit - tokens.remaining) / tokens.limit) * 100) : null,
    requestsUsed: requests ? requests.limit - requests.remaining : null,
    requestsLimit: requests?.limit ?? null,
    requestsRemaining: requests?.remaining ?? null,
    requestsLow: !!requests && requests.remaining < requests.limit * 0.1,
    // a request larger than the whole window is a full context, not something waiting fixes
    waitSeconds: tokens && tokens.remaining < tokens.limit && nextRequestTokens > tokens.remaining
      ? Math.max(1, Math.ceil((Date.parse(tokens.resetAt) - now) / 1000))
      : 0,
  };
}
