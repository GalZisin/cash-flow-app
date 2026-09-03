import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'cashflow', pathMatch: 'full' },
  {
    path: 'cashflow',
    loadComponent: () =>
      import('./features/cash-flow/cash-flow-table/cash-flow-table.component').then(
        (m) => m.CashFlowTableComponent
      ),
  },
  {
    path: 'investments',
    loadComponent: () =>
      import('./features/investments/investment-dashboard/investment-dashboard.component').then(
        (m) => m.InvestmentDashboardComponent
      ),
  },
  {
    path: 'installments',
    loadComponent: () =>
      import('./features/installments/installments/installments.component').then(
        (m) => m.InstallmentsComponent
      ),
  },
  {
    path: 'budget',
    loadComponent: () =>
      import('./features/budget-tracker/budget-tracker.component').then(
        (m) => m.BudgetTrackerComponent
      ),
  },
  {
    path: 'goals',
    loadComponent: () => import('./features/goals/goals.component').then((m) => m.GoalsComponent),
  },
  {
    path: 'ai',
    loadComponent: () =>
      import('./features/ai-assistant/ai-assistant/ai-assistant.component').then(
        (m) => m.AiAssistantComponent
      ),
  },
  { path: '**', redirectTo: 'cashflow' },
];
