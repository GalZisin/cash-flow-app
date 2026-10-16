/**
 * דוח ה-PDF של התזרים: בחירת טווח חודשים, סיכום הטווח, התפלגות ההוצאות וגיאומטריית הגרפים (SVG).
 * פונקציות טהורות בלבד (בלי Angular), כדי שאפשר לבדוק אותן ישירות.
 */
import { addMonths, monthKey, niceTicks } from './cash-flow-chart.util';
import { buildExportTotals, ExportMonthRow } from './cash-flow-export.util';

export type ReportPreset = 'all' | 'currentYear' | 'last12' | 'next12';

export interface ReportRange {
  /** YYYY-MM, כולל */
  from: string;
  /** YYYY-MM, כולל */
  to: string;
}

export interface ReportOptions extends ReportRange {
  includeCharts: boolean;
  includeDetails: boolean;
}

export interface ReportSummary {
  months: number;
  opening: number;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  closing: number;
  avgIncome: number;
  avgExpenses: number;
  avgNet: number;
  /** חיסכון נטו כאחוז מההכנסות (0 כשאין הכנסות) */
  savingsRate: number;
}

export interface BreakdownSlice {
  key: string;
  labelKey: string;
  amount: number;
  /** 0..1 מסך ההוצאות */
  share: number;
}

/** החודשים בטווח (כולל שני הקצוות), בסדר המקורי. */
export function filterRowsByRange(rows: ExportMonthRow[], range: ReportRange | null): ExportMonthRow[] {
  if (!range) return rows;
  return rows.filter(r => {
    const key = monthKey(r.month);
    return key >= range.from && key <= range.to;
  });
}

/** טווח של חזרה מהירה, חתוך לחודשים שקיימים בטבלה. null כשאין חודשים בטווח. */
export function presetRange(preset: ReportPreset, availableKeys: string[], today: Date = new Date()): ReportRange | null {
  if (availableKeys.length === 0) return null;
  const keys = [...availableKeys].sort();
  const first = keys[0];
  const last = keys[keys.length - 1];
  const current = monthKey(today);

  let wanted: ReportRange;
  switch (preset) {
    case 'currentYear': wanted = { from: `${today.getFullYear()}-01`, to: `${today.getFullYear()}-12` }; break;
    case 'last12': wanted = { from: addMonths(current, -11), to: current }; break;
    case 'next12': wanted = { from: current, to: addMonths(current, 11) }; break;
    default: wanted = { from: first, to: last };
  }

  const inRange = keys.filter(k => k >= wanted.from && k <= wanted.to);
  return inRange.length ? { from: inRange[0], to: inRange[inRange.length - 1] } : null;
}

const expensesOf = (r: ExportMonthRow) =>
  r.mortgagePayment + r.loanPayment + r.installmentsPayment + r.regularExpenses + r.specialExpenses;

/** כל חישובי הסיכום על החודשים שנבחרו בלבד: פתיחה = החודש הראשון, סגירה = החודש האחרון. */
export function summarizeRange(rows: ExportMonthRow[]): ReportSummary {
  const t = buildExportTotals(rows);
  const months = rows.length;
  const totalIncome = t.income + t.additionalIncomes;
  const totalExpenses = t.mortgagePayment + t.loanPayment + t.installmentsPayment + t.regularExpenses + t.specialExpenses;
  const net = totalIncome - totalExpenses;
  const per = (v: number) => (months ? v / months : 0);
  return {
    months,
    opening: rows[0]?.startingBalance ?? 0,
    totalIncome,
    totalExpenses,
    net,
    closing: rows.at(-1)?.endingBalance ?? 0,
    avgIncome: per(totalIncome),
    avgExpenses: per(totalExpenses),
    avgNet: per(net),
    savingsRate: totalIncome > 0 ? net / totalIncome : 0,
  };
}

/**
 * לאן הלך הכסף: משכנתא, הלוואות, פריסות וכל קטגוריית הוצאה (שוטפות + מיוחדות).
 * ממוין מהגדול לקטן; מעבר ל-limit הפריטים הקטנים מתקפלים ל"אחר".
 */
export function buildExpenseBreakdown(rows: ExportMonthRow[], limit = 8): BreakdownSlice[] {
  const totals = new Map<string, { labelKey: string; amount: number }>();
  const add = (key: string, labelKey: string, amount: number) => {
    if (amount <= 0) return;
    const cur = totals.get(key) ?? { labelKey, amount: 0 };
    cur.amount += amount;
    totals.set(key, cur);
  };

  rows.forEach(r => {
    add('mortgage', 'CASH_FLOW.MORTGAGE', r.mortgagePayment);
    add('loans', 'CASH_FLOW.LOAN', r.loanPayment);
    add('installments', 'CASH_FLOW.INSTALLMENTS_PAYMENT', r.installmentsPayment);
    [...r.items.regular, ...r.items.special].forEach(i => {
      const category = i.category || 'OTHER';
      add(`cat:${category}`, `CATEGORIES.${category}`, i.amount);
    });
  });

  const all = [...totals.entries()]
    .map(([key, v]) => ({ key, labelKey: v.labelKey, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount);
  const total = all.reduce((s, x) => s + x.amount, 0);

  let slices = all;
  if (all.length > limit) {
    const rest = all.slice(limit - 1).reduce((s, x) => s + x.amount, 0);
    slices = [...all.slice(0, limit - 1), { key: 'rest', labelKey: 'CASH_FLOW.REPORT_REST', amount: rest }];
  }
  return slices.map(s => ({ ...s, share: total > 0 ? s.amount / total : 0 }));
}

// ---------------------------------------------------------------------------
// Chart geometry (SVG viewBox units). Time runs left to right, like the app's charts.
// ---------------------------------------------------------------------------

export interface ChartBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const REPORT_CHART_BOX: ChartBox = { width: 560, height: 230, left: 58, right: 12, top: 14, bottom: 26 };

export interface ChartTick { value: number; y: number }
export interface ChartXLabel { index: number; x: number }
export interface ChartBar { x: number; y: number; width: number; height: number; value: number; path: string }

export interface BarsChart {
  ticks: ChartTick[];
  zeroY: number;
  xLabels: ChartXLabel[];
}

export interface IncomeExpenseChart extends BarsChart {
  groups: { index: number; income: ChartBar; expenses: ChartBar }[];
}

export interface SavingsChart extends BarsChart {
  bars: (ChartBar & { negative: boolean })[];
}

export interface BalanceChart {
  ticks: ChartTick[];
  zeroY: number | null;
  xLabels: ChartXLabel[];
  line: string;
  area: string;
  points: { x: number; y: number; value: number }[];
  /** נקודות עם תווית ערך: הראשונה, האחרונה, המינימום והמקסימום */
  labeled: { x: number; y: number; value: number; anchor: 'start' | 'middle' | 'end' }[];
}

function scaleY(ticks: number[], box: ChartBox): (v: number) => number {
  const min = ticks[0];
  const max = ticks[ticks.length - 1];
  const plot = box.height - box.top - box.bottom;
  return v => box.top + plot - ((v - min) / (max - min || 1)) * plot;
}

function band(count: number, box: ChartBox): number {
  return (box.width - box.left - box.right) / Math.max(1, count);
}

/** תוויות ציר X בלי התנגשויות: כל חודש, כל שני או כל שלישי, לפי הרוחב. */
function xLabels(count: number, box: ChartBox, minGap = 44): ChartXLabel[] {
  const b = band(count, box);
  const step = Math.max(1, Math.ceil(minGap / b));
  const labels: ChartXLabel[] = [];
  for (let i = 0; i < count; i += step) labels.push({ index: i, x: box.left + (i + 0.5) * b });
  return labels;
}

/** מוט עם קצה עגול בצד הנתון ובסיס ישר על קו האפס (r מוגבל לחצי הרוחב / הגובה). */
export function barPath(x: number, yValue: number, yBase: number, width: number, radius = 3): string {
  const h = Math.abs(yBase - yValue);
  if (h < 0.5 || width <= 0) return '';
  const r = Math.min(radius, width / 2, h);
  const up = yValue < yBase;
  const tip = yValue;
  const dir = up ? 1 : -1; // from the tip toward the base
  return [
    `M${x},${yBase}`,
    `L${x},${tip + dir * r}`,
    `Q${x},${tip} ${x + r},${tip}`,
    `L${x + width - r},${tip}`,
    `Q${x + width},${tip} ${x + width},${tip + dir * r}`,
    `L${x + width},${yBase}`,
    'Z',
  ].join(' ');
}

function makeBar(x: number, width: number, value: number, y: (v: number) => number, zeroY: number): ChartBar {
  const top = y(value);
  return {
    x, width, value,
    y: Math.min(top, zeroY),
    height: Math.abs(zeroY - top),
    path: barPath(x, top, zeroY, width),
  };
}

/** הכנסות מול הוצאות לכל חודש: שני מוטות צמודים עם רווח של 2 יחידות. */
export function buildIncomeExpenseChart(rows: ExportMonthRow[], box: ChartBox = REPORT_CHART_BOX): IncomeExpenseChart {
  const values = rows.flatMap(r => [r.income + r.additionalIncomes, expensesOf(r)]);
  const ticks = niceTicks(0, Math.max(1, ...values), 4);
  const y = scaleY(ticks, box);
  const zeroY = y(0);
  const b = band(rows.length, box);
  const gap = 2;
  const barW = Math.max(1, Math.min(18, (b * 0.72 - gap) / 2));
  const groups = rows.map((r, i) => {
    const start = box.left + i * b + (b - (barW * 2 + gap)) / 2;
    return {
      index: i,
      income: makeBar(start, barW, r.income + r.additionalIncomes, y, zeroY),
      expenses: makeBar(start + barW + gap, barW, expensesOf(r), y, zeroY),
    };
  });
  return { ticks: ticks.map(v => ({ value: v, y: y(v) })), zeroY, xLabels: xLabels(rows.length, box), groups };
}

/** חיסכון חודשי (הכנסות פחות הוצאות): חיובי מעל קו האפס, שלילי מתחתיו. */
export function buildSavingsChart(rows: ExportMonthRow[], box: ChartBox = REPORT_CHART_BOX): SavingsChart {
  const values = rows.map(r => r.savings);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values, 1), 4);
  const y = scaleY(ticks, box);
  const zeroY = y(0);
  const b = band(rows.length, box);
  const barW = Math.max(1, Math.min(26, b * 0.6));
  const bars = rows.map((r, i) => ({
    ...makeBar(box.left + i * b + (b - barW) / 2, barW, r.savings, y, zeroY),
    negative: r.savings < 0,
  }));
  return { ticks: ticks.map(v => ({ value: v, y: y(v) })), zeroY, xLabels: xLabels(rows.length, box), bars };
}

/** יתרה בסוף כל חודש: קו + שטח עדין, עם תוויות לנקודות המפתח. */
export function buildBalanceChart(rows: ExportMonthRow[], box: ChartBox = REPORT_CHART_BOX): BalanceChart {
  const values = rows.map(r => r.endingBalance);
  if (values.length === 0) {
    return { ticks: [], zeroY: null, xLabels: [], line: '', area: '', points: [], labeled: [] };
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  const ticks = niceTicks(lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad, 4);
  const y = scaleY(ticks, box);
  const b = band(rows.length, box);
  const points = values.map((v, i) => ({ x: box.left + (i + 0.5) * b, y: y(v), value: v }));
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const baseY = y(Math.max(ticks[0], Math.min(0, ticks[ticks.length - 1])));
  const area = points.length
    ? `${line} L${points[points.length - 1].x.toFixed(1)},${baseY.toFixed(1)} L${points[0].x.toFixed(1)},${baseY.toFixed(1)} Z`
    : '';

  // Priority: last, first, max, min. A label too close to one already kept is dropped (no overlaps).
  const kept: number[] = [];
  [values.length - 1, 0, values.indexOf(hi), values.indexOf(lo)].forEach(i => {
    if (kept.includes(i)) return;
    const clash = kept.some(k => Math.abs(points[k].x - points[i].x) < 64 && Math.abs(points[k].y - points[i].y) < 16);
    if (!clash) kept.push(i);
  });
  const labeled = kept.sort((a, b2) => a - b2).map(i => ({
    ...points[i],
    anchor: (i === 0 ? 'start' : i === values.length - 1 ? 'end' : 'middle') as 'start' | 'middle' | 'end',
  }));
  const zeroY = ticks[0] < 0 && ticks[ticks.length - 1] > 0 ? y(0) : null;
  return { ticks: ticks.map(v => ({ value: v, y: y(v) })), zeroY, xLabels: xLabels(rows.length, box), line, area, points, labeled };
}

/** תווית קצרה לציר: 12K / 1.2M / -850. */
export function compactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${+(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${+(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}${Math.round(abs)}`;
}
