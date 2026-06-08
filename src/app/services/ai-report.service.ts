import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface AiReport {
    id?: string;
    type: 'analysis' | 'insights';
    content: string | string[];
    createdAt: string; // ISO String
}

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
}