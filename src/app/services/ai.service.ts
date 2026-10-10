import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FinancialSummary {
  periodCovered: { from: string; to: string; months: number };
  currentBalance?: number;
  balanceGrowth: number;
  income: { average: number; defaults: number };
  expenses: { averageTotal: number; avgMortgage: number; avgLoan: number; avgInstallments: number; avgRegular: number };
  monthlySavingsAvg: number;
  loans: { name: string; totalAmount: number; monthlyPayment: number; remainingPayments: number; remainingBalance: number }[];
  installments: { name: string; totalAmount: number; monthlyPayment: number; remainingPayments: number }[];
  investments: { name: string; type: string; currentValue: number | null }[];
  forecast: { month: string; projectedBalance: number }[];
}

export type InsightType = 'positive' | 'warning' | 'risk' | 'tip';

export interface AiInsight {
  type: InsightType;
  title: string;
  text: string;
}

/** מה שמוצג בגרפי מגמות התזרים (ראה CashFlowChartsComponent.insightsSnapshot). */
export interface InsightsTrends {
  settings: { period: string; range: string; projectionYears: number; incomeGrowthPct: number; expenseGrowthPct: number; basisMonths: number };
  summary: {
    months: number; avgIncome: number; avgExpenses: number; avgNet: number; savingsRatePct: number | null;
    balanceNow: number | null; balanceEnd: number | null; endKey: string | null;
  };
  periods: { period: string; kind: string; income: number; expenses: number; net: number; balance: number; savingsRatePct: number | null }[];
}

/** תמונת הדאשבורד שנשלחת עם בקשת התובנות. */
export interface InsightsDashboard {
  kpis: { balanceToday: number; totalInvestments: number; activeInstallments: number; monthlyInstallmentsPayment: number };
  trends?: InsightsTrends;
}

export interface InsightsResponse {
  model: string;
  insights: AiInsight[];
  /** הרשומה שנשמרה בארכיון (null אם השמירה נכשלה) */
  report: { id: string; createdAt: string } | null;
  archived: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ScenarioRequest {
  description: string;
  amount: number;
  date: string;
}

export interface ScenarioResult {
  simulation: {
    scenario: ScenarioRequest;
    balanceAfterPurchase: number;
    forecast: { month: string; projectedBalance: number; note: string | null }[];
  };
  model: string;
  scenarioAnalysis: string;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly base = `${environment.apiUrl}/ai`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<FinancialSummary> {
    return this.http.get<FinancialSummary>(`${this.base}/summary`);
  }

  getAnalysis(): Observable<{ summary: FinancialSummary; model: string; analysis: string }> {
    return this.http.post<any>(`${this.base}/analysis`, {});
  }

  chat(question: string): Observable<{ model: string; answer: string }> {
    return this.http.post<any>(`${this.base}/chat`, { question });
  }

  /** תובנות מהסיכום + תמונת הדאשבורד. השרת שומר אותן בארכיון. */
  insights(dashboard: InsightsDashboard, lang: 'he' | 'en'): Observable<InsightsResponse> {
    return this.http.post<InsightsResponse>(`${this.base}/insights`, { dashboard, lang });
  }

  simulate(req: ScenarioRequest): Observable<ScenarioResult> {
    return this.http.post<ScenarioResult>(`${this.base}/scenario`, req);
  }

  chatStream(question: string): Observable<string> {
    return new Observable<string>(observer => {
      const controller = new AbortController();

      fetch(`${this.base}/chat-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: controller.signal
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error('ReadableStream not supported');

          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            observer.next(decoder.decode(value, { stream: true }));
          }
          observer.complete();
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            observer.error(err);
          }
        });

      return () => controller.abort();
    });
  }
}
