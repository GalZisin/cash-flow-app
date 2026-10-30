import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Investment, Snapshot, Transaction, SimulationRule, PeriodReturn, InvestmentCurrency } from '../../../models/investment.model';
import { InvestmentService } from '../../../services/investment.service';
import { ExchangeRateService, DEFAULT_USD_ILS_RATE } from '../../../services/exchange-rate.service';
import { buildYearlyXirrChart, YearlyChart } from './yearly-xirr-chart.util';
import { InvestmentGlossaryComponent } from './investment-glossary.component';

const W = 600, H = 360, PAD = { top: 24, right: 24, bottom: 48, left: 70 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

@Component({
  selector: 'app-investment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatTooltipModule, DecimalPipe, InvestmentGlossaryComponent],
  templateUrl: './investment-detail.component.html',
  styleUrl: './investment-detail.component.scss'
})
export class InvestmentDetailComponent implements OnChanges {
  @Input() investment!: Investment;
  @Output() changed = new EventEmitter<void>();

  readonly W = W; readonly H = H; readonly PAD = PAD; readonly CW = CW; readonly CH = CH;
  readonly Math = Math;

  // Currency View
  viewCurrency: InvestmentCurrency = 'ILS';
  get currencySymbol(): string { return this.viewCurrency === 'USD' ? '$' : '₪'; }
  get secondaryCurrencySymbol(): string { return this.viewCurrency === 'USD' ? '₪' : '$'; }

  // Metrics (in viewCurrency)
  cagr: number | null = null;
  xirr: number | null = null;
  totalProfit: number | null = null;
  currentValue: number | null = null;
  totalDeposits: number | null = null;

  // Secondary metrics (in the alternative currency)
  secondaryCurrentValue: number | null = null;
  secondaryTotalDeposits: number | null = null;
  secondaryProfit: number | null = null;

  xirrYears: { year: number; value: number | null; profit: number | null }[] = [];
  yearlyChart: YearlyChart | null = null;
  /** מקביל ל-displaySnapshots: הפקדות, רווח ותשואה מהצילום הקודם */
  periodRows: (PeriodReturn | null)[] = [];

  // Chart
  chartData: { x: number; y: number; date: string; value: number }[] = [];
  linePoints = ''; areaPath = '';
  yTicks: { y: number; label: string }[] = [];

  // Name & currency editing
  editingName = false;
  editNameVal = '';
  editTypeVal: Investment['type'] = 'fund';
  editCurrencyVal: InvestmentCurrency = 'ILS';

  // Snapshot form & edit
  newSnapDate = today();
  newSnapCurrency: InvestmentCurrency = 'ILS';
  newSnapAmount: number | null = null;
  newSnapExchangeRate: number = DEFAULT_USD_ILS_RATE;

  editingSnapIndex: number | null = null;
  editSnapDate = '';
  editSnapCurrency: InvestmentCurrency = 'ILS';
  editSnapAmount: number | null = null;
  editSnapExchangeRate: number = DEFAULT_USD_ILS_RATE;

  // Transaction form & edit
  newTxDate = today();
  newTxType: Transaction['type'] = 'deposit';
  newTxCurrency: InvestmentCurrency = 'ILS';
  newTxAmount: number | null = null;
  newTxExchangeRate: number = DEFAULT_USD_ILS_RATE;

  editingTxIndex: number | null = null;
  editTxDate = '';
  editTxType: Transaction['type'] = 'deposit';
  editTxCurrency: InvestmentCurrency = 'ILS';
  editTxAmount: number | null = null;
  editTxExchangeRate: number = DEFAULT_USD_ILS_RATE;

  // Simulation projection
  projection: any[] = [];
  simulationYears = 10;

  constructor(
    private svc: InvestmentService,
    public exchangeRateSvc: ExchangeRateService
  ) { }

  ngOnChanges() {
    const incomingId = this.investment?.id;
    if (incomingId !== this._lastInvestmentId) {
      this._lastInvestmentId = incomingId;
      this.editingName = false;
      this.editingSnapIndex = null;
      this.editingTxIndex = null;
      this.pendingDeleteSnapshot = null;
      this.pendingDeleteTransaction = null;

      const defaultCurr: InvestmentCurrency = this.investment?.currency || (this.investment?.type === 'stock' ? 'USD' : 'ILS');
      this.viewCurrency = defaultCurr;
      this.resetNewSnapForm(defaultCurr);
      this.resetNewTxForm(defaultCurr);

      this.recalc();
    }
  }

  private _lastInvestmentId: string | undefined;

  resetNewSnapForm(curr?: InvestmentCurrency) {
    this.newSnapDate = today();
    this.newSnapCurrency = curr ?? (this.investment?.currency || (this.investment?.type === 'stock' ? 'USD' : 'ILS'));
    this.newSnapAmount = null;
    this.newSnapExchangeRate = this.exchangeRateSvc.usdRate();
  }

  resetNewTxForm(curr?: InvestmentCurrency) {
    this.newTxDate = today();
    this.newTxType = 'deposit';
    this.newTxCurrency = curr ?? (this.investment?.currency || (this.investment?.type === 'stock' ? 'USD' : 'ILS'));
    this.newTxAmount = null;
    this.newTxExchangeRate = this.exchangeRateSvc.usdRate();
  }

  switchViewCurrency(c: InvestmentCurrency) {
    if (this.viewCurrency === c) return;
    this.viewCurrency = c;
    this.recalc();
  }

  get rawSortedSnapshots(): Snapshot[] {
    return [...(this.investment?.snapshots ?? [])].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  get rawSortedTransactions(): Transaction[] {
    return [...(this.investment?.transactions ?? [])].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /** Snapshots converted to the active view currency with details for display */
  get displaySnapshots(): {
    snapshot: Snapshot;
    displayValue: number;
    originalNote?: string;
  }[] {
    return this.rawSortedSnapshots.map(s => {
      let displayValue: number;
      let originalNote: string | undefined;
      const r = this.exchangeRateSvc.effectiveRate(s.exchangeRate);

      if (this.viewCurrency === 'USD') {
        if (s.currency === 'USD' && s.currencyAmount != null) {
          displayValue = s.currencyAmount;
        } else {
          displayValue = Math.round((s.value / r) * 100) / 100;
        }
        if (s.currency === 'USD') {
          originalNote = `${s.value.toLocaleString()} ₪ (@ ${r})`;
        } else {
          originalNote = `מקור: ${s.value.toLocaleString()} ₪`;
        }
      } else {
        // ILS view
        displayValue = s.value;
        if (s.currency === 'USD') {
          originalNote = `$${(s.currencyAmount ?? (s.value / r)).toLocaleString()} (@ ${r})`;
        }
      }

      return { snapshot: s, displayValue, originalNote };
    });
  }

  /** Transactions converted to the active view currency with details for display */
  get displayTransactions(): {
    transaction: Transaction;
    displayAmount: number;
    originalNote?: string;
  }[] {
    return this.rawSortedTransactions.map(t => {
      let displayAmount: number;
      let originalNote: string | undefined;
      const r = this.exchangeRateSvc.effectiveRate(t.exchangeRate);

      if (this.viewCurrency === 'USD') {
        if (t.currency === 'USD' && t.currencyAmount != null) {
          displayAmount = t.currencyAmount;
        } else {
          displayAmount = Math.round((t.amount / r) * 100) / 100;
        }
        if (t.currency === 'USD') {
          originalNote = `${t.amount.toLocaleString()} ₪ (@ ${r})`;
        } else {
          originalNote = `מקור: ${t.amount.toLocaleString()} ₪`;
        }
      } else {
        // ILS view
        displayAmount = t.amount;
        if (t.currency === 'USD') {
          originalNote = `$${(t.currencyAmount ?? (t.amount / r)).toLocaleString()} (@ ${r})`;
        }
      }

      return { transaction: t, displayAmount, originalNote };
    });
  }

  // Live conversion helpers for the Add forms
  get newSnapConvertedIls(): number | null {
    if (this.newSnapAmount == null || this.newSnapAmount <= 0) return null;
    if (this.newSnapCurrency === 'USD') {
      return this.exchangeRateSvc.toIls(this.newSnapAmount, this.newSnapExchangeRate);
    }
    return null;
  }

  get newSnapConvertedUsd(): number | null {
    if (this.newSnapAmount == null || this.newSnapAmount <= 0) return null;
    if (this.newSnapCurrency === 'ILS') {
      return this.exchangeRateSvc.toUsd(this.newSnapAmount, this.newSnapExchangeRate);
    }
    return null;
  }

  get newTxConvertedIls(): number | null {
    if (this.newTxAmount == null || this.newTxAmount <= 0) return null;
    if (this.newTxCurrency === 'USD') {
      return this.exchangeRateSvc.toIls(this.newTxAmount, this.newTxExchangeRate);
    }
    return null;
  }

  get newTxConvertedUsd(): number | null {
    if (this.newTxAmount == null || this.newTxAmount <= 0) return null;
    if (this.newTxCurrency === 'ILS') {
      return this.exchangeRateSvc.toUsd(this.newTxAmount, this.newTxExchangeRate);
    }
    return null;
  }

  private recalc(fresh?: Investment) {
    const inv = fresh ?? this.investment;
    if (!inv) return;
    const rate = this.exchangeRateSvc.effectiveRate();

    const targetInv = this.svc.toCurrency(inv, this.viewCurrency, rate);
    const snaps = targetInv.snapshots ?? [];
    const txs = targetInv.transactions ?? [];

    this.cagr = this.svc.cagr(snaps);
    this.xirr = this.svc.xirr(targetInv);

    const sorted = [...snaps].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    this.currentValue = sorted.at(-1)?.value ?? null;
    this.totalDeposits = txs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0) || null;
    const withdrawals = txs.filter(t => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0);
    this.totalProfit = this.currentValue !== null && this.totalDeposits !== null
      ? this.currentValue - this.totalDeposits + withdrawals : null;

    // Secondary currency figures
    const otherCurrency: InvestmentCurrency = this.viewCurrency === 'USD' ? 'ILS' : 'USD';
    const otherInv = this.svc.toCurrency(inv, otherCurrency, rate);
    const otherSorted = [...otherInv.snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    this.secondaryCurrentValue = otherSorted.at(-1)?.value ?? null;
    const otherDeposits = otherInv.transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0) || null;
    const otherWithdrawals = otherInv.transactions.filter(t => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0);
    this.secondaryTotalDeposits = otherDeposits;
    this.secondaryProfit = this.secondaryCurrentValue !== null && otherDeposits !== null
      ? this.secondaryCurrentValue - otherDeposits + otherWithdrawals : null;

    // yearly XIRR + profit per year
    this.xirrYears = this.svc.xirrByYear(targetInv);
    this.yearlyChart = this.xirrYears.length ? buildYearlyXirrChart(this.xirrYears) : null;
    this.periodRows = this.svc.periodReturns(targetInv);

    this.buildChart(snaps);
    this.runSimulation(targetInv);
  }

  private runSimulation(inv: Investment) {
    this.projection = this.svc.calculateSimulation(
      this.currentValue || 0,
      inv.annualReturn || 7,
      this.simulationYears,
      inv.simulationRules || []
    ).projVals.filter((_, i) => i % 12 === 0).map((v, i) => ({ year: i, value: v }));
  }

  // --- Name & Currency ---
  startEditName() {
    this.editNameVal = this.investment.name;
    this.editTypeVal = this.investment.type;
    this.editCurrencyVal = this.investment.currency || (this.investment.type === 'stock' ? 'USD' : 'ILS');
    this.editingName = true;
  }

  saveName() {
    if (!this.editNameVal.trim()) return;
    this.svc.update(this.investment.id, {
      name: this.editNameVal.trim(),
      type: this.editTypeVal,
      currency: this.editCurrencyVal
    }).subscribe(updated => {
      this.recalc(updated);
      this.changed.emit();
    });
    this.editingName = false;
  }

  // --- Snapshots ---
  addSnapshot() {
    if (!this.newSnapDate || this.newSnapAmount == null) return;
    const rate = this.exchangeRateSvc.effectiveRate(this.newSnapExchangeRate);
    const isUsd = this.newSnapCurrency === 'USD';
    const ilsValue = isUsd ? Math.round(this.newSnapAmount * rate * 100) / 100 : this.newSnapAmount;

    this.svc.addSnapshot(this.investment.id, {
      date: this.newSnapDate,
      value: ilsValue,
      currency: this.newSnapCurrency,
      currencyAmount: this.newSnapAmount,
      exchangeRate: rate
    }).subscribe(updated => {
      this.recalc(updated);
      this.changed.emit();
    });

    this.resetNewSnapForm();
  }

  startEditSnapshot(i: number) {
    const s = this.rawSortedSnapshots[i];
    this.editSnapDate = s.date;
    this.editSnapCurrency = s.currency || (this.investment.currency === 'USD' ? 'USD' : 'ILS');
    this.editSnapExchangeRate = this.exchangeRateSvc.effectiveRate(s.exchangeRate);
    if (this.editSnapCurrency === 'USD') {
      this.editSnapAmount = s.currencyAmount ?? Math.round((s.value / this.editSnapExchangeRate) * 100) / 100;
    } else {
      this.editSnapAmount = s.value;
    }
    this.editingSnapIndex = i;
  }

  saveSnapshot(i: number) {
    if (!this.editSnapDate || this.editSnapAmount == null) return;
    const original = this.rawSortedSnapshots[i];
    if (!original.id) { console.error('Snapshot missing id', original); return; }

    const rate = this.exchangeRateSvc.effectiveRate(this.editSnapExchangeRate);
    const isUsd = this.editSnapCurrency === 'USD';
    const ilsValue = isUsd ? Math.round(this.editSnapAmount * rate * 100) / 100 : this.editSnapAmount;

    this.svc.updateSnapshot(this.investment.id, original.id, {
      date: this.editSnapDate,
      value: ilsValue,
      currency: this.editSnapCurrency,
      currencyAmount: this.editSnapAmount,
      exchangeRate: rate
    }).subscribe(updated => {
      this.recalc(updated);
      this.changed.emit();
    });
    this.editingSnapIndex = null;
  }

  // Pending delete state
  pendingDeleteSnapshot: Snapshot | null = null;
  pendingDeleteTransaction: Transaction | null = null;

  confirmDeleteSnapshot(s: Snapshot) { this.pendingDeleteSnapshot = s; }
  cancelDeleteSnapshot() { this.pendingDeleteSnapshot = null; }
  doDeleteSnapshot() {
    if (!this.pendingDeleteSnapshot) return;
    const s = this.pendingDeleteSnapshot;
    this.pendingDeleteSnapshot = null;
    if (!s.id) { console.error('Snapshot missing id', s); return; }
    this.svc.deleteSnapshot(this.investment.id, s.id).subscribe(updated => {
      this.recalc(updated);
      this.changed.emit();
    });
  }

  confirmDeleteTransaction(tx: Transaction) { this.pendingDeleteTransaction = tx; }
  cancelDeleteTransaction() { this.pendingDeleteTransaction = null; }
  doDeleteTransaction() {
    if (!this.pendingDeleteTransaction) return;
    const tx = this.pendingDeleteTransaction;
    this.pendingDeleteTransaction = null;
    if (!tx.id) { console.error('Transaction missing id', tx); return; }
    this.svc.deleteTransaction(this.investment.id, tx.id).subscribe(updated => {
      this.recalc(updated);
      this.changed.emit();
    });
  }

  // --- Transactions ---
  addTransaction() {
    if (!this.newTxDate || this.newTxAmount == null || !this.newTxType) return;
    const rate = this.exchangeRateSvc.effectiveRate(this.newTxExchangeRate);
    const isUsd = this.newTxCurrency === 'USD';
    const ilsAmount = isUsd ? Math.round(this.newTxAmount * rate * 100) / 100 : this.newTxAmount;

    this.svc.addTransaction(this.investment.id, {
      date: this.newTxDate,
      amount: ilsAmount,
      type: this.newTxType,
      currency: this.newTxCurrency,
      currencyAmount: this.newTxAmount,
      exchangeRate: rate
    }).subscribe(updated => {
      this.recalc(updated);
      this.changed.emit();
    });

    this.resetNewTxForm();
  }

  startEditTransaction(i: number) {
    const t = this.rawSortedTransactions[i];
    this.editTxDate = t.date;
    this.editTxType = t.type;
    this.editTxCurrency = t.currency || (this.investment.currency === 'USD' ? 'USD' : 'ILS');
    this.editTxExchangeRate = this.exchangeRateSvc.effectiveRate(t.exchangeRate);
    if (this.editTxCurrency === 'USD') {
      this.editTxAmount = t.currencyAmount ?? Math.round((t.amount / this.editTxExchangeRate) * 100) / 100;
    } else {
      this.editTxAmount = t.amount;
    }
    this.editingTxIndex = i;
  }

  saveTransaction() {
    if (!this.editTxDate || this.editTxAmount == null || this.editingTxIndex === null) return;
    const original = this.rawSortedTransactions[this.editingTxIndex];
    if (!original.id) { console.error('Transaction missing id', original); return; }

    const rate = this.exchangeRateSvc.effectiveRate(this.editTxExchangeRate);
    const isUsd = this.editTxCurrency === 'USD';
    const ilsAmount = isUsd ? Math.round(this.editTxAmount * rate * 100) / 100 : this.editTxAmount;

    this.svc.updateTransaction(this.investment.id, original.id, {
      date: this.editTxDate,
      amount: ilsAmount,
      type: this.editTxType,
      currency: this.editTxCurrency,
      currencyAmount: this.editTxAmount,
      exchangeRate: rate
    }).subscribe(updated => {
      this.recalc(updated);
      this.changed.emit();
    });
    this.editingTxIndex = null;
  }

  // --- Simulation Rules ---
  addRule() {
    const rule: Partial<SimulationRule> = { fromMonth: 1, toMonth: 120, monthlyAmount: 0, oneTimeAmount: 0, description: '' };
    this.svc.addSimulationRule(this.investment.id, rule).subscribe(updated => this.recalc(updated));
  }

  updateRule(rule: SimulationRule) {
    this.svc.updateSimulationRule(this.investment.id, rule.id, rule).subscribe(updated => this.recalc(updated));
  }

  deleteRule(ruleId: string) {
    this.svc.deleteSimulationRule(this.investment.id, ruleId).subscribe(updated => this.recalc(updated));
  }

  // --- Chart ---
  shouldShowXLabel(i: number): boolean {
    const n = this.chartData.length;
    if (n <= 6) return true;
    return i % Math.ceil(n / 5) === 0 || i === n - 1;
  }

  private buildChart(snaps: Snapshot[]) {
    const sorted = [...snaps].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sorted.length < 2) { this.chartData = []; return; }
    const values = sorted.map(s => s.value);
    const minV = Math.min(...values), maxV = Math.max(...values);
    const range = maxV - minV || 1;
    this.chartData = sorted.map((s, i) => ({
      x: (i / (sorted.length - 1)) * CW,
      y: CH - ((s.value - minV) / range) * CH,
      date: s.date, value: s.value
    }));
    this.linePoints = this.chartData.map(p => `${p.x},${p.y}`).join(' ');
    this.areaPath = `M${this.chartData[0].x},${CH} ` + this.chartData.map(p => `L${p.x},${p.y}`).join(' ') + ` L${this.chartData.at(-1)!.x},${CH} Z`;
    this.yTicks = [0, 1, 2, 3].map(i => {
      const v = minV + (range / 3) * i;
      const formatted = v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v.toFixed(0);
      return { y: CH - ((v - minV) / range) * CH, label: this.currencySymbol + formatted };
    });
  }
}

function today(): string { return new Date().toISOString().slice(0, 10); }

