import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, inject, signal, computed, ChangeDetectionStrategy, DestroyRef, effect } from '@angular/core';
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
import { Subscription, take } from 'rxjs';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

type ActiveTab = 'chat' | 'analysis' | 'scenario' | 'dashboard' | 'archive';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslateModule, MatTooltipModule],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss'
})
export class AiAssistantComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  activeTab = signal<ActiveTab>('chat');

  // Summary
  summary = signal<FinancialSummary | null>(null);
  summaryLoading = signal(false);

  // Chat
  messages = signal<ChatMessage[]>([]);
  userInput = '';
  chatLoading = signal(false);
  private currentStreamSubscription: Subscription | null = null; // To manage the streaming subscription
  private lastUserQuestion: string | null = null; // Store the last user question for retry

  // Conversations
  conversations = signal<Conversation[]>([]);
  activeConversationId = signal<string | null>(null);

  // Analysis
  analysisText = signal('');
  analysisLoading = signal(false);

  // Scenario
  scenario: ScenarioRequest = { description: '', amount: 0, date: '' };
  scenarioResult = signal<ScenarioResult | null>(null);
  scenarioLoading = signal(false);

  // Archive
  archivedReports = signal<AiReport[]>([]);
  archiveLoading = signal(false);
  archiveFilterType = signal<'all' | 'analysis' | 'insights' | 'scenario'>('all');
  archiveSearchQuery = signal('');
  pendingDeleteReportId = signal<string | null>(null);

  // Dashboard
  realCurrentBalance = signal(0);
  totalActiveInstallments = signal(0);
  totalMonthlyInstallmentsPayment = signal(0);
  totalInvestmentsValue = signal(0);
  insights = signal<string[]>([]);
  insightsLoading = signal(false);
  insightsLoaded = signal(false);
  aiResponseLang = signal<'he' | 'en'>('he'); // עברית כברירת מחדל

  // Confirmation for deleting chat
  pendingDeleteChatId = signal<string | null>(null);

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
  private destroyRef = inject(DestroyRef);

  // Assuming InvestmentService.items is a Signal<Investment[]>
  constructor() { }

  private shouldScroll = false; // Moved here to be consistent

  // Convert Observables to Signals
  conversationsSignal = toSignal(this.convService.items$, { initialValue: [] });
  cashFlowMonthsSignal = toSignal(this.cashFlowService.cashFlowMonths$, { initialValue: [] });
  investmentsSignal = toSignal(this.investmentService.investments$, { initialValue: [] });

  ngOnInit() {
    this.loadSummary();
    this.convService.load().subscribe();

    // Update realCurrentBalance based on cashFlowMonthsSignal
    // Using effect to react to signal changes
    effect(() => {
      const months = this.cashFlowMonthsSignal();
      const now = new Date();
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // פורמט YYYY-MM מקומי
      const currentMonth = months.find((m: any) => m.month.startsWith(nowStr));
      if (currentMonth) {
        this.realCurrentBalance.set(currentMonth.endingBalance);
      }
    });

    // Update totalActiveInstallments and totalMonthlyInstallmentsPayment
    effect(() => {
      const items = this.installmentService.items();
      this.totalActiveInstallments.set(items.filter(i => !this.installmentService.getStatus(i).isCompleted).length);
      this.totalMonthlyInstallmentsPayment.set(this.installmentService.totalMonthlyActive()); // Use the computed signal directly
    });

    // Update totalInvestmentsValue
    effect(() => {
      const items = this.investmentsSignal();
      this.totalInvestmentsValue.set((items || []).reduce((sum: number, inv: any) => {
        const snaps = inv.snapshots || [];
        return sum + (snaps[snaps.length - 1]?.value ?? 0);
      }, 0));
    });

    this.loadDashboardData(); // Initial load for dashboard data
  }

  setTab(tab: ActiveTab) {
    this.activeTab.set(tab);
    if (tab === 'archive') {
      this.loadArchive();
    } 
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.chatContainer) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  loadSummary() {
    this.summaryLoading.set(true); // Use .set() for signals
    this.ai.getSummary().subscribe({
      next: s => { this.summary.set(s); this.summaryLoading.set(false); },
      error: () => { this.summaryLoading.set(false); }
    });
  }

  loadDashboardData() {
    // Ensure all necessary data is loaded for the dashboard
    this.loadSummary(); // Summary is already loaded, but good to ensure it's fresh
    this.installmentService.load().subscribe();
    this.investmentService.load().subscribe({ // Assuming load() returns an Observable and updates its internal signal
      next: (items: any[]) => {
        this.totalInvestmentsValue.set(items.reduce((sum: number, inv: { snapshots?: { value: number }[] }) => { // Explicitly type inv
          const snaps = inv.snapshots || [];
          return sum + (snaps[snaps.length - 1]?.value ?? 0);
        }, 0));
      },
      error: (err) => console.error('Failed to load investments for dashboard:', err)
    });
  }

  loadArchive() {
    this.archiveLoading.set(true);
    this.reportService.loadAll().subscribe({
      next: reports => { this.archivedReports.set(reports); this.archiveLoading.set(false); },
      error: () => { this.archiveLoading.set(false); }
    });
  }

  get filteredReports() {
    return this.archivedReports().filter(report => {
      const matchesType = this.archiveFilterType() === 'all' || report.type === this.archiveFilterType();
      const contentStr = (report.type === 'analysis' || report.type === 'scenario') ? report.content : report.content.join(' ');

      let matchesSearch = !this.archiveSearchQuery() ||
        contentStr.toLowerCase().includes(this.archiveSearchQuery().toLowerCase()) ||
        report.createdAt.includes(this.archiveSearchQuery());

      if (!matchesSearch && report.type === 'scenario') {
        matchesSearch = report.scenarioDetails.description.toLowerCase().includes(this.archiveSearchQuery().toLowerCase());
      }
      return matchesType && matchesSearch;
    });
  }

  confirmDeleteReport(id: string) {
    this.pendingDeleteReportId.set(id);
  }

  cancelDeleteReport() {
    this.pendingDeleteReportId.set(null);
  }

  doDeleteReport() {
    const id = this.pendingDeleteReportId();
    if (id) {
      this.reportService.delete(id).subscribe(() => {
        this.archivedReports.update(reports => reports.filter(r => r.id !== this.pendingDeleteReportId()));
        this.pendingDeleteReportId.set(null);
      });
    }
  }

  toggleAiLang(): void {
    this.aiResponseLang.update(lang => lang === 'he' ? 'en' : 'he');
  }

  loadInsights() {
    this.insights.set([]); // Clear previous insights
    this.insightsLoading.set(true);
    this.insightsLoaded.set(true);
    // פנייה ל-AI לקבלת תובנות פרו-אקטיביות
    const langText = this.aiResponseLang() === 'he' ? 'Hebrew' : 'English';
    const prompt = `Please provide 3-4 short, proactive financial insights or warnings based on my data. Focus on trends and future risks. Be concise and practical. Respond strictly in ${langText}.`;
    this.ai.chat(prompt).subscribe({
      next: res => {
        const lines = res.answer.split('\n').filter(l => l.trim().length > 5);
        this.insights.set(lines);
        this.insightsLoading.set(false);

        // שמירה לתיעוד ב-JSON
        this.reportService.save({
          type: 'insights',
          content: lines,
          createdAt: new Date().toISOString()
        }).subscribe({
          error: err => console.error('Failed to archive insights:', err)
        });
      },
      error: () => { this.insightsLoading.set(false); }
    });
  }

  newConversation() {
    this.messages.set([]);
    this.activeConversationId.set(null);
  }

  loadConversation(conv: Conversation) {
    this.activeConversationId.set(conv.id);
    this.messages.set(conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
    this.shouldScroll = true;
  }

  confirmDeleteChat(id: string, event: Event) {
    event.stopPropagation();
    this.pendingDeleteChatId.set(id);
  }

  cancelDeleteChat(): void {
    this.pendingDeleteChatId.set(null); // Use .set() for signals
  }

  doDeleteChat() {
    const id = this.pendingDeleteChatId();
    if (id) {
      this.convService.delete(id).subscribe(() => {
        if (this.activeConversationId() === id) this.newConversation();
        this.pendingDeleteChatId.set(null);
      });
    }
  }

  private saveConversation(): void {
    const title = this.messages().find(m => m.role === 'user')?.content.slice(0, 40) || this.translate.instant('AI.NEW_CHAT_DEFAULT_TITLE'); // Use i18n for default title
    if (this.activeConversationId()) {
      this.convService.update(this.activeConversationId()!, title, this.messages()).subscribe();
    } else {
      this.convService.create(title, this.messages()).subscribe(
        c => this.activeConversationId.set(c.id)
      );
    }
  }

  /**
   * מחזירה את התחזית החל מהחודש הנוכחי בלבד (עד 6 חודשים קדימה)
   */
  get displayForecast(): any[] {
    if (!this.summary()?.forecast || this.summary()!.forecast.length === 0) return [];

    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. הסרת כפילויות לפי חודש (למשל אם מגיע פעמיים 2029-03) ונרמול הפורמט ל-YYYY-MM
    const uniqueMap = new Map<string, any>();
    this.summary()!.forecast.forEach(f => {
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
    if (!this.summary()) return null;

    const q = query.toLowerCase();
    const context: any = {
      currentBalance: this.realCurrentBalance(),
      monthlySavings: this.summary()!.monthlySavingsAvg
    }; // Use .get() for signals

    // Semantic matching for intent-based filtering (supports Hebrew and English)
    const isExpenseQuery = /expense|spend|cost|buying|הוצאות|קנייה|כמה עולה/i.test(q);
    const isIncomeQuery = /income|salary|earn|הכנסות|שכר|משכורת/i.test(q);
    const isForecastQuery = /forecast|future|reach|predict|תחזית|מתי אגיע|עתיד/i.test(q);
    const isDebtQuery = /loan|debt|mortgage|payment|הלוואה|משכנתא|תשלום/i.test(q);

    if (isExpenseQuery) context.expenses = this.summary()!.expenses;
    if (isIncomeQuery) context.income = this.summary()!.income;
    if (isForecastQuery) context.forecast = this.displayForecast; // שולח את כל 6 החודשים שהוגדרו ב-displayForecast
    if (isDebtQuery) context.loans = this.summary()!.loans.map(l => ({ name: l.name, payment: l.monthlyPayment }));

    // Provide a high-level summary if no specific intent is detected
    if (!isExpenseQuery && !isIncomeQuery && !isForecastQuery && !isDebtQuery) {
      context.overview = {
        avgIncome: this.summary()!.income.average,
        avgExpenses: this.summary()!.expenses.averageTotal
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

  sendMessage(questionToAsk?: string) {
    const q = questionToAsk || this.userInput.trim(); // userInput is still a string
    if (!q || this.chatLoading()) return;

    // Cancel any previous ongoing stream
    if (this.currentStreamSubscription) {
      this.currentStreamSubscription.unsubscribe();
      this.currentStreamSubscription = null;
    }

    // If this is a new user input, add it to messages and clear input
    if (!questionToAsk) {
      this.messages.update(msgs => [...msgs, { role: 'user', content: q, timestamp: new Date() }]);
      this.userInput = '';
    } // userInput is a string, not a signal, so direct assignment is fine

    this.chatLoading.set(true);
    this.shouldScroll = true;
    this.lastUserQuestion = q; // Store the user's question for retry

    if (questionToAsk && this.messages().length > 0 && this.messages()[this.messages().length - 1].role === 'assistant') {
      this.messages.update(msgs => { msgs.pop(); return msgs; });
    }

    let assistantMsg: ChatMessage | null = null;

    // בניית היסטוריית השיחה כטקסט עבור המודל (לוקחים למשל את 5 ההודעות האחרונות)
    const historyContext = this.messages()
      .slice(-6, -1) // מוציאים את ההודעות האחרונות לפני השאלה הנוכחית
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    // שילוב הקשר פיננסי + היסטוריית שיחה + שאלה נוכחית
    // this.summary is a signal, so summary()
    const context = this.prepareRelevantContext(q);
    const langText = this.aiResponseLang() === 'he' ? 'Hebrew' : 'English';

    const enrichedPrompt = `
      System Financial Context: ${JSON.stringify(context)}
      ${historyContext ? '\nRecent Conversation History:\n' + historyContext : ''}
      
      User Question: ${q}
      
      Respond strictly in ${langText}.`;

    this.currentStreamSubscription = this.ai.chatStream(enrichedPrompt).subscribe({
      next: (token: string) => {
        if (!assistantMsg) {
          this.chatLoading.set(false);
          assistantMsg = { role: 'assistant', content: '', timestamp: new Date() };
          this.messages.update(msgs => [...msgs, assistantMsg!]);
        }
        assistantMsg.content += token;
        this.shouldScroll = true;
      },
      error: (err: any) => {
        this.chatLoading.set(false);
        // Ensure assistantMsg is initialized if error occurs before first token, and update messages signal
        const errorMessage = this.translate.instant('AI.PARTIAL_RESPONSE_ERROR', { error: err.message || 'Failed to get response' });

        if (!assistantMsg) {
          assistantMsg = { role: 'assistant', content: '', timestamp: new Date() };
          this.messages.update(msgs => [...msgs, assistantMsg!]);
        }

        assistantMsg.content += `\n\n**${errorMessage}**`;
        this.saveConversation();
        this.currentStreamSubscription = null; // Clear subscription on error
      },
      complete: () => {
        if (this.chatLoading()) {
          this.chatLoading.set(false);
        }
        this.chatLoading.set(false);
        this.shouldScroll = true;
        this.saveConversation();
        this.lastUserQuestion = null; // Clear on successful completion
        this.currentStreamSubscription = null; // Clear subscription on completion
      }
    });
  }

  retryLastMessage(event: Event) {
    event.preventDefault(); // Prevent default link behavior
    if (this.lastUserQuestion && !this.chatLoading()) {
      this.sendMessage(this.lastUserQuestion);
    }
  }

  runAnalysis() {
    this.analysisLoading.set(true);
    this.analysisText.set('');
    this.ai.getAnalysis().subscribe({
      next: res => {
        this.analysisText.set(res.analysis);
        this.analysisLoading.set(false); // Corrected to use .set()

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
      error: err => { this.analysisText.set(`Error: ${err.error?.error || 'Failed'}`); this.analysisLoading.set(false); }
    });
  }

  runScenario() {
    if (!this.scenario.description || !this.scenario.amount || !this.scenario.date) return;
    this.scenarioLoading.set(true);
    this.scenarioResult.set(null);
    this.ai.simulate(this.scenario).subscribe({
      next: res => {
        this.scenarioResult.set(res);
        this.scenarioLoading.set(false); // Corrected to use .set()
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
      error: err => { this.scenarioLoading.set(false); console.error(err); }
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
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/^### (.+)$/gm, '<h6 class="fw-bold mt-2 mb-1">$1</h6>') // H3
      .replace(/^## (.+)$/gm, '<h5 class="fw-bold mt-3 mb-1">$1</h5>') // H2
      .replace(/^# (.+)$/gm, '<h4 class="fw-bold mt-3 mb-1">$1</h4>') // H1
      .replace(/\n/g, '<br>'); // Newlines to <br>
  }
}
