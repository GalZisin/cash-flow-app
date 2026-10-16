/**
 * נתוני ייצוא התזרים לאקסל: שורה לכל חודש (כמו הטבלה) ושורה לכל פריט (גיליון הפירוט).
 * פונקציות טהורות בלבד (בלי Angular ובלי ExcelJS), כדי שאפשר לבדוק אותן ישירות.
 */

export type ExportItemKind = 'additionalIncome' | 'regular' | 'special';

export interface ExportItem {
  description: string;
  amount: number;
  category: string | null;
}

/** ערכי חודש כפי שמגיעים מ-FormGroup.value של טבלת התזרים. */
export interface ExportMonthInput {
  month: Date | string;
  rowColor?: string | null;
  startingBalance?: number | string | null;
  income?: number | string | null;
  mortgagePayment?: number | string | null;
  loanPayment?: number | string | null;
  installmentsPayment?: number | string | null;
  endingBalance?: number | string | null;
  additionalIncomes?: { description?: string | null; amount?: number | string | null }[] | null;
  regularExpenses?: { description?: string | null; amount?: number | string | null; category?: string | null }[] | null;
  specialExpenses?: { description?: string | null; amount?: number | string | null; category?: string | null }[] | null;
}

export interface ExportMonthRow {
  month: Date;
  rowColor: string | null;
  startingBalance: number;
  income: number;
  additionalIncomes: number;
  mortgagePayment: number;
  loanPayment: number;
  installmentsPayment: number;
  regularExpenses: number;
  specialExpenses: number;
  savings: number;
  endingBalance: number;
  items: Record<ExportItemKind, ExportItem[]>;
}

export interface ExportDetailRow {
  month: Date;
  rowColor: string | null;
  kind: ExportItemKind;
  description: string;
  category: string | null;
  amount: number;
}

export interface ExportTotals {
  income: number;
  additionalIncomes: number;
  mortgagePayment: number;
  loanPayment: number;
  installmentsPayment: number;
  regularExpenses: number;
  specialExpenses: number;
  savings: number;
}

const num = (v: unknown): number => Number(v) || 0;
const ITEM_KINDS: ExportItemKind[] = ['additionalIncome', 'regular', 'special'];

function toItems(rows: { description?: string | null; amount?: number | string | null; category?: string | null }[] | null | undefined): ExportItem[] {
  return (rows ?? []).map(r => ({
    description: (r?.description ?? '').trim(),
    amount: num(r?.amount),
    category: r?.category ?? null,
  }));
}

const sum = (items: ExportItem[]): number => items.reduce((s, i) => s + i.amount, 0);

/** חודש מקומי (היום הראשון בחודש), גם כשמגיעה מחרוזת ISO של השרת. */
function toMonthDate(value: Date | string): Date {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), 1);
  const raw = new Date(value);
  return new Date(raw.getUTCFullYear(), raw.getUTCMonth(), 1);
}

/** שורה לכל חודש, באותו סדר ובאותם סכומים שהטבלה מציגה. */
export function buildExportMonthRows(months: ExportMonthInput[]): ExportMonthRow[] {
  return months.map(m => {
    const items: Record<ExportItemKind, ExportItem[]> = {
      additionalIncome: toItems(m.additionalIncomes),
      regular: toItems(m.regularExpenses),
      special: toItems(m.specialExpenses),
    };
    const additionalIncomes = sum(items.additionalIncome);
    const regularExpenses = sum(items.regular);
    const specialExpenses = sum(items.special);
    const income = num(m.income);
    const mortgagePayment = num(m.mortgagePayment);
    const loanPayment = num(m.loanPayment);
    const installmentsPayment = num(m.installmentsPayment);
    const totalIncome = income + additionalIncomes;
    const totalExpenses = mortgagePayment + loanPayment + installmentsPayment + regularExpenses + specialExpenses;

    return {
      month: toMonthDate(m.month),
      rowColor: m.rowColor ?? null,
      startingBalance: num(m.startingBalance),
      income,
      additionalIncomes,
      mortgagePayment,
      loanPayment,
      installmentsPayment,
      regularExpenses,
      specialExpenses,
      savings: totalIncome - totalExpenses,
      endingBalance: num(m.endingBalance),
      items,
    };
  });
}

/** שורה לכל פריט (הכנסה נוספת / הוצאה שוטפת / הוצאה מיוחדת), לפי חודש ואז סוג. */
export function buildExportDetailRows(rows: ExportMonthRow[]): ExportDetailRow[] {
  return rows.flatMap(r =>
    ITEM_KINDS.flatMap(kind =>
      r.items[kind].map(item => ({
        month: r.month,
        rowColor: r.rowColor,
        kind,
        description: item.description,
        category: item.category,
        amount: item.amount,
      }))
    )
  );
}

/** סיכום כל החודשים לשורת הסה"כ. */
export function buildExportTotals(rows: ExportMonthRow[]): ExportTotals {
  const total = (key: keyof ExportTotals) => rows.reduce((s, r) => s + r[key], 0);
  return {
    income: total('income'),
    additionalIncomes: total('additionalIncomes'),
    mortgagePayment: total('mortgagePayment'),
    loanPayment: total('loanPayment'),
    installmentsPayment: total('installmentsPayment'),
    regularExpenses: total('regularExpenses'),
    specialExpenses: total('specialExpenses'),
    savings: total('savings'),
  };
}

/** שם הקובץ: cash-flow-YYYY-MM-DD.xlsx לפי תאריך הייצוא. */
export function exportFileName(today: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `cash-flow-${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.xlsx`;
}
