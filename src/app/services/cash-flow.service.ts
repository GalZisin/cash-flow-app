import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ExpenseItem } from '../models/expense.model';

export type { ExpenseItem };

export interface MonthData {
  month: string;
  startingBalance: number;
  income: number;
  mortgagePayment: number;
  loanPayment: number;
  manualLoanPayment?: number;
  regularExpenses: ExpenseItem[];
  specialExpenses: ExpenseItem[];
  endingBalance: number;
  rowColor?: string | null;
}

export interface CashFlowData {
  months: MonthData[];
}

export interface CashFlowDefaults {
  income: number;
  mortgagePayment: number;
  loanPayment: number;
  regularExpenses: ExpenseItem[];
  specialExpenses: ExpenseItem[];
}

@Injectable({ providedIn: 'root' })
export class CashFlowService {
  private readonly apiUrl = `${environment.apiUrl}/cash-flow`;
  private readonly defaultsUrl = `${environment.apiUrl}/cash-flow-defaults`;

  /** The months as last loaded / edited (signal is the source of truth). */
  private readonly _months = signal<MonthData[]>([]);
  readonly months = this._months.asReadonly();
  /** Same data as an observable, for the rxjs consumers (simulation service). */
  readonly cashFlowMonths$ = toObservable(this._months);

  constructor(private http: HttpClient) { }

  load(): Observable<CashFlowData> {
    return this.http.get<CashFlowData>(this.apiUrl).pipe(
      tap(data => {
        if (data && data.months) this._months.set(data.months);
      })
    );
  }

  updateMonths(months: MonthData[]) {
    this._months.set(months);
  }

  save(data: CashFlowData): Observable<CashFlowData> {
    return this.http.post<CashFlowData>(this.apiUrl, data).pipe(
      tap(() => this._months.set(data.months))
    );
  }

  loadDefaults(): Observable<CashFlowDefaults> {
    return this.http.get<CashFlowDefaults>(this.defaultsUrl);
  }

  saveDefaults(defaults: CashFlowDefaults): Observable<CashFlowDefaults> {
    return this.http.post<CashFlowDefaults>(this.defaultsUrl, defaults);
  }
}
