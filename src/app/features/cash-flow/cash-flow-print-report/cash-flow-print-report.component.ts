import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  buildExportTotals, ExportItem, ExportItemKind, ExportMonthRow, rowColorKey, RowColorKey,
} from '../../../utils/cash-flow-export.util';
import { summarizeRange } from '../../../utils/cash-flow-report.util';
import { CashFlowReportChartsComponent } from '../cash-flow-report-charts/cash-flow-report-charts.component';

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
 * האינטראקטיבית: כותרת עם התקופה, כרטיסי סיכום וגרפים לטווח שנבחר, טבלה צפופה
 * שנכנסת ל-A4 לרוחב, שורת סה"כ ופירוט הפריטים לפי חודש.
 */
@Component({
  selector: 'app-cash-flow-print-report',
  imports: [TranslateModule, DatePipe, DecimalPipe, PercentPipe, CashFlowReportChartsComponent],
  templateUrl: './cash-flow-print-report.component.html',
  styleUrl: './cash-flow-print-report.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashFlowPrintReportComponent {
  readonly rows = input<ExportMonthRow[]>([]);
  readonly printedAt = input<Date>(new Date());
  readonly includeCharts = input(true);
  readonly includeDetails = input(true);

  readonly totals = computed(() => buildExportTotals(this.rows()));
  readonly firstMonth = computed(() => this.rows()[0]?.month ?? null);
  readonly lastMonth = computed(() => this.rows().at(-1)?.month ?? null);

  /** כל הסיכומים על החודשים שהתקבלו בלבד (הטווח שנבחר בדיאלוג). */
  readonly summary = computed(() => summarizeRange(this.rows()));

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
