import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AiService, ChatMessage, FinancialSummary, ScenarioRequest, ScenarioResult } from '../../services/ai.service';
import { ConversationService, Conversation } from '../../services/conversation.service';
import { LanguageService } from '../../services/language.service';

type ActiveTab = 'chat' | 'analysis' | 'scenario';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
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

  private shouldScroll = false;

  constructor(
    private ai: AiService,
    private convService: ConversationService,
    public lang: LanguageService,
    private translate: TranslateService
  ) { }

  ngOnInit() {
    this.loadSummary();
    this.convService.load().subscribe();
    this.convService.items$.subscribe(items => this.conversations = items);
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

  newConversation() {
    this.messages = [];
    this.activeConversationId = null;
  }

  loadConversation(conv: Conversation) {
    this.activeConversationId = conv.id;
    this.messages = conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
    this.shouldScroll = true;
  }

  deleteConversation(id: string, event: Event) {
    event.stopPropagation();
    this.convService.delete(id).subscribe();
    if (this.activeConversationId === id) this.newConversation();
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
   * Reduces the financial summary to essential data based on the user's question.
   * This implements a RAG-like filtering to minimize token usage and improve response accuracy.
   */
  private prepareRelevantContext(query: string): any {
    if (!this.summary) return null;

    const q = query.toLowerCase();
    const context: any = {
      currentBalance: this.summary.currentBalance,
      monthlySavings: this.summary.monthlySavingsAvg
    };

    // Semantic matching for intent-based filtering (supports Hebrew and English)
    const isExpenseQuery = /expense|spend|cost|buying|הוצאות|קנייה|כמה עולה/i.test(q);
    const isIncomeQuery = /income|salary|earn|הכנסות|שכר|משכורת/i.test(q);
    const isForecastQuery = /forecast|future|reach|predict|תחזית|מתי אגיע|עתיד/i.test(q);
    const isDebtQuery = /loan|debt|mortgage|payment|הלוואה|משכנתא|תשלום/i.test(q);

    if (isExpenseQuery) context.expenses = this.summary.expenses;
    if (isIncomeQuery) context.income = this.summary.income;
    if (isForecastQuery) context.forecast = this.summary.forecast.slice(0, 3); // Send only next 3 months
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
    const enrichedPrompt = context ? `Context: ${JSON.stringify(context)}\n\nUser Question: ${q}` : q;

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
      next: res => { this.analysisText = res.analysis; this.analysisLoading = false; },
      error: err => { this.analysisText = `Error: ${err.error?.error || 'Failed'}`; this.analysisLoading = false; }
    });
  }

  runScenario() {
    if (!this.scenario.description || !this.scenario.amount || !this.scenario.date) return;
    this.scenarioLoading = true;
    this.scenarioResult = null;
    this.ai.simulate(this.scenario).subscribe({
      next: res => { this.scenarioResult = res; this.scenarioLoading = false; },
      error: err => { this.scenarioLoading = false; console.error(err); }
    });
  }

  onEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendMessage(); }
  }

  private scrollToBottom() {
    try { this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight; } catch {}
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
