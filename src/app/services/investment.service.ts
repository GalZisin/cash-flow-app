import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { Investment, Snapshot } from '../models/investment.model';

@Injectable({ providedIn: 'root' })
export class InvestmentService {
  private readonly url = 'http://localhost:3000/api/investments';
  private _investments = new BehaviorSubject<Investment[]>([]);
  investments$ = this._investments.asObservable();

  constructor(private http: HttpClient) {}

  load() {
    return this.http.get<Investment[]>(this.url).pipe(
      tap(data => this._investments.next(data))
    );
  }

  add(investment: Omit<Investment, 'id' | 'snapshots'>) {
    return this.http.post<Investment>(this.url, investment).pipe(
      tap(inv => this._investments.next([...this._investments.value, inv]))
    );
  }

  update(id: string, changes: Partial<Investment>) {
    return this.http.put<Investment>(`${this.url}/${id}`, changes).pipe(
      tap(updated => this._investments.next(
        this._investments.value.map(i => i.id === id ? updated : i)
      ))
    );
  }

  addSnapshot(id: string, snapshot: Snapshot) {
    return this.http.post<Investment>(`${this.url}/${id}/snapshot`, snapshot).pipe(
      tap(updated => this._investments.next(
        this._investments.value.map(i => i.id === id ? updated : i)
      ))
    );
  }

  delete(id: string) {
    return this.http.delete(`${this.url}/${id}`).pipe(
      tap(() => this._investments.next(this._investments.value.filter(i => i.id !== id)))
    );
  }

  // --- Calculations ---
  percentChange(snapshots: Snapshot[]): number | null {
    if (snapshots.length < 2) return null;
    const first = snapshots[0].value;
    const last = snapshots[snapshots.length - 1].value;
    return ((last - first) / first) * 100;
  }

  cagr(snapshots: Snapshot[]): number | null {
    if (snapshots.length < 2) return null;
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const years = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (years <= 0) return null;
    return (Math.pow(last.value / first.value, 1 / years) - 1) * 100;
  }

  xirr(snapshots: Snapshot[]): number | null {
    const cashflows = snapshots
      .filter(s => s.deposit != null)
      .map(s => ({ date: new Date(s.date), amount: -(s.deposit!) }));
    if (snapshots.length === 0) return null;
    const last = snapshots[snapshots.length - 1];
    cashflows.push({ date: new Date(last.date), amount: last.value });
    if (cashflows.length < 2) return null;
    return this._xirrCalc(cashflows);
  }

  private _xirrCalc(flows: { date: Date; amount: number }[]): number | null {
    const maxIter = 100;
    let rate = 0.1;
    for (let i = 0; i < maxIter; i++) {
      let f = 0, df = 0;
      const t0 = flows[0].date.getTime();
      for (const cf of flows) {
        const t = (cf.date.getTime() - t0) / (365.25 * 24 * 3600 * 1000);
        f += cf.amount / Math.pow(1 + rate, t);
        df += -t * cf.amount / Math.pow(1 + rate, t + 1);
      }
      const newRate = rate - f / df;
      if (Math.abs(newRate - rate) < 1e-7) return newRate * 100;
      rate = newRate;
    }
    return null;
  }
}
