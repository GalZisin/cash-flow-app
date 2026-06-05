import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CashFlowTableComponent } from './components/cash-flow-table/cash-flow-table.component';
import { InvestmentDashboardComponent } from './components/investment-dashboard/investment-dashboard.component';
import { InstallmentsComponent } from './components/installments/installments.component';
import { LanguageService } from './services/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TranslateModule, CashFlowTableComponent, InvestmentDashboardComponent, InstallmentsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  activeTab: 'cashflow' | 'investments' | 'installments' = 'cashflow';
  constructor(public lang: LanguageService) { }
}
