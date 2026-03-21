import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CashFlowService {
  private apiUrl = 'http://localhost:3000/api/cash-flow';

  constructor(private http: HttpClient) {}

  load(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  save(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }
}
