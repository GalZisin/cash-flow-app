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
  styles: [`
    .inv-card { border-radius: 14px; border: 1px solid #e8eaed; background: #fff; overflow: hidden; }
    .inv-header { padding: 14px 16px; background: #fff; border-bottom: 1px solid #f0f2f5; font-weight: 600; color: #1e293b; font-size: 0.9rem; }
    .add-form { padding: 14px 16px; background: #f8f9fb; border-bottom: 1px solid #f0f2f5; }

    .inv-item { padding: 12px 16px; border-bottom: 1px solid #f0f2f5; cursor: pointer; transition: background 0.12s; display: flex; justify-content: space-between; align-items: center; }
    .inv-item:last-child { border-bottom: none; }
    .inv-item:hover { background: #f8f9fb; }
    .inv-item.selected { background: #eef2ff; border-left: 3px solid #4f6ef7; }

    .inv-name { font-weight: 600; font-size: 0.9rem; color: #1e293b; }
    .inv-type { font-size: 0.72rem; color: #64748b; margin-top: 2px; }
    .inv-value { font-weight: 600; font-size: 0.9rem; color: #1e293b; text-align: end; }
    .inv-pct-pos { font-size: 0.75rem; color: #1a7a52; font-weight: 500; }
    .inv-pct-neg { font-size: 0.75rem; color: #c0392b; font-weight: 500; }
    .inv-pct-neu { font-size: 0.75rem; color: #94a3b8; }

    .delete-btn {
      width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid transparent;
      background: transparent; color: #cbd5e1;
      display: inline-flex; align-items: center; justify-content: center;
      transition: all 0.15s; flex-shrink: 0; cursor: pointer;
    }
    .delete-btn:hover { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }
    .inv-item:not(:hover) .delete-btn { opacity: 0; }
    .inv-item:hover .delete-btn { opacity: 1; }

    .overlay { background: rgba(15,23,42,0.5); z-index: 1050; }
    .confirm-card { border-radius: 16px; border: none; box-shadow: 0 20px 60px rgba(0,0,0,0.18); min-width: 320px; }
    .confirm-icon { font-size: 2.2rem; }
    .confirm-title { font-weight: 700; color: #1e293b; font-size: 1rem; }
    .confirm-msg { color: #64748b; font-size: 0.875rem; }
    .btn-delete-confirm { background: #dc2626; color: #fff; border: none; border-radius: 8px; padding: 8px 24px; font-weight: 600; }
    .btn-delete-confirm:hover { background: #b91c1c; color: #fff; }
    .btn-cancel-confirm { background: #f1f5f9; color: #475569; border: none; border-radius: 8px; padding: 8px 24px; font-weight: 500; }
    .btn-cancel-confirm:hover { background: #e2e8f0; }
  `],
  template: `
    <div class="inv-card">
      <div class="inv-header d-flex justify-content-between align-items-center">
        <span>{{ 'TABS.INVESTMENTS' | translate }}</span>
        <button class="btn btn-sm px-3 py-1"
          style="background:#4f6ef7; color:#fff; border-radius:8px; font-size:0.8rem; font-weight:600; border:none"
          [matTooltip]="'INVESTMENTS.ADD_TOOLTIP' | translate"
          (click)="showForm = !showForm">{{ 'INVESTMENTS.ADD' | translate }}</button>
      </div>

      @if (showForm) {
        <div class="add-form">
          <div class="mb-2">
            <input class="form-control form-control-sm" [(ngModel)]="newName" [placeholder]="'INVESTMENTS.NAME' | translate" />
          </div>
          <div class="mb-2">
            <select class="form-select form-select-sm" [(ngModel)]="newType">
              <option value="pension">{{ 'INVESTMENTS.PENSION' | translate }}</option>
              <option value="fund">{{ 'INVESTMENTS.FUND' | translate }}</option>
              <option value="stock">{{ 'INVESTMENTS.STOCK' | translate }}</option>
              <option value="other">{{ 'INVESTMENTS.OTHER' | translate }}</option>
            </select>
          </div>
          <button class="btn btn-sm px-3" style="background:#1a7a52; color:#fff; border-radius:8px; border:none; font-weight:600"
            (click)="submit()">{{ 'INVESTMENTS.SAVE' | translate }}</button>
        </div>
      }

      @for (inv of investments; track inv.id) {
        <div class="inv-item" [class.selected]="inv.id === selectedId"
            [matTooltip]="inv.id === selectedId ? ('INVESTMENTS.COLLAPSE' | translate) : ('INVESTMENTS.EXPAND' | translate)"
            (click)="selected.emit(inv.id)">
          <div>
            <div class="inv-name">{{ inv.name }}</div>
            <div class="inv-type">{{ inv.type }}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <div>
              <div class="inv-value">{{ currentValue(inv) | number:'1.0-0' }} ₪</div>
              @if (pct(inv) !== null) {
                <div [class]="pct(inv)! > 0 ? 'inv-pct-pos' : pct(inv)! < 0 ? 'inv-pct-neg' : 'inv-pct-neu'" style="text-align:end">
                  {{ pct(inv)! > 0 ? '▲' : pct(inv)! < 0 ? '▼' : '' }} {{ pct(inv)! | number:'1.1-1' }}%
                </div>
              }
            </div>
            <span style="color:#94a3b8; font-size:0.8rem; flex-shrink:0">{{ inv.id === selectedId ? '▲' : '▼' }}</span>
            <button class="delete-btn"
              [matTooltip]="'INVESTMENTS.DELETE_TOOLTIP' | translate"
              (click)="$event.stopPropagation(); confirmDelete(inv)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      }
    </div>

    @if (pendingDelete) {
      <div class="overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
        <div class="confirm-card card p-4 text-center">
          <div class="confirm-icon mb-2">🗑️</div>
          <div class="confirm-title mb-1">{{ 'INVESTMENTS.DELETE_CONFIRM_TITLE' | translate }}</div>
          <div class="confirm-msg mb-4">{{ 'INVESTMENTS.DELETE_CONFIRM_MSG' | translate:{ name: pendingDelete.name } }}</div>
          <div class="d-flex gap-2 justify-content-center">
            <button class="btn-delete-confirm" (click)="doDelete()">{{ 'INVESTMENTS.DELETE_YES' | translate }}</button>
            <button class="btn-cancel-confirm" (click)="pendingDelete = null">{{ 'INVESTMENTS.DELETE_NO' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `
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

  constructor(private svc: InvestmentService) {}

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
