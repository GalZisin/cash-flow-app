import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Investment, Snapshot, Transaction } from '../../models/investment.model';
import { InvestmentService } from '../../services/investment.service';

const W = 600, H = 300, PAD = { top: 12, right: 16, bottom: 32, left: 60 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

@Component({
  selector: 'app-investment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatTooltipModule, DecimalPipe],
  styles: [`
    .det-card { border-radius: 14px; border: 1px solid #e8eaed; background: #fff; overflow: hidden; }
    .det-header { padding: 14px 16px; background: #fff; border-bottom: 1px solid #f0f2f5; }
    .det-name { font-weight: 700; font-size: 1rem; color: #1e293b; }
    .badge-type { background: #f1f5f9; color: #475569; font-size: 0.72rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .badge-cagr { background: #e8eeff; color: #2d4fd6; font-size: 0.72rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; cursor:help; }
    .badge-xirr { background: #fff4e0; color: #a05c00; font-size: 0.72rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; cursor:help; }
    .edit-btn { background: #f1f5f9; border: none; border-radius: 8px; padding: 4px 10px; color: #475569; font-size: 0.8rem; cursor: pointer; transition: background 0.12s; }
    .edit-btn:hover { background: #e2e8f0; }
    .del-btn { background: transparent; border: none; border-radius: 6px; padding: 3px 7px; color: #cbd5e1; cursor: pointer; transition: all 0.12s; }
    .del-btn:hover { background: #fee2e2; color: #dc2626; }
    .chart-wrap { background: #f8f9fb; border-radius: 10px; padding: 8px 4px 4px; margin-bottom: 14px; }
    .section-title { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; padding: 12px 16px 6px; }
    .snap-table th { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; border-bottom: 1px solid #f0f2f5; padding: 8px 10px; }
    .snap-table td { font-size: 0.85rem; color: #1e293b; padding: 8px 10px; border-bottom: 1px solid #f8f9fb; vertical-align: middle; }
    .snap-table tr:last-child td { border-bottom: none; }
    .table-scroll { max-height: 250px; overflow-y: auto; display: block; }
    .table-scroll thead th { position: sticky; top: 0; background: #fff; z-index: 1; }
    .pct-pos { color: #1a7a52; font-weight: 600; }
    .pct-neg { color: #c0392b; font-weight: 600; }
    .add-row { background: #f8f9fb; border-top: 1px solid #f0f2f5; padding: 12px 16px; }
    .save-btn { background: #4f6ef7; color: #fff; border: none; border-radius: 8px; font-weight: 600; font-size: 0.82rem; padding: 6px 14px; white-space: nowrap; }
    .save-btn:hover { background: #3b5bdb; }
    .row-save-btn { background: #e6f7f0; color: #1a7a52; border: none; border-radius: 6px; padding: 3px 10px; font-weight: 600; }
    .row-cancel-btn { background: #f1f5f9; color: #475569; border: none; border-radius: 6px; padding: 3px 10px; }
    .badge-deposit { background: #e6f7f0; color: #1a7a52; font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
    .badge-withdraw { background: #fee2e2; color: #dc2626; font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
    .divider { border: none; border-top: 1px solid #f0f2f5; margin: 0; }
  `],
  template: `
    <div class="det-card">

      <!-- Header -->
      <div class="det-header">
        @if (!editingName) {
          <div class="d-flex justify-content-between align-items-center">
            <span class="det-name">{{ investment.name }}</span>
            <div class="d-flex align-items-center gap-2">
              <span class="badge-type">{{ investment.type }}</span>
              @if (cagr !== null) {
                <span class="badge-cagr" [matTooltip]="'INVESTMENTS.CAGR_TOOLTIP' | translate">
                  CAGR {{ cagr | number:'1.1-1' }}%
                </span>
              }
              @if (xirr !== null) {
                <span class="badge-xirr" matTooltip="Internal Rate of Return (XIRR)">
                  XIRR {{ xirr | number:'1.1-1' }}%
                </span>
              }
              <button class="edit-btn" [matTooltip]="'INVESTMENTS.EDIT_TOOLTIP' | translate" (click)="startEditName()">✏️</button>
            </div>
          </div>
        }
        @if (editingName) {
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <input class="form-control form-control-sm" [(ngModel)]="editNameVal" style="max-width:180px" />
            <select class="form-select form-select-sm" [(ngModel)]="editTypeVal" style="max-width:120px">
              <option value="pension">{{ 'INVESTMENTS.PENSION' | translate }}</option>
              <option value="fund">{{ 'INVESTMENTS.FUND' | translate }}</option>
              <option value="stock">{{ 'INVESTMENTS.STOCK' | translate }}</option>
              <option value="other">{{ 'INVESTMENTS.OTHER' | translate }}</option>
            </select>
            <button class="row-save-btn" (click)="saveName()">{{ 'INVESTMENTS.SAVE' | translate }}</button>
            <button class="row-cancel-btn" (click)="editingName = false">✕</button>
          </div>
        }
      </div>

      <!-- Chart -->
      @if (investment.snapshots.length > 1) {
        <div class="chart-wrap mx-3 mt-3">
          <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="w-100" style="display:block; overflow:visible; max-height:300px">
            <g [attr.transform]="'translate(' + PAD.left + ',' + PAD.top + ')'">
              @for (tick of yTicks; track tick.y) {
                <line [attr.x1]="0" [attr.y1]="tick.y" [attr.x2]="CW" [attr.y2]="tick.y" stroke="#e8eaed" stroke-width="1" stroke-dasharray="3"/>
                <text [attr.x]="-8" [attr.y]="tick.y + 4" text-anchor="end" font-size="9" fill="#94a3b8">{{ tick.label }}</text>
              }
              @for (pt of chartData; track pt.date; let i = $index) {
                @if (shouldShowXLabel(i)) {
                  <text [attr.x]="pt.x" [attr.y]="CH + 20" text-anchor="middle" font-size="9" fill="#94a3b8">{{ pt.date | slice:0:7 }}</text>
                }
              }
              <line x1="0" [attr.y1]="CH" [attr.x2]="CW" [attr.y2]="CH" stroke="#e8eaed" stroke-width="1"/>
              <line x1="0" y1="0" x2="0" [attr.y2]="CH" stroke="#e8eaed" stroke-width="1"/>
              <path [attr.d]="areaPath" fill="#4f6ef7" fill-opacity="0.07"/>
              <polyline [attr.points]="linePoints" fill="none" stroke="#4f6ef7" stroke-width="2" stroke-linejoin="round"/>
              @for (pt of chartData; track pt.date) {
                <circle class="dot" [attr.cx]="pt.x" [attr.cy]="pt.y" r="4"
                  fill="#fff" stroke="#4f6ef7" stroke-width="2"
                  [matTooltip]="pt.date + ' — ' + (pt.value | number:'1.0-0') + ' ₪'"
                  style="cursor:pointer"/>
              }
            </g>
          </svg>
        </div>
      }

      <!-- ═══ SNAPSHOTS TABLE ═══ -->
      <div class="section-title">📈 {{ 'INVESTMENTS.SNAPSHOTS_SECTION' | translate }}</div>
      <div class="table-scroll">
      <table class="snap-table w-100">
        <thead><tr>
          <th>{{ 'INVESTMENTS.DATE' | translate }}</th>
          <th>{{ 'INVESTMENTS.VALUE' | translate }}</th>
          <th>{{ 'INVESTMENTS.CHANGE' | translate }}</th>
          <th></th>
        </tr></thead>
        <tbody>
          @for (s of sortedSnapshots; track s.date; let i = $index) {
            <tr>
              @if (editingSnapIndex === i) {
                <td><input type="date" class="form-control form-control-sm" [(ngModel)]="editSnap.date" /></td>
                <td><input type="number" class="form-control form-control-sm" [(ngModel)]="editSnap.value" /></td>
                <td></td>
                <td>
                  <div class="d-flex gap-1">
                    <button class="row-save-btn" (click)="saveSnapshot(i)">✓</button>
                    <button class="row-cancel-btn" (click)="editingSnapIndex = null">✕</button>
                  </div>
                </td>
              } @else {
                <td>{{ s.date }}</td>
                <td>{{ s.value | number:'1.0-0' }} ₪</td>
                <td>
                  @if (i > 0) {
                    <span [class]="snapChange(i) > 0 ? 'pct-pos' : 'pct-neg'">
                      {{ snapChange(i) > 0 ? '▲' : '▼' }} {{ snapChange(i) | number:'1.1-1' }}%
                    </span>
                  }
                </td>
                <td>
                  <div class="d-flex gap-1">
                    <button class="edit-btn" style="padding:2px 8px; font-size:0.75rem"
                      [matTooltip]="'INVESTMENTS.EDIT_TOOLTIP' | translate"
                      (click)="startEditSnapshot(i)">✏️</button>
                    <button class="del-btn" [matTooltip]="'INVESTMENTS.DELETE_SNAPSHOT_TOOLTIP' | translate"
                      (click)="deleteSnapshot(s)">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
      </div>

      <!-- Add Snapshot -->
      <div class="add-row">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <input type="date" class="form-control form-control-sm" [(ngModel)]="newSnap.date" />
          </div>
          <div class="col-md-4">
            <input type="number" class="form-control form-control-sm" [(ngModel)]="newSnap.value"
              [placeholder]="'INVESTMENTS.VALUE' | translate" />
          </div>
          <div class="col-md-4">
            <button class="save-btn w-100" (click)="addSnapshot()">{{ 'INVESTMENTS.ADD_SNAPSHOT' | translate }}</button>
          </div>
        </div>
      </div>

      <hr class="divider">

      <!-- ═══ TRANSACTIONS TABLE ═══ -->
      <div class="section-title">💸 {{ 'INVESTMENTS.TRANSACTIONS_SECTION' | translate }}</div>
      <div class="table-scroll">
      <table class="snap-table w-100">
        <thead><tr>
          <th>{{ 'INVESTMENTS.DATE' | translate }}</th>
          <th>{{ 'INVESTMENTS.TX_TYPE' | translate }}</th>
          <th>{{ 'INVESTMENTS.AMOUNT' | translate }}</th>
          <th></th>
        </tr></thead>
        <tbody>
          @for (t of sortedTransactions; track t.date; let i = $index) {
            <tr>
              @if (editingTxIndex === i) {
                <td><input type="date" class="form-control form-control-sm" [(ngModel)]="editTx.date" /></td>
                <td>
                  <select class="form-select form-select-sm" [(ngModel)]="editTx.type">
                    <option value="deposit">{{ 'INVESTMENTS.DEPOSIT' | translate }}</option>
                    <option value="withdraw">{{ 'INVESTMENTS.WITHDRAW' | translate }}</option>
                  </select>
                </td>
                <td><input type="number" class="form-control form-control-sm" [(ngModel)]="editTx.amount" /></td>
                <td>
                  <div class="d-flex gap-1">
                    <button class="row-save-btn" (click)="saveTransaction()">✓</button>
                    <button class="row-cancel-btn" (click)="editingTxIndex = null">✕</button>
                  </div>
                </td>
              } @else {
                <td>{{ t.date }}</td>
                <td>
                  <span [class]="t.type === 'deposit' ? 'badge-deposit' : 'badge-withdraw'">
                    {{ t.type === 'deposit' ? ('INVESTMENTS.DEPOSIT' | translate) : ('INVESTMENTS.WITHDRAW' | translate) }}
                  </span>
                </td>
                <td>{{ t.amount | number:'1.0-0' }} ₪</td>
                <td>
                  <div class="d-flex gap-1">
                    <button class="edit-btn" style="padding:2px 8px; font-size:0.75rem"
                      [matTooltip]="'INVESTMENTS.EDIT_TOOLTIP' | translate"
                      (click)="startEditTransaction(i)">✏️</button>
                    <button class="del-btn" [matTooltip]="'INVESTMENTS.DELETE_SNAPSHOT_TOOLTIP' | translate"
                      (click)="deleteTransaction(t)">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
      </div>

      <!-- Add Transaction -->
      <div class="add-row">
        <div class="row g-2 align-items-end">
          <div class="col-md-3">
            <input type="date" class="form-control form-control-sm" [(ngModel)]="newTx.date" />
          </div>
          <div class="col-md-3">
            <select class="form-select form-select-sm" [(ngModel)]="newTx.type">
              <option value="deposit">{{ 'INVESTMENTS.DEPOSIT' | translate }}</option>
              <option value="withdraw">{{ 'INVESTMENTS.WITHDRAW' | translate }}</option>
            </select>
          </div>
          <div class="col-md-3">
            <input type="number" class="form-control form-control-sm" [(ngModel)]="newTx.amount"
              [placeholder]="'INVESTMENTS.AMOUNT' | translate" />
          </div>
          <div class="col-md-3">
            <button class="save-btn w-100" (click)="addTransaction()">{{ 'INVESTMENTS.ADD_TX' | translate }}</button>
          </div>
        </div>
      </div>

    </div>
  `
})
export class InvestmentDetailComponent implements OnChanges {
  @Input() investment!: Investment;
  @Output() changed = new EventEmitter<void>();

  readonly W = W; readonly H = H; readonly PAD = PAD; readonly CW = CW; readonly CH = CH;

  // Metrics
  cagr: number | null = null;
  xirr: number | null = null;

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

  constructor(private svc: InvestmentService) { }

  ngOnChanges() {
    this.editingName = false;
    this.editingSnapIndex = null;
    this.editingTxIndex = null;
    this.recalc();
  }

  get sortedSnapshots(): Snapshot[] {
    return [...(this.investment.snapshots ?? [])].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  get sortedTransactions(): Transaction[] {
    return [...(this.investment.transactions ?? [])].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private recalc() {
    this.cagr = this.svc.cagr(this.investment.snapshots ?? []);
    this.xirr = this.svc.xirr(this.investment);
    this.buildChart();
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
    }).subscribe();

    this.newSnap = { date: today() };
  }

  startEditSnapshot(i: number) {
    const s = this.sortedSnapshots[i];
    this.editSnap = { ...s };
    this.editingSnapIndex = i;
  }

  saveSnapshot(i: number) {
    if (!this.editSnap.date || this.editSnap.value == null) return;

    const snapshot = this.sortedSnapshots[i]; // 🔥 לוקחים את האובייקט

    this.svc.updateSnapshot(this.investment.id, snapshot.id, {
      date: this.editSnap.date,
      value: +this.editSnap.value
    }).subscribe();

    this.editingSnapIndex = null;
  }

  deleteSnapshot(s: Snapshot) {
    this.svc.deleteSnapshot(this.investment.id, s.id).subscribe();
  }

  snapChange(i: number): number {
    const s = this.sortedSnapshots;
    return ((s[i].value - s[i - 1].value) / s[i - 1].value) * 100;
  }

  // --- Transactions ---
  addTransaction() {
    if (!this.newTx.date || this.newTx.amount == null || !this.newTx.type) return;

    this.svc.addTransaction(this.investment.id, {
      date: this.newTx.date,
      amount: +this.newTx.amount,
      type: this.newTx.type
    }).subscribe();

    this.newTx = { date: today(), type: 'deposit' };
  }

  startEditTransaction(i: number) {
    this.editTx = { ...this.sortedTransactions[i] };
    this.editingTxIndex = i;
  }

  saveTransaction() {
    if (!this.editTx.date || this.editTx.amount == null) return;

    this.svc.updateTransaction(this.investment.id, this.editTx as Transaction)
      .subscribe(() => this.recalc());

    this.editingTxIndex = null;
  }

  deleteTransaction(tx: Transaction) {
    this.svc.deleteTransaction(this.investment.id, tx.id)
      .subscribe(() => this.recalc());
  }

  // --- Chart ---
  shouldShowXLabel(i: number): boolean {
    const n = this.chartData.length;
    if (n <= 6) return true;
    return i % Math.ceil(n / 5) === 0 || i === n - 1;
  }

  private buildChart() {
    const snaps = this.sortedSnapshots;
    if (snaps.length < 2) { this.chartData = []; return; }
    const values = snaps.map(s => s.value);
    const minV = Math.min(...values), maxV = Math.max(...values);
    const range = maxV - minV || 1;
    this.chartData = snaps.map((s, i) => ({
      x: (i / (snaps.length - 1)) * CW,
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
