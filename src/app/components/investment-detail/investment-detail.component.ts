import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Investment, Snapshot } from '../../models/investment.model';
import { InvestmentService } from '../../services/investment.service';

const W = 1000, H = 300, PAD = { top: 12, right: 16, bottom: 32, left: 60 };
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
    .badge-cagr { background: #e8eeff; color: #2d4fd6; font-size: 0.72rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .badge-xirr { background: #fff4e0; color: #a05c00; font-size: 0.72rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .edit-btn { background: #f1f5f9; border: none; border-radius: 8px; padding: 4px 10px; color: #475569; font-size: 0.8rem; cursor: pointer; transition: background 0.12s; }
    .edit-btn:hover { background: #e2e8f0; }
    .chart-wrap { background: #f8f9fb; border-radius: 10px; padding: 8px 4px 4px; margin-bottom: 14px; overflow: visible; }
    .snap-table th { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; border-bottom: 1px solid #f0f2f5; padding: 8px 10px; }
    .snap-table td { font-size: 0.85rem; color: #1e293b; padding: 8px 10px; border-bottom: 1px solid #f8f9fb; vertical-align: middle; }
    .snap-table tr:last-child td { border-bottom: none; }
    .pct-pos { color: #1a7a52; font-weight: 600; }
    .pct-neg { color: #c0392b; font-weight: 600; }
    .add-row { background: #f8f9fb; border-top: 1px solid #f0f2f5; padding: 12px 16px; }
    .save-snap-btn { background: #4f6ef7; color: #fff; border: none; border-radius: 8px; font-weight: 600; font-size: 0.82rem; padding: 6px 14px; white-space: nowrap; }
    .save-snap-btn:hover { background: #3b5bdb; }
    .row-save-btn { background: #e6f7f0; color: #1a7a52; border: none; border-radius: 6px; padding: 3px 10px; font-weight: 600; }
    .row-cancel-btn { background: #f1f5f9; color: #475569; border: none; border-radius: 6px; padding: 3px 10px; }
    .dot { cursor: pointer; transition: r 0.1s; }
    .dot:hover { r: 6; }
  `],
  template: `
    <div class="det-card">
      <div class="det-header">
        @if (!editing) {
          <div class="d-flex justify-content-between align-items-center">
            <span class="det-name">{{ investment.name }}</span>
            <div class="d-flex align-items-center gap-2">
              <span class="badge-type">{{ investment.type }}</span>
              @if (cagr !== null) { <span class="badge-cagr" [matTooltip]="'INVESTMENTS.CAGR_TOOLTIP' | translate">CAGR {{ cagr | number:'1.1-1' }}%</span> }
              @if (xirr !== null) { <span class="badge-xirr">XIRR {{ xirr | number:'1.1-1' }}%</span> }
              <button class="edit-btn" [matTooltip]="'INVESTMENTS.EDIT_TOOLTIP' | translate" (click)="startEdit()">✏️ {{ 'INVESTMENTS.EDIT_TOOLTIP' | translate }}</button>
            </div>
          </div>
        }
        @if (editing) {
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <input class="form-control form-control-sm" [(ngModel)]="editName" style="max-width:180px" />
            <select class="form-select form-select-sm" [(ngModel)]="editType" style="max-width:120px">
              <option value="pension">{{ 'INVESTMENTS.PENSION' | translate }}</option>
              <option value="fund">{{ 'INVESTMENTS.FUND' | translate }}</option>
              <option value="stock">{{ 'INVESTMENTS.STOCK' | translate }}</option>
              <option value="other">{{ 'INVESTMENTS.OTHER' | translate }}</option>
            </select>
            <button class="row-save-btn" [matTooltip]="'INVESTMENTS.SAVE_TOOLTIP' | translate" (click)="saveEdit()">{{ 'INVESTMENTS.SAVE' | translate }}</button>
            <button class="row-cancel-btn" [matTooltip]="'INVESTMENTS.CANCEL_TOOLTIP' | translate" (click)="editing = false">✕</button>
          </div>
        }
      </div>

      <div class="p-3">
        @if (investment.snapshots.length > 1) {
          <div class="chart-wrap">
            <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="w-100" style="display:block; overflow:visible; max-height:300px">
              <g [attr.transform]="'translate(' + PAD.left + ',' + PAD.top + ')'">

                <!-- Gridlines + Y axis labels -->
                @for (tick of yTicks; track tick.y) {
                  <line [attr.x1]="0" [attr.y1]="tick.y" [attr.x2]="CW" [attr.y2]="tick.y"
                    stroke="#e8eaed" stroke-width="1" stroke-dasharray="3"/>
                  <text [attr.x]="-8" [attr.y]="tick.y + 4" text-anchor="end"
                    font-size="9" fill="#94a3b8">{{ tick.label }}</text>
                }

                <!-- X axis labels -->
                @for (pt of chartData; track pt.date; let i = $index) {
                  @if (shouldShowXLabel(i)) {
                    <text [attr.x]="pt.x" [attr.y]="CH + 20" text-anchor="middle"
                      font-size="9" fill="#94a3b8">{{ pt.date | slice:0:7 }}</text>
                  }
                }

                <!-- Axes -->
                <line x1="0" [attr.y1]="CH" [attr.x2]="CW" [attr.y2]="CH" stroke="#e8eaed" stroke-width="1"/>
                <line x1="0" y1="0" x2="0" [attr.y2]="CH" stroke="#e8eaed" stroke-width="1"/>

                <!-- Area fill -->
                <path [attr.d]="areaPath" fill="#4f6ef7" fill-opacity="0.07"/>

                <!-- Line -->
                <polyline [attr.points]="linePoints" fill="none" stroke="#4f6ef7" stroke-width="2" stroke-linejoin="round"/>

                <!-- Data points -->
                @for (pt of chartData; track pt.date; let i = $index) {
                  <circle
                    class="dot"
                    [attr.cx]="pt.x" [attr.cy]="pt.y" r="4"
                    fill="#fff" stroke="#4f6ef7" stroke-width="2"
                    [matTooltip]="pt.date + '\n' + (pt.value | number:'1.0-0') + ' ₪' + (pt.deposit ? '\n+' + (pt.deposit | number:'1.0-0') + ' ₪' : '')"
                    matTooltipClass="chart-tooltip"
                  />
                }
              </g>
            </svg>
          </div>
        }

        <table class="snap-table w-100">
          <thead><tr>
            <th>{{ 'INVESTMENTS.DATE' | translate }}</th>
            <th>{{ 'INVESTMENTS.VALUE' | translate }}</th>
            <th>{{ 'INVESTMENTS.DEPOSIT' | translate }}</th>
            <th>{{ 'INVESTMENTS.CHANGE' | translate }}</th>
            <th></th>
          </tr></thead>
          <tbody>
            @for (s of investment.snapshots; track s.date; let i = $index) {
              <tr>
                @if (editingIndex === i) {
                  <td><input type="date" class="form-control form-control-sm" [(ngModel)]="editSnap.date" /></td>
                  <td><input type="number" class="form-control form-control-sm" [(ngModel)]="editSnap.value" /></td>
                  <td><input type="number" class="form-control form-control-sm" [(ngModel)]="editSnap.deposit" [placeholder]="'INVESTMENTS.DEPOSIT_OPT' | translate" /></td>
                  <td></td>
                  <td>
                    <div class="d-flex gap-1">
                      <button class="row-save-btn" [matTooltip]="'INVESTMENTS.SAVE_TOOLTIP' | translate" (click)="saveSnapshot(i)">✓</button>
                      <button class="row-cancel-btn" [matTooltip]="'INVESTMENTS.CANCEL_TOOLTIP' | translate" (click)="editingIndex = null">✕</button>
                    </div>
                  </td>
                } @else {
                  <td>{{ s.date }}</td>
                  <td>{{ s.value | number:'1.0-0' }} ₪</td>
                  <td>{{ s.deposit != null ? (s.deposit | number:'1.0-0') + ' ₪' : '-' }}</td>
                  <td>
                    @if (i > 0) {
                      <span [class]="changeAt(i) > 0 ? 'pct-pos' : 'pct-neg'">
                        {{ changeAt(i) > 0 ? '▲' : '▼' }} {{ changeAt(i) | number:'1.1-1' }}%
                      </span>
                    }
                  </td>
                  <td>
                    <button class="edit-btn" style="padding:2px 8px; font-size:0.75rem"
                      [matTooltip]="'INVESTMENTS.EDIT_TOOLTIP' | translate"
                      (click)="startEditSnapshot(i)">✏️</button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>

        <div class="add-row mt-2" style="border-radius:10px">
          <div class="row g-2 align-items-end">
            <div class="col-md-3">
              <input type="date" class="form-control form-control-sm" [(ngModel)]="snap.date" />
            </div>
            <div class="col-md-3">
              <input type="number" class="form-control form-control-sm" [(ngModel)]="snap.value" [placeholder]="'INVESTMENTS.VALUE' | translate" />
            </div>
            <div class="col-md-3">
              <input type="number" class="form-control form-control-sm" [(ngModel)]="snap.deposit" [placeholder]="'INVESTMENTS.DEPOSIT_OPT' | translate" />
            </div>
            <div class="col-md-3">
              <button class="save-snap-btn w-100"
                [matTooltip]="'INVESTMENTS.ADD_SNAPSHOT_TOOLTIP' | translate"
                (click)="addSnapshot()">{{ 'INVESTMENTS.ADD_SNAPSHOT' | translate }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class InvestmentDetailComponent implements OnChanges {
  @Input() investment!: Investment;
  @Output() snapshotAdded = new EventEmitter<{ id: string; snapshot: Snapshot }>();

  readonly W = W; readonly H = H; readonly PAD = PAD; readonly CW = CW; readonly CH = CH;

  snap: Partial<Snapshot> = { date: new Date().toISOString().slice(0, 10) };
  cagr: number | null = null;
  xirr: number | null = null;
  editing = false;
  editName = '';
  editType: Investment['type'] = 'fund';
  editingIndex: number | null = null;
  editSnap: Partial<Snapshot> = {};

  chartData: { x: number; y: number; date: string; value: number; deposit?: number }[] = [];
  linePoints = '';
  areaPath = '';
  yTicks: { y: number; label: string }[] = [];

  constructor(private svc: InvestmentService) { }

  ngOnChanges() {
    this.editing = false;
    this.cagr = this.svc.cagr(this.investment.snapshots);
    this.xirr = this.svc.xirr(this.investment.snapshots);
    this.buildChart();
  }

  private buildChart() {
    const snaps = this.investment.snapshots;
    if (snaps.length < 2) { this.chartData = []; return; }

    const values = snaps.map(s => s.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = maxV - minV || 1;

    this.chartData = snaps.map((s, i) => ({
      x: (i / (snaps.length - 1)) * CW,
      y: CH - ((s.value - minV) / range) * CH,
      date: s.date,
      value: s.value,
      deposit: s.deposit
    }));

    this.linePoints = this.chartData.map(p => `${p.x},${p.y}`).join(' ');
    const first = this.chartData[0], last = this.chartData[this.chartData.length - 1];
    this.areaPath = `M${first.x},${CH} ` + this.chartData.map(p => `L${p.x},${p.y}`).join(' ') + ` L${last.x},${CH} Z`;

    // Y ticks — 4 evenly spaced
    this.yTicks = [0, 1, 2, 3].map(i => {
      const val = minV + (range / 3) * i;
      return { y: CH - ((val - minV) / range) * CH, label: this.formatK(val) };
    });
  }

  private formatK(v: number): string {
    return v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v.toFixed(0);
  }

  shouldShowXLabel(i: number): boolean {
    const n = this.chartData.length;
    if (n <= 6) return true;
    const step = Math.ceil(n / 5);
    return i % step === 0 || i === n - 1;
  }

  startEdit() {
    this.editName = this.investment.name;
    this.editType = this.investment.type;
    this.editing = true;
  }

  startEditSnapshot(i: number) {
    const s = this.investment.snapshots[i];
    this.editSnap = { date: s.date, value: s.value, deposit: s.deposit };
    this.editingIndex = i;
  }

  saveSnapshot(i: number) {
    if (!this.editSnap.date || !this.editSnap.value) return;
    const updated = this.investment.snapshots.map((s, idx) =>
      idx === i ? { date: this.editSnap.date!, value: +this.editSnap.value!, ...(this.editSnap.deposit != null ? { deposit: +this.editSnap.deposit } : {}) } : s
    );
    this.svc.update(this.investment.id, { snapshots: updated }).subscribe();
    this.editingIndex = null;
  }

  saveEdit() {
    if (!this.editName.trim()) return;
    this.svc.update(this.investment.id, { name: this.editName.trim(), type: this.editType }).subscribe();
    this.editing = false;
  }

  changeAt(i: number): number {
    const prev = this.investment.snapshots[i - 1].value;
    const curr = this.investment.snapshots[i].value;
    return ((curr - prev) / prev) * 100;
  }

  addSnapshot() {
    if (!this.snap.date || !this.snap.value) return;
    const snapshot: Snapshot = {
      date: this.snap.date,
      value: +this.snap.value,
      ...(this.snap.deposit != null ? { deposit: +this.snap.deposit } : {})
    };
    this.snapshotAdded.emit({ id: this.investment.id, snapshot });
    this.snap = { date: new Date().toISOString().slice(0, 10) };
  }
}
