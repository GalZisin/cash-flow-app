import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, tap } from 'rxjs';
import { InvestmentCurrency } from '../models/investment.model';

const STORAGE_KEY_RATE = 'cash_flow_usd_ils_rate';
const STORAGE_KEY_TIME = 'cash_flow_usd_ils_time';
export const DEFAULT_USD_ILS_RATE = 3.70;
/** ILS-native rows used to store exchangeRate=1; that is not a real USD/ILS rate. */
export const MIN_USD_ILS_RATE = 2;
export const MAX_USD_ILS_RATE = 8;

/** Returns a usable USD/ILS rate, ignoring sentinel/implausible values such as 1. */
export function effectiveUsdIlsRate(stored?: number | null, fallback = DEFAULT_USD_ILS_RATE): number {
  if (isPlausibleUsdIlsRate(stored)) return stored;
  if (isPlausibleUsdIlsRate(fallback)) return fallback;
  return DEFAULT_USD_ILS_RATE;
}

export function isPlausibleUsdIlsRate(rate?: number | null): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= MIN_USD_ILS_RATE && rate <= MAX_USD_ILS_RATE;
}

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
      if (isPlausibleUsdIlsRate(val)) return val;
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
        if (isPlausibleUsdIlsRate(rate)) {
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

  effectiveRate(stored?: number | null): number {
    return effectiveUsdIlsRate(stored, this.usdRate());
  }

  toIls(usdAmount: number, rate?: number): number {
    const r = this.effectiveRate(rate);
    return Math.round(usdAmount * r * 100) / 100;
  }

  toUsd(ilsAmount: number, rate?: number): number {
    const r = this.effectiveRate(rate);
    return Math.round((ilsAmount / r) * 100) / 100;
  }

  currencySymbol(currency: InvestmentCurrency = 'ILS'): string {
    return currency === 'USD' ? '$' : '₪';
  }
}
