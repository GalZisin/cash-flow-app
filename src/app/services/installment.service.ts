import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Installment, InstallmentStatus } from '../models/installment.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InstallmentService {
    private readonly url = `${environment.apiUrl}/installments`;
    private _items = new BehaviorSubject<Installment[]>([]);
    items$ = this._items.asObservable();

    constructor(private http: HttpClient) { }

    load() {
        return this.http.get<Installment[]>(this.url).pipe(
            tap(data => this._items.next(data))
        );
    }

    add(item: Omit<Installment, 'id'>) {
        return this.http.post<Installment>(this.url, item).pipe(
            tap(created => this._items.next([...this._items.value, created]))
        );
    }

    update(id: string, changes: Partial<Installment>) {
        return this.http.put<Installment>(`${this.url}/${id}`, changes).pipe(
            tap(updated => this._items.next(
                this._items.value.map(i => i.id === id ? updated : i)
            ))
        );
    }

    delete(id: string) {
        return this.http.delete(`${this.url}/${id}`).pipe(
            tap(() => this._items.next(this._items.value.filter(i => i.id !== id)))
        );
    }

    markAsPaid(item: Installment, paymentDate: string): Observable<any> {
        const newCount = (item.manualPaidCount || 0) + 1;
        const status = this.getStatus(item);
        if (newCount > status.totalInstallments) return this.load(); // מניעת חריגה
        return this.update(item.id, {
            manualPaidCount: newCount,
            lastManualPaymentDate: paymentDate // תאריך התשלום שסופק
        });
    }

    /** מחשב את סטטוס הפריסה נכון להיום */
    getStatus(item: Installment): InstallmentStatus {
        const today = new Date();
        const start = new Date(item.startDate);

        // מספר חודשים שעברו מתאריך תחילת התשלומים
        const monthsPassed = Math.max(0,
            (today.getFullYear() - start.getFullYear()) * 12 +
            (today.getMonth() - start.getMonth())
        );

        const amountAfterDown = item.totalAmount - item.downPayment;

        // אם הוגדר מספר תשלומים, נשתמש בו. אחרת נחשב לפי הסכום החודשי.
        const totalInstallments = item.installmentsCount > 0
            ? item.installmentsCount
            : (item.monthlyPayment > 0 ? Math.ceil(amountAfterDown / item.monthlyPayment) : 0);

        const paidInstallments = Math.min(totalInstallments, Math.max(monthsPassed, item.manualPaidCount || 0));
        const paidFromInstallments = paidInstallments * item.monthlyPayment;
        const paidAmount = item.downPayment + paidFromInstallments;
        const remainingAmount = Math.max(0, item.totalAmount - paidAmount);
        const progressPct = item.totalAmount > 0
            ? Math.min(100, Math.round((paidAmount / item.totalAmount) * 100))
            : 0;
        const monthsLeft = Math.max(0, totalInstallments - paidInstallments);
        const isCompleted = remainingAmount === 0;

        // תאריך סיום צפוי
        const endDate = new Date(start);
        endDate.setMonth(endDate.getMonth() + totalInstallments);

        return {
            installment: item,
            paidAmount,
            remainingAmount,
            paidInstallments,
            totalInstallments,
            progressPct,
            endDate: endDate.toISOString().slice(0, 7), // YYYY-MM
            isCompleted,
            monthsLeft
        };
    }

    /** סה"כ תשלום חודשי פעיל מכל הפריסות */
    totalMonthlyActive(items: Installment[]): number {
        return items
            .filter(i => !this.getStatus(i).isCompleted)
            .reduce((sum, i) => sum + i.monthlyPayment, 0);
    }
}
