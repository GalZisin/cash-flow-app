import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BudgetCategoryCardComponent } from './budget-category-card.component';
import { CategoryBudget } from '../../../models/budget.model';
import { ExpenseCategory, getExpenseCategoryConfig } from '../../../models/expense-category.model';

describe('BudgetCategoryCardComponent', () => {
  let fixture: ComponentFixture<BudgetCategoryCardComponent>;
  let el: HTMLElement;

  const food: CategoryBudget = {
    category: ExpenseCategory.FOOD, monthlyLimit: 1000, spent: 1200, remaining: -200,
    percentage: 120, isOverBudget: true, overBudgetAmount: 200
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetCategoryCardComponent],
      providers: [provideNoopAnimations()]
    }).compileComponents();
    fixture = TestBed.createComponent(BudgetCategoryCardComponent);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('config', getExpenseCategoryConfig(ExpenseCategory.FOOD));
  });

  it('view mode: shows the usage and marks an over-budget category', () => {
    fixture.componentRef.setInput('budget', food);
    fixture.detectChanges();

    const card = el.querySelector('.category-card')!;
    expect(card.classList).toContain('over-budget');
    expect(card.classList).not.toContain('edit-mode');
    expect(el.querySelector('.status-chip.danger')).not.toBeNull();
    expect(el.querySelector('.over-budget-warning')).not.toBeNull();
    expect(el.querySelector('.amount-value.negative')).not.toBeNull();
    expect(el.querySelector('input')).toBeNull();
  });

  it('edit mode: binds the limit input to the given control and shows the spent amount', () => {
    const control = new FormControl(1000, { nonNullable: true });
    fixture.componentRef.setInput('budget', food);
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();

    expect(el.querySelector('.category-card.edit-mode')).not.toBeNull();
    expect(el.querySelector('.spent-info')).not.toBeNull();
    const input = el.querySelector<HTMLInputElement>('input')!;
    expect(input.value).toBe('1000');

    input.value = '1500';
    input.dispatchEvent(new Event('input'));
    expect(control.value).toBe(1500);
  });

  it('edit mode without a budget for the month: no spent amount', () => {
    fixture.componentRef.setInput('control', new FormControl(0, { nonNullable: true }));
    fixture.detectChanges();

    expect(el.querySelector('.category-card.edit-mode')).not.toBeNull();
    expect(el.querySelector('.spent-info')).toBeNull();
  });
});
