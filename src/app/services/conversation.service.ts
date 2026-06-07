import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatMessage } from './ai.service';

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly url = `${environment.apiUrl}/conversations`;
  private _items = new BehaviorSubject<Conversation[]>([]);
  items$ = this._items.asObservable();

  constructor(private http: HttpClient) {}

  load() {
    return this.http.get<Conversation[]>(this.url).pipe(
      tap(data => this._items.next(data))
    );
  }

  create(title: string, messages: ChatMessage[]) {
    return this.http.post<Conversation>(this.url, { title, messages }).pipe(
      tap(c => this._items.next([c, ...this._items.value]))
    );
  }

  update(id: string, title: string, messages: ChatMessage[]) {
    return this.http.put<Conversation>(`${this.url}/${id}`, { title, messages }).pipe(
      tap(updated => this._items.next(this._items.value.map(i => i.id === id ? updated : i)))
    );
  }

  delete(id: string) {
    return this.http.delete(`${this.url}/${id}`).pipe(
      tap(() => this._items.next(this._items.value.filter(i => i.id !== id)))
    );
  }
}
