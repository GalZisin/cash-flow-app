import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type AiReport = {
    id?: string;
    createdAt: string;
} & (
        | { type: 'analysis'; content: string }
        | { type: 'insights'; content: string[] }
        | { type: 'scenario'; content: string; scenarioDetails: { description: string, amount: number, date: string } }
    );

@Injectable({ providedIn: 'root' })
export class AiReportService {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/ai-reports`;

    save(report: AiReport) {
        return this.http.post<AiReport>(this.url, report);
    }

    loadAll() {
        return this.http.get<AiReport[]>(this.url);
    }

    delete(id: string) {
        return this.http.delete(`${this.url}/${id}`);
    }
}