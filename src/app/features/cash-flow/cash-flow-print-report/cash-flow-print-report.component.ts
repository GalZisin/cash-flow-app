import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  buildExportTotals, ExportItem, ExportItemKind, ExportMonthRow, rowColorKey, RowColorKey,
} from '../../../utils/cash-flow-export.util';

interface DetailList {
  kind: ExportItemKind;
  labelKey: string;
  total: number;
  items: ExportItem[];
}

interface DetailMonth {
  month: Date;
  colorKey: RowColorKey | null;
  endingBalance: number;
  lists: DetailList[];
}

const DETAIL_KINDS: { kind: ExportItemKind; labelKey: string }[] = [
  { kind: 'additionalIncome', labelKey: 'CASH_FLOW.ADDITIONAL_INCOMES' },
  { kind: 'regular', labelKey: 'CASH_FLOW.REGULAR_EXPENSES' },
  { kind: 'special', labelKey: 'CASH_FLOW.SPECIAL_EXPENSES' },
];

/**
 * דוח התזרים להדפסה / שמירה כ-PDF. מוסתר במסך ומוצג רק ב-@media print, במקום הטבלה
 * האינטראקטיבית: כותרת עם התקופה, כרטיסי סיכום, טבלה צפופה שנכנסת ל-A4 לרוחב,
 * שורת סה"כ ופירוט הפריטים לפי חודש.
 */
@Component({
  selector: 'app-cash-flow-print-report',
  imports: [TranslateModule, DatePipe, DecimalPipe],
  templateUrl: './cash-flow-print-report.component.html',
  styleUrl: './cash-flow-print-report.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashFlowPrintReportComponent {
  readonly rows = input<ExportMonthRow[]>([]);
  readonly printedAt = input<Date>(new Date());

  readonly totals = computed(() => buildExportTotals(this.rows()));
  readonly firstMonth = computed(() => this.rows()[0]?.month ?? null);
  readonly lastMonth = computed(() => this.rows().at(-1)?.month ?? null);

  readonly summary = computed(() => {
    const rows = this.rows();
    const t = this.totals();
    const totalIncome = t.income + t.additionalIncomes;
    const totalExpenses = t.mortgagePayment + t.loanPayment + t.installmentsPayment + t.regularExpenses + t.specialExpenses;
    return {
      opening: rows[0]?.startingBalance ?? 0,
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      closing: rows.at(-1)?.endingBalance ?? 0,
    };
  });

  /** רק חודשים שיש בהם פריטים, ובכל חודש רק הרשימות שאינן ריקות. */
  readonly details = computed<DetailMonth[]>(() =>
    this.rows()
      .map(r => ({
        month: r.month,
        colorKey: rowColorKey(r.rowColor),
        endingBalance: r.endingBalance,
        lists: DETAIL_KINDS
          .filter(k => r.items[k.kind].length > 0)
          .map(k => ({
            ...k,
            items: r.items[k.kind],
            total: r.items[k.kind].reduce((s, i) => s + i.amount, 0),
          })),
      }))
      .filter(m => m.lists.length > 0)
  );

  colorKey(row: ExportMonthRow): RowColorKey | null {
    return rowColorKey(row.rowColor);
  }
}
