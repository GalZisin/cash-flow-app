import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ExpenseItem {
  description: string;
  amount: number;
}

export interface MonthData {
  month: string;
  startingBalance: number;
  income: number;
  mortgagePayment: number;
  loanPayment: number;
  regularExpenses: ExpenseItem[];
  specialExpenses: ExpenseItem[];
  endingBalance: number;
  rowColor?: string | null;
}

export interface CashFlowData {
  months: MonthData[];
}

@Injectable({ providedIn: 'root' })
export class CashFlowService {
  private readonly apiUrl = `${environment.apiUrl}/cash-flow`;

  constructor(private http: HttpClient) { }

  load(): Observable<CashFlowData> {
    return this.http.get<CashFlowData>(this.apiUrl);
  }

  save(data: CashFlowData): Observable<CashFlowData> {
    return this.http.post<CashFlowData>(this.apiUrl, data);
  }
}
