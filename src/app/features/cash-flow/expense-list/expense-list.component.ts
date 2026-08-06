import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { ExpenseCategorySelectorComponent } from '../expense-category-selector/expense-category-selector.component';
import { ExpenseCategory } from '../../../models/expense-category.model';
import { StaggerFadeInDirective } from '../../../directives/stagger-fade-in.directive';

/**
 * קומפוננטה לרשימת הוצאות - reusable
 * משמשת להצגת רשימת הוצאות שוטפות, מיוחדות, או הכנסות נוספות
 */
@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslateModule,
    ExpenseCategorySelectorComponent,
    StaggerFadeInDirective
  ],
  template: `
    <div appStaggerFadeIn [childSelector]="'.expense-item-block'" [staggerDelay]="0.03">
      @for (expCtrl of expenses.controls; track expCtrl; let j = $index) {
        <div class="expense-item-block">
          <div class="expense-row">
            <input
              dir="rtl"
              [placeholder]="descriptionPlaceholder"
              [title]="descriptionPlaceholder"
              [attr.aria-label]="descriptionPlaceholder"
              [formControl]="getDescription(j)" />
            
            @if (!focusedField['exp_' + j]) {
              <span class="amount-display" (click)="focusAmount(j)">
                {{ getAmount(j).value | number:'1.0-0' }} ₪
              </span>
            }
            @if (focusedField['exp_' + j]) {
              <input
                type="number"
                dir="rtl"
                [placeholder]="amountPlaceholder"
                [title]="amountPlaceholder"
                [attr.aria-label]="amountPlaceholder"
                [formControl]="getAmount(j)"
                (input)="onAmountChange.emit()"
                (blur)="blurAmount(j)"
                [attr.data-focus-key]="'exp_' + j" />
            }
            
            <button
              mat-icon-button
              color="warn"
              (click)="onDelete.emit(j)"
              [title]="'INSTALLMENTS.DELETE' | translate"
              [matTooltip]="'INSTALLMENTS.DELETE' | translate"
              [attr.aria-label]="'INSTALLMENTS.DELETE' | translate">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
          
          @if (showCategorySelector) {
            <app-expense-category-selector
              [selectedCategory]="getCategory(j).value"
              (selectedCategoryChange)="getCategory(j).setValue($event)" />
          }
        </div>
      }
      
      <button mat-button (click)="onAdd.emit()">
        {{ addButtonLabel | translate }}
      </button>
    </div>
  `,
  styles: [`
    .expense-item-block {
      margin-bottom: 12px;
      padding: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #fff;
      direction: rtl;
      transition: all 0.2s ease;

      .expense-row {
        margin-bottom: 8px;
      }

      app-expense-category-selector {
        display: block;
        min-width: 280px;
      }

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
    }

    .expense-row {
      display: flex;
      align-items: center;
      gap: 8px;
      direction: rtl;

      input {
        border: 1px solid #e2e8f0 !important;
        border-radius: 6px;
        padding: 4px 8px;
        font-family: 'Heebo', sans-serif;
        font-size: 12px;
        text-align: right;
      }
    }

    .amount-display {
      cursor: pointer;
      display: inline-block;
      min-width: 80px;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid transparent;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-align: right;

      &:hover {
        border-color: #e2e8f0;
        background: #fff;
        transform: scale(1.02);
      }
    }
  `]
})
export class ExpenseListComponent {
  @Input({ required: true }) expenses!: FormArray;
  @Input() showCategorySelector = true;
  @Input() descriptionPlaceholder = 'תיאור';
  @Input() amountPlaceholder = 'סכום';
  @Input() addButtonLabel = 'CASH_FLOW.ADD_EXPENSE';

  @Output() onAdd = new EventEmitter<void>();
  @Output() onDelete = new EventEmitter<number>();
  @Output() onAmountChange = new EventEmitter<void>();

  focusedField: Record<string, boolean> = {};

  getDescription(index: number): FormControl<string> {
    const control = this.expenses.at(index).get('description');
    if (!control) throw new Error('description control is missing!');
    return control as FormControl<string>;
  }

  getAmount(index: number): FormControl<number> {
    const control = this.expenses.at(index).get('amount');
    if (!control) throw new Error('amount control is missing!');
    return control as FormControl<number>;
  }

  getCategory(index: number): FormControl<ExpenseCategory> {
    const control = this.expenses.at(index).get('category');
    if (!control) throw new Error('category control is missing!');
    return control as FormControl<ExpenseCategory>;
  }

  focusAmount(index: number): void {
    this.focusedField['exp_' + index] = true;
    setTimeout(() => {
      const el = document.querySelector(`input[data-focus-key="exp_${index}"]`) as HTMLInputElement;
      if (el) el.focus();
    }, 0);
  }

  blurAmount(index: number): void {
    this.focusedField['exp_' + index] = false;
  }
}
