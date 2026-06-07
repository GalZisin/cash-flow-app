import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CashFlowTableComponent } from './components/cash-flow-table/cash-flow-table.component';
import { InvestmentDashboardComponent } from './components/investment-dashboard/investment-dashboard.component';
import { InstallmentsComponent } from './components/installments/installments.component';
import { AiAssistantComponent } from './components/ai-assistant/ai-assistant.component';
import { LanguageService } from './services/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TranslateModule, CashFlowTableComponent, InvestmentDashboardComponent, InstallmentsComponent, AiAssistantComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  activeTab: 'cashflow' | 'investments' | 'installments' | 'ai' = 'cashflow';
  constructor(public lang: LanguageService) { }
}
