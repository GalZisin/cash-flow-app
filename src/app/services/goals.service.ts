import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { FinancialGoal, GoalsOverview } from '../models/goal.model';

@Injectable({ providedIn: 'root' })
export class GoalsService {
    private readonly apiUrl = `${environment.apiUrl}/goals`;
    readonly goals = signal<FinancialGoal[]>([]);
    readonly overview = signal<GoalsOverview | null>(null);

    constructor(private http: HttpClient) { }

    load(): Observable<FinancialGoal[]> {
        return this.http.get<FinancialGoal[]>(this.apiUrl).pipe(tap(goals => this.goals.set(goals)));
    }

    loadOverview(): Observable<GoalsOverview> {
        return this.http.get<GoalsOverview>(`${this.apiUrl}/overview`).pipe(tap(value => this.overview.set(value)));
    }

    create(goal: Partial<FinancialGoal>): Observable<FinancialGoal> {
        return this.http.post<FinancialGoal>(this.apiUrl, goal).pipe(
            tap(goal => this.goals.update(goals => [...goals, goal]))
        );
    }

    remove(id: string): Observable<{ success: boolean }> {
        return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`).pipe(
            tap(() => this.goals.update(goals => goals.filter(goal => goal.id !== id)))
        );
    }

    analyze(id: string): Observable<FinancialGoal['analysis']> {
        return this.http.post<FinancialGoal['analysis']>(`${this.apiUrl}/${id}/analyze`, {}).pipe(
            tap(analysis => this.goals.update(goals => goals.map(goal =>
                goal.id === id ? { ...goal, analysis } : goal
            )))
        );
    }
}
