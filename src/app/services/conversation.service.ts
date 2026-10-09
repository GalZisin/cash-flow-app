import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toObservable } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
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
  private readonly _items = signal<Conversation[]>([]);
  readonly items = this._items.asReadonly();
  readonly items$ = toObservable(this._items);

  constructor(private http: HttpClient) {}

  load() {
    return this.http.get<Conversation[]>(this.url).pipe(
      tap(data => this._items.set(data))
    );
  }

  create(title: string, messages: ChatMessage[]) {
    return this.http.post<Conversation>(this.url, { title, messages }).pipe(
      tap(c => this._items.update(items => [c, ...items]))
    );
  }

  update(id: string, title: string, messages: ChatMessage[]) {
    return this.http.put<Conversation>(`${this.url}/${id}`, { title, messages }).pipe(
      tap(updated => this._items.update(items => items.map(i => i.id === id ? updated : i)))
    );
  }

  delete(id: string) {
    return this.http.delete(`${this.url}/${id}`).pipe(
      tap(() => this._items.update(items => items.filter(i => i.id !== id)))
    );
  }
}
