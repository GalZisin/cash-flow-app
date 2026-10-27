import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Investment, InvestmentCurrency } from '../../../models/investment.model';
import { InvestmentService } from '../../../services/investment.service';
import { DEFAULT_USD_ILS_RATE, effectiveUsdIlsRate } from '../../../services/exchange-rate.service';

@Component({
  selector: 'app-investment-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatTooltipModule],
  templateUrl: './investment-list.component.html',
  styleUrl: './investment-list.component.scss',
})
export class InvestmentListComponent {
  @Input() investments: Investment[] = [];
  @Input() selectedId: string | null = null;
  @Output() selected = new EventEmitter<string>();
  @Output() deleted = new EventEmitter<string>();
  @Output() added = new EventEmitter<{ name: string; type: Investment['type']; currency?: InvestmentCurrency }>();

  showForm = false;
  newName = '';
  newType: Investment['type'] = 'stock';
  newCurrency: InvestmentCurrency = 'USD';
  pendingDelete: Investment | null = null;

  constructor(private svc: InvestmentService) { }

  onTypeChange(type: Investment['type']) {
    this.newType = type;
    if (type === 'stock') {
      this.newCurrency = 'USD';
    } else {
      this.newCurrency = 'ILS';
    }
  }

  isUsd(inv: Investment): boolean {
    return inv.currency === 'USD';
  }

  currentDisplay(inv: Investment): { primary: string; secondary?: string } {
    const last = inv.snapshots.at(-1);
    if (!last) return { primary: '0 ₪' };

    if (this.isUsd(inv)) {
      const rate = effectiveUsdIlsRate(last.exchangeRate, DEFAULT_USD_ILS_RATE);
      const usdVal = last.currency === 'USD' && last.currencyAmount != null
        ? last.currencyAmount
        : last.value / rate;
      return {
        primary: `$${Math.round(usdVal).toLocaleString()}`,
        secondary: `${Math.round(last.value).toLocaleString()} ₪`
      };
    }

    return {
      primary: `${Math.round(last.value).toLocaleString()} ₪`
    };
  }

  pct(inv: Investment): number | null {
    if (this.isUsd(inv)) {
      const inUsd = this.svc.toCurrency(inv, 'USD');
      return this.svc.percentChange(inUsd.snapshots);
    }
    return this.svc.percentChange(inv.snapshots);
  }

  submit() {
    if (!this.newName.trim()) return;
    this.added.emit({ name: this.newName.trim(), type: this.newType, currency: this.newCurrency });
    this.newName = '';
    this.showForm = false;
  }

  confirmDelete(inv: Investment) {
    this.pendingDelete = inv;
  }

  doDelete() {
    if (!this.pendingDelete) return;
    this.deleted.emit(this.pendingDelete.id);
    this.pendingDelete = null;
  }
}

