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

  simulate(req: ScenarioRequest): Observable<ScenarioResult> {
    return this.http.post<ScenarioResult>(`${this.base}/scenario`, req);
  }
}
