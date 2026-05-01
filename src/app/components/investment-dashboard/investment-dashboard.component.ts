import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { InvestmentService } from '../../services/investment.service';
import { Investment } from '../../models/investment.model';
import { InvestmentListComponent } from '../investment-list/investment-list.component';
import { InvestmentDetailComponent } from '../investment-detail/investment-detail.component';
import { InvestmentSimulationComponent } from '../investment-simulation/investment-simulation.component';

@Component({
  selector: 'app-investment-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, InvestmentListComponent, InvestmentDetailComponent, InvestmentSimulationComponent],
  styles: [`
    .dash-wrap {
      background: #f8f9fb;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .page-title { font-size: 1.25rem; font-weight: 600; color: #1e293b; letter-spacing: -0.3px; }

    .sticky-header {
      flex-shrink: 0;
      background: #f8f9fb;
      padding: 16px 24px 12px;
      border-bottom: 1px solid #e8eaed;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }

    .scroll-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
    }

    .stat-card {
      border-radius: 14px;
      border: none;
      padding: 20px 22px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .stat-card .label {
      font-size: 0.75rem; font-weight: 500;
      text-transform: uppercase; letter-spacing: 0.6px;
      opacity: 0.7;
    }
    .stat-card .value { font-size: 1.5rem; font-weight: 700; line-height: 1.2; }

    .stat-blue   { background: #e8eeff; color: #2d4fd6; }
    .stat-green  { background: #e6f7f0; color: #1a7a52; }
    .stat-violet { background: #f0ebff; color: #6d3fd6; }
    .stat-amber  { background: #fff4e0; color: #a05c00; }
  `],
  template: `
    <div class="dash-wrap">
      <div class="sticky-header">
        <div class="d-flex align-items-center mb-3">
          <span class="page-title">{{ 'INVESTMENTS.TITLE' | translate }}</span>
        </div>
        <!-- Summary cards -->
        <div class="row g-3 align-items-stretch">
          <div class="col-6 col-md-3 d-flex">
            <div class="stat-card stat-blue w-100">
              <span class="label">{{ 'INVESTMENTS.TOTAL' | translate }}</span>
              <span class="value">{{ investments.length }}</span>
            </div>
          </div>
          <div class="col-6 col-md-3 d-flex">
            <div class="stat-card stat-green w-100">
              <span class="label">{{ 'INVESTMENTS.TOTAL_VALUE' | translate }}</span>
              <span class="value">{{ totalValue | number:'1.0-0' }} ₪</span>
            </div>
          </div>
          <div class="col-6 col-md-3 d-flex">
            <div class="stat-card stat-violet w-100">
              <span class="label">{{ 'INVESTMENTS.BEST_PERFORMER' | translate }}</span>
              <span class="value" style="font-size:1.1rem">{{ bestPerformer?.name || '-' }}</span>
            </div>
          </div>
          <div class="col-6 col-md-3 d-flex">
            <div class="stat-card stat-amber w-100">
              <span class="label">{{ 'INVESTMENTS.AVG_CAGR' | translate }}</span>
              <span class="value">{{ avgCagr !== null ? (avgCagr | number:'1.1-1') + '%' : '-' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="scroll-body">
        <div class="row g-3">
          <div class="col-md-5">
            <app-investment-list
              [investments]="investments"
              [selectedId]="selectedId"
              (selected)="onSelect($event)"
              (deleted)="onDelete($event)"
              (added)="onAdd($event)"
            />
          </div>
          <div class="col-md-7">
            @if (selectedInvestment) {
              <app-investment-detail [investment]="selectedInvestment" (snapshotAdded)="onSnapshotAdded($event)" />
            }
          </div>
        </div>

        <div class="row mt-3">
          <div class="col-12">
            <app-investment-simulation />
          </div>
        </div>
      </div>
    </div>
  `
})
export class InvestmentDashboardComponent implements OnInit {
  investments: Investment[] = [];
  selectedId: string | null = null;

  constructor(private svc: InvestmentService) {}

  ngOnInit() {
    this.svc.load().subscribe();
    this.svc.investments$.subscribe(inv => this.investments = inv);
  }

  get selectedInvestment() {
    return this.investments.find(i => i.id === this.selectedId) ?? null;
  }

  get totalValue(): number {
    return this.investments.reduce((sum, inv) => {
      const last = inv.snapshots.at(-1);
      return sum + (last?.value ?? 0);
    }, 0);
  }

  get bestPerformer(): Investment | null {
    let best: Investment | null = null;
    let bestPct = -Infinity;
    for (const inv of this.investments) {
      const pct = this.svc.percentChange(inv.snapshots);
      if (pct !== null && pct > bestPct) { bestPct = pct; best = inv; }
    }
    return best;
  }

  get avgCagr(): number | null {
    const cagrs = this.investments.map(i => this.svc.cagr(i.snapshots)).filter(c => c !== null) as number[];
    if (!cagrs.length) return null;
    return cagrs.reduce((a, b) => a + b, 0) / cagrs.length;
  }

  onSelect(id: string) {
    this.selectedId = this.selectedId === id ? null : id;
  }

  onDelete(id: string) {
    this.svc.delete(id).subscribe();
    if (this.selectedId === id) this.selectedId = null;
  }

  onAdd(data: { name: string; type: Investment['type'] }) {
    this.svc.add(data).subscribe();
  }

  onSnapshotAdded({ id, snapshot }: any) {
    this.svc.addSnapshot(id, snapshot).subscribe();
  }
}
