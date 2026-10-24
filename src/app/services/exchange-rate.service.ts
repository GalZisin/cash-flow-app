import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, tap } from 'rxjs';
import { InvestmentCurrency } from '../models/investment.model';

const STORAGE_KEY_RATE = 'cash_flow_usd_ils_rate';
const STORAGE_KEY_TIME = 'cash_flow_usd_ils_time';
export const DEFAULT_USD_ILS_RATE = 3.70;

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  readonly usdRate = signal<number>(this.loadCachedRate());
  readonly lastUpdated = signal<string | null>(localStorage.getItem(STORAGE_KEY_TIME));
  readonly isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {
    this.refreshRate();
  }

  private loadCachedRate(): number {
    const cached = localStorage.getItem(STORAGE_KEY_RATE);
    if (cached) {
      const val = parseFloat(cached);
      if (Number.isFinite(val) && val > 0) return val;
    }
    return DEFAULT_USD_ILS_RATE;
  }

  refreshRate() {
    this.isLoading.set(true);
    // Fetch from open.er-api.com (free, reliable, CORS enabled)
    this.http.get<{ rates?: { ILS?: number } }>('https://open.er-api.com/v6/latest/USD').pipe(
      map(res => res?.rates?.ILS),
      catchError(() => {
        // Fallback to Frankfurter
        return this.http.get<{ rates?: { ILS?: number } }>('https://api.frankfurter.app/latest?from=USD&to=ILS').pipe(
          map(res => res?.rates?.ILS),
          catchError(() => of(undefined))
        );
      }),
      tap(rate => {
        this.isLoading.set(false);
        if (rate && Number.isFinite(rate) && rate > 0) {
          const rounded = Math.round(rate * 10000) / 10000;
          this.usdRate.set(rounded);
          const time = new Date().toISOString();
          this.lastUpdated.set(time);
          try {
            localStorage.setItem(STORAGE_KEY_RATE, String(rounded));
            localStorage.setItem(STORAGE_KEY_TIME, time);
          } catch (_) { }
        }
      })
    ).subscribe();
  }

  toIls(usdAmount: number, rate?: number): number {
    const r = rate && rate > 0 ? rate : this.usdRate();
    return Math.round(usdAmount * r * 100) / 100;
  }

  toUsd(ilsAmount: number, rate?: number): number {
    const r = rate && rate > 0 ? rate : this.usdRate();
    return Math.round((ilsAmount / r) * 100) / 100;
  }

  currencySymbol(currency: InvestmentCurrency = 'ILS'): string {
    return currency === 'USD' ? '$' : '₪';
  }
}
