import { AiUsage } from '../../../services/ai.service';

export type ContextLevel = 'ok' | 'warn' | 'full';

/** מעל אחוז זה מוצגת אזהרה שהשיחה מתקרבת לגבול ההקשר. */
export const CONTEXT_WARN_PERCENT = 80;

export interface ContextMeter {
  usedTokens: number;
  limitTokens: number;
  percent: number;
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
 * אותו חישוב כמו chatContext בשרת: סיכום + מקום לתשובה + טקסט ההודעות (כולל מה שמוקלד עכשיו).
 * full = הבקשה הבאה תידחה (AI_CONTEXT_FULL), ולכן השליחה נחסמת.
 */
export function contextMeter(context: AiUsage['context'], messageChars: number): ContextMeter {
  const usedTokens = context.baseTokens + context.reserveTokens + Math.ceil(messageChars / context.charsPerToken);
  const ratio = (usedTokens / context.limitTokens) * 100;
  const level: ContextLevel = usedTokens > context.limitTokens ? 'full' : ratio >= CONTEXT_WARN_PERCENT ? 'warn' : 'ok';
  return { usedTokens, limitTokens: context.limitTokens, percent: Math.min(100, Math.floor(ratio)), level };
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
