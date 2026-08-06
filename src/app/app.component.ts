import { Component } from '@angular/core';

import { TranslateModule } from '@ngx-translate/core';
import { CashFlowTableComponent } from './features/cash-flow/cash-flow-table/cash-flow-table.component';
import { InvestmentDashboardComponent } from './features/investments/investment-dashboard/investment-dashboard.component';
import { InstallmentsComponent } from './features/installments/installments/installments.component';
import { AiAssistantComponent } from './features/ai-assistant/ai-assistant/ai-assistant.component';
import { LanguageService } from './services/language.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TranslateModule, CashFlowTableComponent, InvestmentDashboardComponent, InstallmentsComponent, AiAssistantComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  activeTab: 'cashflow' | 'investments' | 'installments' | 'ai' = 'cashflow';
  constructor(public lang: LanguageService, public theme: ThemeService) { }
}
