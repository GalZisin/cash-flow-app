import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { Investment, Snapshot, Transaction, SimulationRule } from '../models/investment.model';
import { environment } from '../../environments/environment';

const MS_YEAR = 365.25 * 24 * 3600 * 1000;

@Injectable({ providedIn: 'root' })
export class InvestmentService {
  private readonly url = `${environment.apiUrl}/investments`;
  private _investments = new BehaviorSubject<Investment[]>([]);
  investments$ = this._investments.asObservable();

  constructor(private http: HttpClient) { }

  private patch(updated: Investment) {
    this._investments.next(this._investments.value.map(i => i.id === updated.id ? updated : i));
  }

  load() {
    return this.http.get<Investment[]>(this.url).pipe(
      tap(data => this._investments.next(data.map(inv => ({
        ...inv,
        snapshots: inv.snapshots ?? [],
        transactions: inv.transactions ?? []
      }))))
    );
  }

  add(investment: Omit<Investment, 'id'>) {
    return this.http.post<Investment>(this.url, investment).pipe(
      tap(inv => this._investments.next([...this._investments.value, inv]))
    );
  }

  update(id: string, changes: Partial<Investment>) {
    return this.http.put<Investment>(`${this.url}/${id}`, changes).pipe(
      tap(updated => this.patch(updated))
    );
  }

  delete(id: string) {
    return this.http.delete(`${this.url}/${id}`).pipe(
      tap(() => this._investments.next(this._investments.value.filter(i => i.id !== id)))
    );
  }

  // --- Snapshot CRUD ---
  addSnapshot(id: string, snapshot: Snapshot) {
    return this.http.post<Investment>(`${this.url}/${id}/snapshot`, snapshot).pipe(
      tap(updated => this.patch(updated))
    );
  }

  updateSnapshot(id: string, snapshotId: string, snapshot: Snapshot) {
    return this.http.put<Investment>(`${this.url}/${id}/snapshot/${snapshotId}`, snapshot).pipe(
      tap(updated => this.patch(updated))
    );
  }

  deleteSnapshot(id: string, snapshotId: string) {
    return this.http.delete<Investment>(`${this.url}/${id}/snapshot/${snapshotId}`).pipe(
      tap(updated => this.patch(updated))
    );
  }

  // --- Transaction CRUD ---
  addTransaction(id: string, tx: Transaction) {
    return this.http.post<Investment>(`${this.url}/${id}/transaction`, tx).pipe(
      tap(updated => this.patch(updated))
    );
  }

  updateTransaction(id: string, txId: string, tx: Transaction) {
    return this.http.put<Investment>(`${this.url}/${id}/transaction/${txId}`, tx).pipe(
      tap(updated => this.patch(updated))
    );
  }

  deleteTransaction(id: string, txId: string) {
    return this.http.delete<Investment>(`${this.url}/${id}/transaction/${txId}`).pipe(
      tap(updated => this.patch(updated))
    );
  }

  // --- Calculations ---
  percentChange(snapshots: Snapshot[]): number | null {
    if (!snapshots || snapshots.length < 2) return null;
    const sorted = this.sortedSnapshots(snapshots);
    return ((sorted.at(-1)!.value - sorted[0].value) / sorted[0].value) * 100;
  }

  cagr(snapshots: Snapshot[]): number | null {
    if (!snapshots || snapshots.length < 2) return null;
    const sorted = this.sortedSnapshots(snapshots);
    const years = (new Date(sorted.at(-1)!.date).getTime() - new Date(sorted[0].date).getTime()) / MS_YEAR;
    if (years <= 0) return null;
    return (Math.pow(sorted.at(-1)!.value / sorted[0].value, 1 / years) - 1) * 100;
  }

  xirr(investment: Investment): number | null {
    const txs = investment.transactions ?? [];
    const snaps = investment.snapshots ?? [];
    if (!txs.length || !snaps.length) return null;

    const flows: { date: Date; amount: number }[] = txs.map(t => ({
      date: new Date(t.date),
      amount: t.type === 'deposit' ? -Math.abs(t.amount) : Math.abs(t.amount)
    }));

    const lastSnap = this.sortedSnapshots(snaps).at(-1)!;
    flows.push({ date: new Date(lastSnap.date), amount: lastSnap.value });
    flows.sort((a, b) => a.date.getTime() - b.date.getTime());

    const hasPos = flows.some(f => f.amount > 0);
    const hasNeg = flows.some(f => f.amount < 0);
    if (!hasPos || !hasNeg) return null;

    for (const start of [0.1, 0.05, 0.2, 0.0, -0.05]) {
      const r = this._xirrCalc(flows, start);
      if (r !== null && r > -99 && r < 500) return r;
    }
    return null;
  }

  private sortedSnapshots(snapshots: Snapshot[]): Snapshot[] {
    return [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private _xirrCalc(flows: { date: Date; amount: number }[], initialRate: number): number | null {
    let rate = initialRate;
    const t0 = flows[0].date.getTime();
    for (let i = 0; i < 200; i++) {
      let f = 0, df = 0;
      for (const cf of flows) {
        const t = (cf.date.getTime() - t0) / MS_YEAR;
        const base = 1 + rate;
        if (base <= 0) return null;
        const denom = Math.pow(base, t);
        f += cf.amount / denom;
        df += (-t * cf.amount) / (denom * base);
      }
      if (!isFinite(f) || !isFinite(df) || Math.abs(df) < 1e-10) return null;
      const next = rate - f / df;
      if (!isFinite(next)) return null;
      if (Math.abs(next - rate) < 1e-6) return next * 100;
      rate = Math.max(next, -0.999);
    }
    return null;
  }

  xirrByYear(investment: Investment): { year: number; value: number | null }[] {
    const snaps = this.sortedSnapshots(investment.snapshots ?? []);
    const txs = investment.transactions ?? [];

    const years = [...new Set(snaps.map(s => new Date(s.date).getFullYear()))];

    return years.map(year => {
      const startSnap = snaps.find(s => new Date(s.date).getFullYear() === year - 1)?.value;
      const endSnap = snaps.find(s => new Date(s.date).getFullYear() === year)?.value;

      if (!endSnap) return { year, value: null };

      const flows: { date: Date; amount: number }[] = [];

      if (startSnap != null) {
        flows.push({ date: new Date(`${year}-01-01`), amount: -startSnap });
      }

      txs
        .filter(t => new Date(t.date).getFullYear() === year)
        .forEach(t => {
          flows.push({
            date: new Date(t.date),
            amount: t.type === 'deposit' ? -Math.abs(t.amount) : Math.abs(t.amount)
          });
        });

      flows.push({ date: new Date(`${year}-12-31`), amount: endSnap });

      const result = this._xirrCalc(flows, 0.1);
      return { year, value: result };
    });
  }

  // --- Simulation Logic ---
  calculateSimulation(initial: number, annualRate: number, years: number, rules: SimulationRule[] = []) {
    const r = annualRate / 100 / 12;
    const n = years * 12;
    const projVals: number[] = [];
    const depVals: number[] = [];
    let val = initial;
    let dep = initial;

    for (let m = 0; m <= n; m++) {
      projVals.push(val);
      depVals.push(dep);

      const nextMonth = m + 1;
      const activeRules = rules.filter(rule => nextMonth >= rule.fromMonth && nextMonth <= rule.toMonth);

      let monthlyDeposit = 0;
      activeRules.forEach(rule => {
        monthlyDeposit += Number(rule.monthlyAmount || 0);
        if (nextMonth === rule.fromMonth) {
          monthlyDeposit += Number(rule.oneTimeAmount || 0);
        }
      });

      val = val * (1 + r) + monthlyDeposit;
      dep += monthlyDeposit;
    }

    return {
      projVals,
      depVals,
      totalDeposited: depVals[n],
      finalValue: projVals[n]
    };
  }

  // --- Simulation Rule CRUD ---
  addSimulationRule(investmentId: string, rule: Partial<SimulationRule>) {
    return this.http.post<Investment>(`${this.url}/${investmentId}/simulation-rule`, rule).pipe(
      tap(updated => this.patch(updated))
    );
  }

  updateSimulationRule(investmentId: string, ruleId: string, rule: Partial<SimulationRule>) {
    return this.http.put<Investment>(`${this.url}/${investmentId}/simulation-rule/${ruleId}`, rule).pipe(
      tap(updated => this.patch(updated))
    );
  }

  deleteSimulationRule(investmentId: string, ruleId: string) {
    return this.http.delete<Investment>(`${this.url}/${investmentId}/simulation-rule/${ruleId}`).pipe(
      tap(updated => this.patch(updated))
    );
  }
}
