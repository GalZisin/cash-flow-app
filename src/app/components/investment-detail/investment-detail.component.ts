import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Investment, Snapshot, Transaction, SimulationRule } from '../../models/investment.model';
import { InvestmentService } from '../../services/investment.service';

const W = 600, H = 360, PAD = { top: 24, right: 24, bottom: 48, left: 70 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

@Component({
  selector: 'app-investment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatTooltipModule, DecimalPipe],
  templateUrl: './investment-detail.component.html',
  styleUrl: './investment-detail.component.scss'
})
export class InvestmentDetailComponent implements OnChanges {
  @Input() investment!: Investment;
  @Output() changed = new EventEmitter<void>();

  readonly W = W; readonly H = H; readonly PAD = PAD; readonly CW = CW; readonly CH = CH;
  readonly Math = Math;

  // Metrics
  cagr: number | null = null;
  xirr: number | null = null;
  totalProfit: number | null = null;
  currentValue: number | null = null;
  totalDeposits: number | null = null;
  xirrYears: { year: number; value: number | null; profit: number | null }[] = [];

  // Chart
  chartData: { x: number; y: number; date: string; value: number }[] = [];
  linePoints = ''; areaPath = '';
  yTicks: { y: number; label: string }[] = [];

  // Name editing
  editingName = false;
  editNameVal = ''; editTypeVal: Investment['type'] = 'fund';

  // Snapshot editing
  editingSnapIndex: number | null = null;
  editSnap: Partial<Snapshot> = {};
  newSnap: Partial<Snapshot> = { date: today() };

  // Transaction editing
  editingTxIndex: number | null = null;
  editTx: Partial<Transaction> = {};
  newTx: Partial<Transaction> = { date: today(), type: 'deposit' };

  // Simulation projection
  projection: any[] = [];
  simulationYears = 10;

  constructor(private svc: InvestmentService) { }

  ngOnChanges() {
    // Only reset edit state and recalc when switching to a different investment.
    // If the same investment is updated (patch from server), the subscribe callbacks
    // handle recalc(fresh) directly — we don't want ngOnChanges to interfere.
    const incomingId = this.investment?.id;
    if (incomingId !== this._lastInvestmentId) {
      this._lastInvestmentId = incomingId;
      this.editingName = false;
      this.editingSnapIndex = null;
      this.editingTxIndex = null;
      this.pendingDeleteSnapshot = null;
      this.pendingDeleteTransaction = null;
      this.recalc();
    }
  }

  private _lastInvestmentId: string | undefined;

  get sortedSnapshots(): Snapshot[] {
    return [...(this.investment.snapshots ?? [])].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  get sortedTransactions(): Transaction[] {
    return [...(this.investment.transactions ?? [])].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private recalc(fresh?: Investment) {
    const inv = fresh ?? this.investment;
    const snaps = inv.snapshots ?? [];
    const txs = inv.transactions ?? [];

    this.cagr = this.svc.cagr(snaps);
    this.xirr = this.svc.xirr(inv);

    const sorted = [...snaps].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    this.currentValue = sorted.at(-1)?.value ?? null;
    this.totalDeposits = txs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0) || null;
    this.totalProfit = this.currentValue !== null && this.totalDeposits !== null
      ? this.currentValue - this.totalDeposits : null;

    // yearly XIRR + profit per year
    const byYear = this.svc.xirrByYear(inv);
    this.xirrYears = byYear.map(({ year, value }) => {
      const yearSnaps = sorted.filter(s => new Date(s.date).getFullYear() === year);
      const prevSnap = sorted.filter(s => new Date(s.date).getFullYear() < year).at(-1);
      const endVal = yearSnaps.at(-1)?.value ?? null;
      const startVal = prevSnap?.value ?? null;
      const yearDeposits = txs
        .filter(t => t.type === 'deposit' && new Date(t.date).getFullYear() === year)
        .reduce((s, t) => s + t.amount, 0);
      const profit = endVal !== null && startVal !== null
        ? endVal - startVal - yearDeposits : null;
      return { year, value, profit };
    });

    this.buildChart(snaps);
    this.runSimulation(inv);
  }

  private runSimulation(inv: Investment) {
    this.projection = this.svc.calculateSimulation(
      this.currentValue || 0,
      inv.annualReturn || 7,
      this.simulationYears,
      inv.simulationRules || []
    ).projVals.filter((_, i) => i % 12 === 0).map((v, i) => ({ year: i, value: v }));
  }

  // --- Name ---
  startEditName() { this.editNameVal = this.investment.name; this.editTypeVal = this.investment.type; this.editingName = true; }
  saveName() {
    if (!this.editNameVal.trim()) return;
    this.svc.update(this.investment.id, { name: this.editNameVal.trim(), type: this.editTypeVal }).subscribe();
    this.editingName = false;
  }

  // --- Snapshots ---
  addSnapshot() {
    if (!this.newSnap.date || this.newSnap.value == null) return;

    this.svc.addSnapshot(this.investment.id, {
      date: this.newSnap.date,
      value: +this.newSnap.value
    }).subscribe(updated => this.recalc(updated));

    this.newSnap = { date: today() };
  }

  startEditSnapshot(i: number) {
    const s = this.sortedSnapshots[i];
    this.editSnap = { ...s };
    this.editingSnapIndex = i;
  }

  saveSnapshot(i: number) {
    if (!this.editSnap.date || this.editSnap.value == null) return;
    const original = this.sortedSnapshots[i];
    if (!original.id) { console.error('Snapshot missing id', original); return; }
    this.svc.updateSnapshot(this.investment.id, original.id, {
      date: this.editSnap.date,
      value: +this.editSnap.value
    }).subscribe(updated => this.recalc(updated));
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
    this.svc.deleteSnapshot(this.investment.id, s.id).subscribe(updated => this.recalc(updated));
  }

  confirmDeleteTransaction(tx: Transaction) { this.pendingDeleteTransaction = tx; }
  cancelDeleteTransaction() { this.pendingDeleteTransaction = null; }
  doDeleteTransaction() {
    if (!this.pendingDeleteTransaction) return;
    const tx = this.pendingDeleteTransaction;
    this.pendingDeleteTransaction = null;
    if (!tx.id) { console.error('Transaction missing id', tx); return; }
    this.svc.deleteTransaction(this.investment.id, tx.id).subscribe(updated => this.recalc(updated));
  }

  snapChange(i: number): number | null {
    if (i <= 0) return null;
    const s = this.sortedSnapshots;
    const prev = s[i - 1].value;
    if (prev === 0) return null;
    return ((s[i].value - prev) / prev) * 100;
  }

  // --- Transactions ---
  addTransaction() {
    if (!this.newTx.date || this.newTx.amount == null || !this.newTx.type) return;

    this.svc.addTransaction(this.investment.id, {
      date: this.newTx.date,
      amount: +this.newTx.amount,
      type: this.newTx.type
    }).subscribe(updated => this.recalc(updated));

    this.newTx = { date: today(), type: 'deposit' };
  }

  startEditTransaction(i: number) {
    this.editTx = { ...this.sortedTransactions[i] };
    this.editingTxIndex = i;
  }

  saveTransaction() {
    if (!this.editTx.date || this.editTx.amount == null || this.editingTxIndex === null) return;
    const original = this.sortedTransactions[this.editingTxIndex];
    if (!original.id) { console.error('Transaction missing id', original); return; }
    this.svc.updateTransaction(this.investment.id, original.id, this.editTx as Transaction)
      .subscribe(updated => this.recalc(updated));
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
      return { y: CH - ((v - minV) / range) * CH, label: v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v.toFixed(0) };
    });
  }
}

function today(): string { return new Date().toISOString().slice(0, 10); }
