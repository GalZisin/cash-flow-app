import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiService, ChatMessage, FinancialSummary, ScenarioRequest, ScenarioResult } from '../../services/ai.service';
import { ConversationService, Conversation } from '../../services/conversation.service';
import { LanguageService } from '../../services/language.service';
import { CashFlowService } from '../../services/cash-flow.service';
import { InstallmentService } from '../../services/installment.service';
import { ThemeService } from '../../services/theme.service';
import { InvestmentService } from '../../services/investment.service';
import { AiReportService, AiReport } from '../../services/ai-report.service';

type ActiveTab = 'chat' | 'analysis' | 'scenario' | 'dashboard' | 'archive';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatTooltipModule],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss'
})
export class AiAssistantComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  activeTab: ActiveTab = 'chat';

  // Summary
  summary: FinancialSummary | null = null;
  summaryLoading = false;

  // Chat
  messages: ChatMessage[] = [];
  userInput = '';
  chatLoading = false;

  // Conversations
  conversations: Conversation[] = [];
  activeConversationId: string | null = null;

  // Analysis
  analysisText = '';
  analysisLoading = false;

  // Scenario
  scenario: ScenarioRequest = { description: '', amount: 0, date: '' };
  scenarioResult: ScenarioResult | null = null;
  scenarioLoading = false;

  // Archive
  archivedReports: AiReport[] = [];
  archiveLoading = false;
  archiveFilterType: 'all' | 'analysis' | 'insights' | 'scenario' = 'all';
  archiveSearchQuery = '';
  pendingDeleteReportId: string | null = null;

  // Dashboard
  realCurrentBalance = 0;
  totalActiveInstallments = 0;
  totalMonthlyInstallmentsPayment = 0;
  totalInvestmentsValue = 0;
  insights: string[] = [];
  insightsLoading = false;
  insightsLoaded = false;
  aiResponseLang: 'he' | 'en' = 'he'; // עברית כברירת מחדל

  // Confirmation for deleting chat
  pendingDeleteChatId: string | null = null;

  private shouldScroll = false;

  // הגישה החדשה: שימוש ב-inject() במקום ב-Constructor
  private ai = inject(AiService);
  private convService = inject(ConversationService);
  private reportService = inject(AiReportService);
  public lang = inject(LanguageService);
  private translate = inject(TranslateService);
  private cashFlowService = inject(CashFlowService);
  private installmentService = inject(InstallmentService); // Inject InstallmentService
  private investmentService = inject(InvestmentService); // Inject InvestmentService
  public themeService = inject(ThemeService); // Keep public for template access

  constructor() { }

  ngOnInit() {
    this.loadSummary();
    this.convService.load().subscribe();
    this.convService.items$.subscribe(items => this.conversations = items);

    // האזנה לשינויים בתזרים כדי לעדכן את היתרה האמיתית להיום
    this.cashFlowService.cashFlowMonths$.subscribe(months => {
      const now = new Date();
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // פורמט YYYY-MM מקומי
      const currentMonth = months.find((m: any) => m.month.startsWith(nowStr));
      if (currentMonth) {
        this.realCurrentBalance = currentMonth.endingBalance;
      }
    });

    // Load Installment and Investment data for dashboard
    this.installmentService.items$.subscribe(items => {
      this.totalActiveInstallments = items.filter(i => !this.installmentService.getStatus(i).isCompleted).length;
      this.totalMonthlyInstallmentsPayment = this.installmentService.totalMonthlyActive(items);
    });
    this.investmentService.load().subscribe((items: any[]) => {
      this.totalInvestmentsValue = (items || []).reduce((sum, inv) => {
        const snaps = inv.snapshots || [];
        return sum + (snaps[snaps.length - 1]?.value ?? 0);
      }, 0);
    });
    this.loadDashboardData(); // Initial load for dashboard data
  }

  setTab(tab: ActiveTab) {
    this.activeTab = tab;
    if (tab === 'archive') {
      this.loadArchive();
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  loadSummary() {
    this.summaryLoading = true;
    this.ai.getSummary().subscribe({
      next: s => { this.summary = s; this.summaryLoading = false; },
      error: () => { this.summaryLoading = false; }
    });
  }

  loadDashboardData() {
    // Ensure all necessary data is loaded for the dashboard
    this.loadSummary(); // Summary is already loaded, but good to ensure it's fresh
    this.installmentService.load().subscribe();
    this.investmentService.load().subscribe({
      next: (items: any[]) => {
        this.totalInvestmentsValue = (items || []).reduce((sum, inv) => {
          const snaps = inv.snapshots || [];
          return sum + (snaps[snaps.length - 1]?.value ?? 0);
        }, 0);
      },
      error: (err) => console.error('Failed to load investments for dashboard:', err)
    });
  }

  loadArchive() {
    this.archiveLoading = true;
    this.reportService.loadAll().subscribe({
      next: reports => { this.archivedReports = reports; this.archiveLoading = false; },
      error: () => { this.archiveLoading = false; }
    });
  }

  get filteredReports() {
    return this.archivedReports.filter(report => {
      const matchesType = this.archiveFilterType === 'all' || report.type === this.archiveFilterType;
      const contentStr = (report.type === 'analysis' || report.type === 'scenario') ? report.content : report.content.join(' ');

      let matchesSearch = !this.archiveSearchQuery ||
        contentStr.toLowerCase().includes(this.archiveSearchQuery.toLowerCase()) ||
        report.createdAt.includes(this.archiveSearchQuery);

      if (!matchesSearch && report.type === 'scenario') {
        matchesSearch = report.scenarioDetails.description.toLowerCase().includes(this.archiveSearchQuery.toLowerCase());
      }
      return matchesType && matchesSearch;
    });
  }

  confirmDeleteReport(id: string) {
    this.pendingDeleteReportId = id;
  }

  cancelDeleteReport() {
    this.pendingDeleteReportId = null;
  }

  doDeleteReport() {
    if (this.pendingDeleteReportId) {
      this.reportService.delete(this.pendingDeleteReportId).subscribe(() => {
        this.archivedReports = this.archivedReports.filter(r => r.id !== this.pendingDeleteReportId);
        this.pendingDeleteReportId = null;
      });
    }
  }

  toggleAiLang() {
    this.aiResponseLang = this.aiResponseLang === 'he' ? 'en' : 'he';
  }

  loadInsights() {
    this.insights = []; // Clear previous insights
    this.insightsLoading = true;
    this.insightsLoaded = true;
    // פנייה ל-AI לקבלת תובנות פרו-אקטיביות
    const langText = this.aiResponseLang === 'he' ? 'Hebrew' : 'English';
    const prompt = `Please provide 3-4 short, proactive financial insights or warnings based on my data. Focus on trends and future risks. Be concise and practical. Respond strictly in ${langText}.`;
    this.ai.chat(prompt).subscribe({
      next: res => {
        const lines = res.answer.split('\n').filter(l => l.trim().length > 5);
        this.insights = lines;
        this.insightsLoading = false;

        // שמירה לתיעוד ב-JSON
        this.reportService.save({
          type: 'insights',
          content: lines,
          createdAt: new Date().toISOString()
        }).subscribe({
          error: err => console.error('Failed to archive insights:', err)
        });
      },
      error: () => { this.insightsLoading = false; }
    });
  }

  newConversation() {
    this.messages = [];
    this.activeConversationId = null;
  }

  loadConversation(conv: Conversation) {
    this.activeConversationId = conv.id;
    this.messages = conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
    this.shouldScroll = true;
  }

  confirmDeleteChat(id: string, event: Event) {
    event.stopPropagation();
    this.pendingDeleteChatId = id;
  }

  cancelDeleteChat() {
    this.pendingDeleteChatId = null;
  }

  doDeleteChat() {
    if (this.pendingDeleteChatId) {
      const id = this.pendingDeleteChatId;
      this.convService.delete(id).subscribe(() => {
        if (this.activeConversationId === id) this.newConversation();
        this.pendingDeleteChatId = null;
      });
    }
  }

  private saveConversation() {
    const title = this.messages.find(m => m.role === 'user')?.content.slice(0, 40) || 'שיחה חדשה';
    if (this.activeConversationId) {
      this.convService.update(this.activeConversationId, title, this.messages).subscribe();
    } else {
      this.convService.create(title, this.messages).subscribe(
        c => this.activeConversationId = c.id
      );
    }
  }

  /**
   * מחזירה את התחזית החל מהחודש הנוכחי בלבד (עד 6 חודשים קדימה)
   */
  get displayForecast() {
    if (!this.summary?.forecast || this.summary.forecast.length === 0) return [];

    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. הסרת כפילויות לפי חודש (למשל אם מגיע פעמיים 2029-03) ונרמול הפורמט ל-YYYY-MM
    const uniqueMap = new Map<string, any>();
    this.summary.forecast.forEach(f => {
      const monthKey = f.month.trim().substring(0, 7);
      // אם יש כפילות, נשמור את הרשומה האחרונה שמופיעה
      uniqueMap.set(monthKey, { ...f, month: monthKey });
    });

    // 2. המרה למערך ומיון כרונולוגי (מהקרוב לרחוק)
    const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    // 3. סינון נתונים החל מהחודש הנוכחי והלאה
    const filtered = sorted.filter(f => f.month >= nowStr);

    // 4. החזרת 6 חודשים (אם אין נתונים עתידיים בכלל, נציג את 6 הראשונים הזמינים)
    const result = filtered.length > 0 ? filtered : sorted;
    return result.slice(0, 6);
  }

  /**
   * Reduces the financial summary to essential data based on the user's question.
   * This implements a RAG-like filtering to minimize token usage and improve response accuracy.
   */
  private prepareRelevantContext(query: string): any {
    if (!this.summary) return null;

    const q = query.toLowerCase();
    const context: any = {
      currentBalance: this.realCurrentBalance || this.summary.currentBalance,
      monthlySavings: this.summary.monthlySavingsAvg
    };

    // Semantic matching for intent-based filtering (supports Hebrew and English)
    const isExpenseQuery = /expense|spend|cost|buying|הוצאות|קנייה|כמה עולה/i.test(q);
    const isIncomeQuery = /income|salary|earn|הכנסות|שכר|משכורת/i.test(q);
    const isForecastQuery = /forecast|future|reach|predict|תחזית|מתי אגיע|עתיד/i.test(q);
    const isDebtQuery = /loan|debt|mortgage|payment|הלוואה|משכנתא|תשלום/i.test(q);

    if (isExpenseQuery) context.expenses = this.summary.expenses;
    if (isIncomeQuery) context.income = this.summary.income;
    if (isForecastQuery) context.forecast = this.displayForecast; // שולח את כל 6 החודשים שהוגדרו ב-displayForecast
    if (isDebtQuery) context.loans = this.summary.loans.map(l => ({ name: l.name, payment: l.monthlyPayment }));

    // Provide a high-level summary if no specific intent is detected
    if (!isExpenseQuery && !isIncomeQuery && !isForecastQuery && !isDebtQuery) {
      context.overview = {
        avgIncome: this.summary.income.average,
        avgExpenses: this.summary.expenses.averageTotal
      };
    }

    return context;
  }

  handleSuggestion(key: string) {
    // שליפת התרגום עבור המפתח שנבחר והזנתו לשדה הקלט
    this.translate.get(key).subscribe(translatedValue => {
      this.userInput = translatedValue;
    });
  }

  sendMessage() {
    const q = this.userInput.trim();
    if (!q || this.chatLoading) return;

    const context = this.prepareRelevantContext(q);

    this.messages.push({ role: 'user', content: q, timestamp: new Date() });
    this.userInput = '';
    this.chatLoading = true;
    this.shouldScroll = true;

    // Combine question and context into a single enriched prompt
    const langText = this.aiResponseLang === 'he' ? 'Hebrew' : 'English';
    const enrichedPrompt = context ? `Context: ${JSON.stringify(context)}\n\nUser Question: ${q}\n\nRespond strictly in ${langText}.` : `${q}\n\nRespond strictly in ${langText}.`;

    this.ai.chat(enrichedPrompt).subscribe({
      next: res => {
        this.messages.push({ role: 'assistant', content: res.answer, timestamp: new Date() });
        this.chatLoading = false;
        this.shouldScroll = true;
        this.saveConversation();
      },
      error: err => {
        this.messages.push({ role: 'assistant', content: `Error: ${err.error?.error || 'Failed to get response'}`, timestamp: new Date() });
        this.chatLoading = false;
        this.shouldScroll = true;
        this.saveConversation();
      }
    });
  }

  runAnalysis() {
    this.analysisLoading = true;
    this.analysisText = '';
    this.ai.getAnalysis().subscribe({
      next: res => {
        this.analysisText = res.analysis;
        this.analysisLoading = false;

        // ניסיון שמירה לתיעוד - אם נכשל, רק נדפיס ללוג ולא נפריע למשתמש
        this.reportService.save({
          type: 'analysis',
          content: res.analysis,
          createdAt: new Date().toISOString()
        }).subscribe({
          next: () => console.log('Analysis archived successfully'),
          error: err => console.error('Failed to archive analysis:', err)
        });
      },
      error: err => { this.analysisText = `Error: ${err.error?.error || 'Failed'}`; this.analysisLoading = false; }
    });
  }

  runScenario() {
    if (!this.scenario.description || !this.scenario.amount || !this.scenario.date) return;
    this.scenarioLoading = true;
    this.scenarioResult = null;
    this.ai.simulate(this.scenario).subscribe({
      next: res => {
        this.scenarioResult = res;
        this.scenarioLoading = false;
        // ארכוב אוטומטי של תוצאת הסימולטור
        this.reportService.save({
          type: 'scenario',
          content: res.scenarioAnalysis,
          scenarioDetails: { ...res.simulation.scenario },
          createdAt: new Date().toISOString()
        }).subscribe({
          error: err => console.error('Failed to archive scenario analysis:', err)
        });
      },
      error: err => { this.scenarioLoading = false; console.error(err); }
    });
  }

  onEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendMessage(); }
  }

  private scrollToBottom() {
    try { this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight; } catch { }
  }

  formatText(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h6 class="fw-bold mt-2 mb-1">$1</h6>')
      .replace(/^## (.+)$/gm, '<h5 class="fw-bold mt-3 mb-1">$1</h5>')
      .replace(/^# (.+)$/gm, '<h4 class="fw-bold mt-3 mb-1">$1</h4>')
      .replace(/\n/g, '<br>');
  }
}
