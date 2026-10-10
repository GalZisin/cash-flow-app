/**
 * נתוני הגרפים של התזרים: נקודה לכל חודש, תחזית קדימה, צבירה לרבעון / שנה וסיכום.
 * פונקציות טהורות בלבד (בלי Angular), כדי שאפשר לבדוק אותן ישירות.
 */

export type ChartPeriod = 'month' | 'quarter' | 'year';
export type ChartRange = '1y' | '3y' | '5y' | 'all';
/** actual = עד החודש הנוכחי, planned = חודשים עתידיים מטבלת התזרים, projected = תחזית מחושבת. */
export type PointKind = 'actual' | 'planned' | 'projected';

/** חודש אחד אחרי חישוב הסכומים (הכנסות / הוצאות כפי ש-CashFlowCalculationService מחשב). */
export interface MonthTotals {
  month: string;
  income: number;
  expenses: number;
  endingBalance: number;
}

export interface FlowPoint {
  /** YYYY-MM */
  key: string;
  income: number;
  expenses: number;
  net: number;
  balance: number;
  kind: PointKind;
}

export interface FlowBucket {
  /** YYYY-MM, YYYY-Qn או YYYY */
  key: string;
  year: number;
  /** חודש (1-12) או רבעון (1-4); 0 בתצוגה שנתית */
  sub: number;
  income: number;
  expenses: number;
  net: number;
  /** יתרת סוף התקופה */
  balance: number;
  /** הסוג של החודש האחרון בתקופה */
  kind: PointKind;
  months: number;
  /** חיסכון נטו / הכנסות, או null כשאין הכנסות */
  savingsRate: number | null;
}

export interface ProjectionOptions {
  years: number;
  /** צמיחה שנתית בהכנסות, באחוזים */
  incomeGrowthPct: number;
  /** צמיחה שנתית בהוצאות (אינפלציה), באחוזים */
  expenseGrowthPct: number;
  /** כמה חודשים אחרונים משמשים כבסיס הממוצע */
  basisMonths: number;
}

export interface FlowSummary {
  months: number;
  avgIncome: number;
  avgExpenses: number;
  avgNet: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number | null;
  /** יתרה בחודש הנוכחי (או האחרון שלפניו) */
  balanceNow: number | null;
  /** יתרה בסוף הטווח המוצג, כולל תחזית */
  balanceEnd: number | null;
  endKey: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** מוסיף חודשים למפתח YYYY-MM. */
export function addMonths(key: string, count: number): string {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** נקודה לכל חודש, ממוינת וללא כפילויות (חודש שמופיע פעמיים: האחרון קובע). */
export function buildPoints(rows: MonthTotals[], currentKey: string): FlowPoint[] {
  const byKey = new Map<string, FlowPoint>();
  for (const row of rows) {
    const key = String(row.month ?? '').trim().substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    const income = Number(row.income) || 0;
    const expenses = Number(row.expenses) || 0;
    byKey.set(key, {
      key,
      income,
      expenses,
      net: income - expenses,
      balance: Number(row.endingBalance) || 0,
      kind: key <= currentKey ? 'actual' : 'planned',
    });
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * תחזית אחרי החודש האחרון בנתונים: ממוצע ההכנסות וההוצאות ב-basisMonths החודשים האחרונים,
 * עם צמיחה שנתית מצטברת (חודשית), והיתרה ממשיכה מהיתרה האחרונה.
 */
export function projectPoints(points: FlowPoint[], options: ProjectionOptions): FlowPoint[] {
  const horizon = Math.max(0, Math.round(options.years * 12));
  if (!points.length || horizon === 0) return [];

  const basis = points.slice(-Math.max(1, options.basisMonths));
  const baseIncome = basis.reduce((s, p) => s + p.income, 0) / basis.length;
  const baseExpenses = basis.reduce((s, p) => s + p.expenses, 0) / basis.length;
  const incomeRate = Math.pow(1 + options.incomeGrowthPct / 100, 1 / 12);
  const expenseRate = Math.pow(1 + options.expenseGrowthPct / 100, 1 / 12);

  const last = points[points.length - 1];
  let balance = last.balance;
  const result: FlowPoint[] = [];
  for (let i = 1; i <= horizon; i++) {
    const income = round2(baseIncome * Math.pow(incomeRate, i));
    const expenses = round2(baseExpenses * Math.pow(expenseRate, i));
    const net = round2(income - expenses);
    balance = round2(balance + net);
    result.push({ key: addMonths(last.key, i), income, expenses, net, balance, kind: 'projected' });
  }
  return result;
}

/** חודשים מהחודש הראשון בטווח (לפי החודש הנוכחי) והלאה. 'all' לא מסנן. */
export function filterByRange(points: FlowPoint[], range: ChartRange, currentKey: string): FlowPoint[] {
  const years = { '1y': 1, '3y': 3, '5y': 5 } as const;
  if (range === 'all') return points;
  const from = addMonths(currentKey, -(years[range] * 12 - 1));
  return points.filter(p => p.key >= from);
}

/** המפתח, השנה והתת-תקופה (חודש / רבעון) של חודש YYYY-MM בתצוגה הנתונה. */
export function bucketOf(key: string, period: ChartPeriod): { key: string; year: number; sub: number } {
  const year = Number(key.substring(0, 4));
  const month = Number(key.substring(5, 7));
  if (period === 'month') return { key, year, sub: month };
  if (period === 'year') return { key: String(year), year, sub: 0 };
  const quarter = Math.ceil(month / 3);
  return { key: `${year}-Q${quarter}`, year, sub: quarter };
}

/** צבירה לתקופה: סכומים מצטברים, יתרת סוף התקופה, הסוג של החודש האחרון. */
export function aggregatePoints(points: FlowPoint[], period: ChartPeriod): FlowBucket[] {
  const buckets: FlowBucket[] = [];
  for (const p of points) {
    const b = bucketOf(p.key, period);
    let current = buckets[buckets.length - 1];
    if (!current || current.key !== b.key) {
      current = { ...b, income: 0, expenses: 0, net: 0, balance: 0, kind: p.kind, months: 0, savingsRate: null };
      buckets.push(current);
    }
    current.income = round2(current.income + p.income);
    current.expenses = round2(current.expenses + p.expenses);
    current.net = round2(current.net + p.net);
    current.balance = p.balance;
    current.kind = p.kind;
    current.months++;
  }
  for (const b of buckets) b.savingsRate = b.income > 0 ? b.net / b.income : null;
  return buckets;
}

/** ממוצעים חודשיים על החודשים שאינם תחזית, יתרה היום ויתרה בסוף הטווח. */
export function summarize(points: FlowPoint[], currentKey: string): FlowSummary {
  const real = points.filter(p => p.kind !== 'projected');
  const totalIncome = real.reduce((s, p) => s + p.income, 0);
  const totalExpenses = real.reduce((s, p) => s + p.expenses, 0);
  const n = real.length;
  const upToNow = points.filter(p => p.key <= currentKey);
  const last = points[points.length - 1];
  return {
    months: n,
    avgIncome: n ? totalIncome / n : 0,
    avgExpenses: n ? totalExpenses / n : 0,
    avgNet: n ? (totalIncome - totalExpenses) / n : 0,
    totalIncome,
    totalExpenses,
    savingsRate: totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : null,
    balanceNow: upToNow.length ? upToNow[upToNow.length - 1].balance : (points[0]?.balance ?? null),
    balanceEnd: last ? last.balance : null,
    endKey: last ? last.key : null,
  };
}

/** ₪ בלי אגורות, עם המינוס לפני הסימן (-₪1,200), כך שהוא תקין גם בתוך <bdi dir="ltr">. */
export function formatMoney(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(Math.round(value)));
  return `${value < 0 ? '-' : ''}₪${abs}`;
}

/** ממוצע נע פשוט (window תקופות אחורה, כולל הנוכחית). */
export function movingAverage(values: number[], window: number): number[] {
  const w = Math.max(1, window);
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - w + 1), i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

/** קווי רשת "עגולים" (1 / 2 / 2.5 / 5 × 10^k) שמכסים את [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    if (min === 0) return [0, 1];
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  const rawStep = (max - min) / Math.max(1, count);
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map(f => f * power).find(s => s >= rawStep) ?? 10 * power;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}
