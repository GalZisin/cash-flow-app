import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { Investment, Snapshot, Transaction } from '../models/investment.model';

const MS_YEAR = 365.25 * 24 * 3600 * 1000;

@Injectable({ providedIn: 'root' })
export class InvestmentService {
  private readonly url = 'http://localhost:3000/api/investments';
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
  addSnapshot(investmentId: string, snapshot: Omit<Snapshot, 'id'>) {
    return this.http
      .post<Investment>(`${this.url}/${investmentId}/snapshot`, snapshot)
      .pipe(tap(updated => this.patch(updated)));
  }

  updateSnapshot(investmentId: string, snapshotId: string, snapshot: Partial<Snapshot>) {
    return this.http
      .put<Investment>(`${this.url}/${investmentId}/snapshot/${snapshotId}`, snapshot)
      .pipe(tap(updated => this.patch(updated)));
  }

  deleteSnapshot(investmentId: string, snapshotId: string) {
    return this.http
      .delete<Investment>(`${this.url}/${investmentId}/snapshot/${snapshotId}`)
      .pipe(tap(updated => this.patch(updated)));
  }

  // --- Transaction CRUD ---
  addTransaction(investmentId: string, tx: Omit<Transaction, 'id'>) {
    return this.http
      .post<Investment>(`${this.url}/${investmentId}/transaction`, tx)
      .pipe(tap(updated => this.patch(updated)));
  }

  updateTransaction(investmentId: string, tx: Transaction) {
    return this.http
      .put<Investment>(`${this.url}/${investmentId}/transaction/${tx.id}`, tx)
      .pipe(tap(updated => this.patch(updated)));
  }

  deleteTransaction(investmentId: string, txId: string) {
    return this.http
      .delete<Investment>(`${this.url}/${investmentId}/transaction/${txId}`)
      .pipe(tap(updated => this.patch(updated)));
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
}
