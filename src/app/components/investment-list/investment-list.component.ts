import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Investment } from '../../models/investment.model';
import { InvestmentService } from '../../services/investment.service';

@Component({
  selector: 'app-investment-list',
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
  @Output() added = new EventEmitter<{ name: string; type: Investment['type'] }>();

  showForm = false;
  newName = '';
  newType: Investment['type'] = 'fund';
  pendingDelete: Investment | null = null;

  constructor(private svc: InvestmentService) { }

  currentValue(inv: Investment): number {
    return inv.snapshots.at(-1)?.value ?? 0;
  }

  pct(inv: Investment): number | null {
    return this.svc.percentChange(inv.snapshots);
  }

  submit() {
    if (!this.newName.trim()) return;
    this.added.emit({ name: this.newName.trim(), type: this.newType });
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
