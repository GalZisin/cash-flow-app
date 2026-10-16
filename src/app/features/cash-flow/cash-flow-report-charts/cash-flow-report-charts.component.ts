import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ExportMonthRow } from '../../../utils/cash-flow-export.util';
import {
  buildBalanceChart, buildExpenseBreakdown, buildIncomeExpenseChart, buildSavingsChart,
  compactMoney, REPORT_CHART_BOX,
} from '../../../utils/cash-flow-report.util';

const SHORT_MONTH = new Intl.DateTimeFormat('he-IL', { month: 'short', year: '2-digit' });

/**
 * גרפי דוח ה-PDF (סטטיים, SVG): הכנסות מול הוצאות, יתרה בסוף החודש, חיסכון חודשי
 * והתפלגות ההוצאות. כל החישובים על החודשים שהתקבלו בלבד (הטווח שנבחר).
 */
@Component({
  selector: 'app-cash-flow-report-charts',
  imports: [TranslateModule, DecimalPipe, PercentPipe],
  templateUrl: './cash-flow-report-charts.component.html',
  styleUrl: './cash-flow-report-charts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashFlowReportChartsComponent {
  readonly rows = input<ExportMonthRow[]>([]);

  readonly box = REPORT_CHART_BOX;
  readonly viewBox = `0 0 ${REPORT_CHART_BOX.width} ${REPORT_CHART_BOX.height}`;
  readonly plotRight = REPORT_CHART_BOX.width - REPORT_CHART_BOX.right;
  readonly axisY = REPORT_CHART_BOX.height - REPORT_CHART_BOX.bottom + 15;

  readonly incomeExpense = computed(() => buildIncomeExpenseChart(this.rows()));
  readonly balance = computed(() => buildBalanceChart(this.rows()));
  readonly savings = computed(() => buildSavingsChart(this.rows()));
  readonly breakdown = computed(() => buildExpenseBreakdown(this.rows()));
  readonly breakdownMax = computed(() => Math.max(1, ...this.breakdown().map(s => s.amount)));

  readonly monthLabels = computed(() => this.rows().map(r => SHORT_MONTH.format(r.month)));

  money(value: number): string {
    return compactMoney(value);
  }
}
