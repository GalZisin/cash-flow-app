import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

const W = 720, H = 320, PAD = { top: 12, right: 16, bottom: 32, left: 64 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

@Component({
  selector: 'app-investment-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatTooltipModule],
  styles: [`
    .sim-card { border-radius: 14px; border: 1px solid #e8eaed; background: #fff; overflow: hidden; }
    .sim-header { padding: 14px 16px; font-weight: 600; font-size: 0.9rem; color: #1e293b; border-bottom: 1px solid #f0f2f5; }
    .sim-body { padding: 20px; }
    .sim-label { font-size: 0.78rem; font-weight: 600; color: #64748b; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
    .result-bar { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px 20px; }
    .result-item { display: flex; flex-direction: column; }
    .result-item .rl { font-size: 0.72rem; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.4px; }
    .result-item .rv { font-size: 1rem; font-weight: 700; color: #1e293b; }
    .rv-main { font-size: 1.3rem; color: #1a7a52; }
    .chart-wrap { background: #f8f9fb; border-radius: 10px; padding: 8px 4px 4px; margin-top: 14px; overflow: visible; }
    .legend { font-size: 0.75rem; color: #94a3b8; margin-top: 6px; }
    .dot { cursor: pointer; }
    .dot:hover { r: 6; }
  `],
  template: `
    <div class="sim-card">
      <div class="sim-header">📊 {{ 'INVESTMENTS.SIMULATION_TITLE' | translate }}</div>
      <div class="sim-body">
        <div class="row g-3 mb-4">
          <div class="col-6 col-md-3">
            <div class="sim-label">{{ 'INVESTMENTS.INITIAL' | translate }}</div>
            <input type="number" class="form-control form-control-sm" [(ngModel)]="initial" (ngModelChange)="calculate()" />
          </div>
          <div class="col-6 col-md-3">
            <div class="sim-label">{{ 'INVESTMENTS.MONTHLY_DEPOSIT' | translate }}</div>
            <input type="number" class="form-control form-control-sm" [(ngModel)]="monthly" (ngModelChange)="calculate()" />
          </div>
          <div class="col-6 col-md-3">
            <div class="sim-label">{{ 'INVESTMENTS.ANNUAL_RETURN' | translate }}</div>
            <input type="number" class="form-control form-control-sm" [(ngModel)]="annualRate" (ngModelChange)="calculate()" />
          </div>
          <div class="col-6 col-md-3">
            <div class="sim-label">{{ 'INVESTMENTS.YEARS' | translate }}</div>
            <input type="number" class="form-control form-control-sm" [(ngModel)]="years" (ngModelChange)="calculate()" />
          </div>
        </div>

        @if (result !== null) {
          <div class="result-bar d-flex flex-wrap gap-4">
            <div class="result-item">
              <span class="rl">{{ 'INVESTMENTS.FUTURE_VALUE' | translate:{ years: years } }}</span>
              <span class="rv rv-main">{{ result | number:'1.0-0' }} ₪</span>
            </div>
            <div class="result-item">
              <span class="rl">{{ 'INVESTMENTS.TOTAL_DEPOSITED' | translate }}</span>
              <span class="rv">{{ totalDeposited | number:'1.0-0' }} ₪</span>
            </div>
            <div class="result-item">
              <span class="rl">{{ 'INVESTMENTS.GAIN' | translate }}</span>
              <span class="rv" style="color:#2d4fd6">{{ result - totalDeposited | number:'1.0-0' }} ₪</span>
            </div>
          </div>

          <div class="chart-wrap">
            <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="w-100" style="display:block; overflow:visible; max-height:320px">
              <g [attr.transform]="'translate(' + PAD.left + ',' + PAD.top + ')'">

                <!-- Gridlines + Y labels -->
                @for (tick of yTicks; track tick.y) {
                  <line [attr.x1]="0" [attr.y1]="tick.y" [attr.x2]="CW" [attr.y2]="tick.y"
                    stroke="#e8eaed" stroke-width="1" stroke-dasharray="3"/>
                  <text [attr.x]="-8" [attr.y]="tick.y + 4" text-anchor="end"
                    font-size="9" fill="#94a3b8">{{ tick.label }}</text>
                }

                <!-- X labels (years) -->
                @for (pt of yearPoints; track pt.year) {
                  <text [attr.x]="pt.x" [attr.y]="CH + 20" text-anchor="middle"
                    font-size="9" fill="#94a3b8">{{ 'INVESTMENTS.YEAR' | translate }} {{ pt.year }}</text>
                }

                <!-- Axes -->
                <line x1="0" [attr.y1]="CH" [attr.x2]="CW" [attr.y2]="CH" stroke="#e8eaed" stroke-width="1"/>
                <line x1="0" y1="0" x2="0" [attr.y2]="CH" stroke="#e8eaed" stroke-width="1"/>

                <!-- Deposit area -->
                <path [attr.d]="depAreaPath" fill="#cbd5e1" fill-opacity="0.15"/>
                <!-- Deposit line -->
                <polyline [attr.points]="depLinePoints" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="5"/>

                <!-- Projected area -->
                <path [attr.d]="projAreaPath" fill="#4f6ef7" fill-opacity="0.08"/>
                <!-- Projected line -->
                <polyline [attr.points]="projLinePoints" fill="none" stroke="#4f6ef7" stroke-width="2" stroke-linejoin="round"/>

                <!-- Yearly dots with tooltip -->
                @for (pt of yearPoints; track pt.year) {
                  <circle class="dot"
                    [attr.cx]="pt.x" [attr.cy]="pt.projY" r="4"
                    fill="#fff" stroke="#4f6ef7" stroke-width="2"
                    [title]="'שנה ' + pt.year + ': ' + pt.projVal + ' ₪'"
                    [matTooltip]="('INVESTMENTS.YEAR' | translate) + ' ' + pt.year + ' — ' + (pt.projVal | number:'1.0-0') + ' ₪'"
                  />
                }
              </g>
            </svg>
            <div class="legend d-flex gap-3">
              <span><span style="color:#4f6ef7">—</span> {{ 'INVESTMENTS.PROJECTED_VALUE' | translate }}</span>
              <span><span style="color:#cbd5e1">- -</span> {{ 'INVESTMENTS.DEPOSITS_ONLY' | translate }}</span>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class InvestmentSimulationComponent implements OnInit {
  initial = 10000;
  monthly = 500;
  annualRate = 7;
  years = 10;
  result: number | null = null;
  totalDeposited = 0;

  readonly W = W; readonly H = H; readonly PAD = PAD; readonly CW = CW; readonly CH = CH;

  projLinePoints = '';
  depLinePoints = '';
  projAreaPath = '';
  depAreaPath = '';
  yTicks: { y: number; label: string }[] = [];
  yearPoints: { year: number; x: number; projY: number; projVal: number }[] = [];

  ngOnInit() { this.calculate(); }

  calculate() {
    const r = this.annualRate / 100 / 12;
    const n = this.years * 12;
    const projVals: number[] = [];
    const depVals: number[] = [];
    let val = this.initial, dep = this.initial;

    for (let m = 0; m <= n; m++) {
      projVals.push(val);
      depVals.push(dep);
      val = val * (1 + r) + this.monthly;
      dep += this.monthly;
    }

    this.result = projVals[n];
    this.totalDeposited = this.initial + this.monthly * n;

    const allVals = [...projVals, ...depVals];
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;

    const toX = (m: number) => (m / n) * CW;
    const toY = (v: number) => CH - ((v - minV) / range) * CH;

    this.projLinePoints = projVals.map((v, m) => `${toX(m)},${toY(v)}`).join(' ');
    this.depLinePoints  = depVals.map((v, m) => `${toX(m)},${toY(v)}`).join(' ');

    this.projAreaPath = `M${toX(0)},${CH} ` + projVals.map((v, m) => `L${toX(m)},${toY(v)}`).join(' ') + ` L${toX(n)},${CH} Z`;
    this.depAreaPath  = `M${toX(0)},${CH} ` + depVals.map((v, m) => `L${toX(m)},${toY(v)}`).join(' ')  + ` L${toX(n)},${CH} Z`;

    // Y ticks
    this.yTicks = [0, 1, 2, 3, 4].map(i => {
      const v = minV + (range / 4) * i;
      return { y: toY(v), label: this.formatK(v) };
    });

    // Yearly dots
    this.yearPoints = Array.from({ length: this.years + 1 }, (_, yr) => {
      const m = yr * 12;
      return { year: yr, x: toX(m), projY: toY(projVals[m]), projVal: projVals[m] };
    });
  }

  private formatK(v: number): string {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
    return v.toFixed(0);
  }
}
