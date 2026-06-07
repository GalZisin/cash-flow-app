import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService, ChatMessage, FinancialSummary, ScenarioRequest, ScenarioResult } from '../../services/ai.service';

type ActiveTab = 'chat' | 'analysis' | 'scenario';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  // Analysis
  analysisText = '';
  analysisLoading = false;

  // Scenario
  scenario: ScenarioRequest = { description: '', amount: 0, date: '' };
  scenarioResult: ScenarioResult | null = null;
  scenarioLoading = false;

  private shouldScroll = false;

  constructor(private ai: AiService) {}

  ngOnInit() {
    this.loadSummary();
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  loadSummary() {
    this.summaryLoading = true;
    this.ai.getSummary().subscribe({
      next: s => { this.summary = s; this.summaryLoading = false; },
      error: () => { this.summaryLoading = false; }
    });
  }

  sendMessage() {
    const q = this.userInput.trim();
    if (!q || this.chatLoading) return;

    this.messages.push({ role: 'user', content: q, timestamp: new Date() });
    this.userInput = '';
    this.chatLoading = true;
    this.shouldScroll = true;

    this.ai.chat(q).subscribe({
      next: res => {
        this.messages.push({ role: 'assistant', content: res.answer, timestamp: new Date() });
        this.chatLoading = false;
        this.shouldScroll = true;
      },
      error: err => {
        this.messages.push({ role: 'assistant', content: `Error: ${err.error?.error || 'Failed to get response'}`, timestamp: new Date() });
        this.chatLoading = false;
        this.shouldScroll = true;
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
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom() {
    try { this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight; } catch {}
  }

  // Render markdown-style bold (**text**) and line breaks
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
