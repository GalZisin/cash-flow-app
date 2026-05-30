import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InvestmentService } from '../../services/investment.service';
import { Investment } from '../../models/investment.model';
import { InvestmentListComponent } from '../investment-list/investment-list.component';
import { InvestmentDetailComponent } from '../investment-detail/investment-detail.component';
import { InvestmentSimulationComponent } from '../investment-simulation/investment-simulation.component';
import { BidiModule } from "@angular/cdk/bidi";

@Component({
  selector: 'app-investment-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, InvestmentListComponent, InvestmentDetailComponent, InvestmentSimulationComponent, BidiModule],
  templateUrl: './investment-dashboard.component.html',
  styleUrl: './investment-dashboard.component.scss'
})
export class InvestmentDashboardComponent implements OnInit {
  investments: Investment[] = [];
  selectedId: string | null = null;

  constructor(private svc: InvestmentService) {
    // takeUntilDestroyed must be called in the injection context (constructor)
    this.svc.investments$.pipe(takeUntilDestroyed()).subscribe(inv => this.investments = inv);
  }

  ngOnInit() {
    this.svc.load().subscribe();
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
    this.svc.add({ name: data.name, type: data.type, transactions: [], snapshots: [] }).subscribe();
  }
}
