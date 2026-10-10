import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PercentPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { MonthData } from '../../../models/cash-flow.model';
import { CashFlowCalculationService } from '../../../services/cash-flow-calculation.service';
import { LanguageService } from '../../../services/language.service';
import {
  ChartPeriod, ChartRange, FlowBucket, aggregatePoints, bucketOf, buildPoints, filterByRange,
  formatMoney, monthKey, projectPoints, summarize,
} from '../../../utils/cash-flow-chart.util';
import { CashFlowChartComponent } from './cash-flow-chart.component';

type ChartsView = 'chart' | 'table';

interface ChartsSettings {
  period: ChartPeriod;
  range: ChartRange;
  view: ChartsView;
  showAverage: boolean;
  years: number;
  incomeGrowth: number;
  expenseGrowth: number;
  basisMonths: number;
}

const SETTINGS_KEY = 'cf-charts-settings';
const DEFAULTS: ChartsSettings = {
  period: 'month', range: 'all', view: 'chart', showAverage: true,
  years: 3, incomeGrowth: 0, expenseGrowth: 0, basisMonths: 12,
};

function loadSettings(): ChartsSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/**
 * גרפי התזרים בדאשבורד של יועץ ה-AI: יתרה לאורך זמן, הכנסות מול הוצאות, חיסכון נטו,
 * עם מעבר חודשי / רבעוני / שנתי, טווח זמן, תחזית של כמה שנים קדימה ותצוגת טבלה.
 */
@Component({
  selector: 'app-cash-flow-charts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateModule, PercentPipe, CashFlowChartComponent],
  templateUrl: './cash-flow-charts.component.html',
  styleUrl: './cash-flow-charts.component.scss',
})
export class CashFlowChartsComponent {
  readonly months = input.required<MonthData[]>();

  private readonly calc = inject(CashFlowCalculationService);
  private readonly language = inject(LanguageService);
  private readonly fb = inject(FormBuilder);

  private readonly initial = loadSettings();

  readonly periods: ChartPeriod[] = ['month', 'quarter', 'year'];
  readonly ranges: ChartRange[] = ['1y', '3y', '5y', 'all'];
  readonly yearPresets = [0, 1, 3, 5, 10, 20];
  readonly basisOptions = [3, 6, 12, 24];

  readonly period = signal<ChartPeriod>(this.initial.period);
  readonly range = signal<ChartRange>(this.initial.range);
  readonly view = signal<ChartsView>(this.initial.view);
  readonly showAverage = signal(this.initial.showAverage);

  readonly projectionForm = this.fb.nonNullable.group({
    years: this.initial.years,
    incomeGrowth: this.initial.incomeGrowth,
    expenseGrowth: this.initial.expenseGrowth,
    basisMonths: this.initial.basisMonths,
  });
  private readonly projection = toSignal(this.projectionForm.valueChanges, { initialValue: this.projectionForm.getRawValue() });

  private readonly lang = toSignal(this.language.lang$, { initialValue: this.language.current });
  readonly locale = computed(() => (this.lang() === 'he' ? 'he-IL' : 'en-US'));

  readonly currentKey = monthKey(new Date());

  private readonly points = computed(() => buildPoints(
    this.months().map(m => ({
      month: m.month,
      income: this.calc.totalIncome(m),
      expenses: this.calc.totalExpenses(m),
      endingBalance: m.endingBalance,
    })),
    this.currentKey,
  ));

  readonly projectionYears = computed(() => Number(this.projection().years) || 0);

  private readonly visiblePoints = computed(() => {
    const p = this.projection();
    const projected = projectPoints(this.points(), {
      years: this.projectionYears(),
      incomeGrowthPct: Number(p.incomeGrowth) || 0,
      expenseGrowthPct: Number(p.expenseGrowth) || 0,
      basisMonths: Number(p.basisMonths) || 12,
    });
    return filterByRange([...this.points(), ...projected], this.range(), this.currentKey);
  });

  readonly buckets = computed(() => aggregatePoints(this.visiblePoints(), this.period()));
  readonly summary = computed(() => summarize(this.visiblePoints(), this.currentKey));
  readonly hasData = computed(() => this.points().length > 0);

  readonly todayIndex = computed(() => {
    const key = bucketOf(this.currentKey, this.period()).key;
    return this.buckets().findIndex(b => b.key === key);
  });

  readonly labels = computed(() => this.buckets().map(b => this.label(b, this.period(), false)));
  readonly longLabels = computed(() => this.buckets().map(b => this.label(b, this.period(), true)));
  readonly endLabel = computed(() => {
    const key = this.summary().endKey;
    return key ? this.label(bucketOf(key, 'month'), 'month', true) : '';
  });

  readonly balanceDelta = computed(() => {
    const s = this.summary();
    return s.balanceEnd !== null && s.balanceNow !== null ? s.balanceEnd - s.balanceNow : null;
  });

  constructor() {
    this.projectionForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.saveSettings());
  }

  setPeriod(p: ChartPeriod) { this.period.set(p); this.saveSettings(); }
  setRange(r: ChartRange) { this.range.set(r); this.saveSettings(); }
  setView(v: ChartsView) { this.view.set(v); this.saveSettings(); }
  toggleAverage() { this.showAverage.update(v => !v); this.saveSettings(); }
  setYears(y: number) { this.projectionForm.controls.years.setValue(y); }

  resetProjection() {
    this.projectionForm.setValue({
      years: DEFAULTS.years, incomeGrowth: DEFAULTS.incomeGrowth,
      expenseGrowth: DEFAULTS.expenseGrowth, basisMonths: DEFAULTS.basisMonths,
    });
  }

  money(v: number | null | undefined): string { return formatMoney(v, this.locale()); }

  private label(b: Pick<FlowBucket, 'year' | 'sub'>, period: ChartPeriod, long: boolean): string {
    if (period === 'year') return String(b.year);
    if (period === 'quarter') return `Q${b.sub} ${long ? b.year : String(b.year).slice(2)}`;
    const date = new Date(b.year, b.sub - 1, 1);
    return new Intl.DateTimeFormat(this.locale(), long
      ? { month: 'long', year: 'numeric' }
      : { month: 'short', year: '2-digit' }).format(date);
  }

  private saveSettings() {
    const settings: ChartsSettings = {
      period: this.period(), range: this.range(), view: this.view(), showAverage: this.showAverage(),
      ...this.projectionForm.getRawValue(),
    };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
  }
}
