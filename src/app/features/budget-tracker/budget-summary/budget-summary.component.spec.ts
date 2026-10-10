import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BudgetSummaryComponent } from './budget-summary.component';
import { BudgetAlert, MonthlyBudget } from '../../../models/budget.model';
import { ExpenseCategory } from '../../../models/expense-category.model';

describe('BudgetSummaryComponent', () => {
  let fixture: ComponentFixture<BudgetSummaryComponent>;
  let el: HTMLElement;

  const budget: MonthlyBudget = {
    month: '2026-10', totalBudget: 1000, totalSpent: 1100, totalRemaining: -100, overallPercentage: 110, categories: []
  };
  const alert: BudgetAlert = {
    category: ExpenseCategory.FOOD, month: '2026-10', budgetLimit: 1000, actualSpent: 1100,
    overAmount: 100, percentage: 110, severity: 'danger'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetSummaryComponent],
      providers: [provideNoopAnimations()]
    }).compileComponents();
    fixture = TestBed.createComponent(BudgetSummaryComponent);
    el = fixture.nativeElement;
  });

  it('renders nothing without a budget or alerts', () => {
    fixture.detectChanges();
    expect(el.querySelector('.alerts-section')).toBeNull();
    expect(el.querySelector('.summary-cards')).toBeNull();
  });

  it('renders the alerts, the four summary cards and the overall progress', () => {
    fixture.componentRef.setInput('budget', budget);
    fixture.componentRef.setInput('alerts', [alert]);
    fixture.detectChanges();

    expect(el.querySelectorAll('.alert-card.danger').length).toBe(1);
    expect(el.querySelectorAll('.summary-card').length).toBe(4);
    expect(el.querySelector('.summary-value.negative')).not.toBeNull();
    expect(el.querySelector('.overall-progress-card mat-progress-bar')).not.toBeNull();
  });
});
