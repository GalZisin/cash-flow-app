import { HttpInterceptorFn } from '@angular/common/http';
import { inject, isDevMode } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, tap, throwError } from 'rxjs';

/** The server answers errors as { success:false, error:{ name, message, code } }; older/legacy shapes are { error: 'text' }. */
export function extractServerMessage(err: any): string | null {
  const body = err?.error;
  if (body && typeof body === 'object') {
    if (body.error && typeof body.error === 'object' && body.error.message) return String(body.error.message);
    if (typeof body.error === 'string') return body.error;
    if (typeof body.message === 'string') return body.message;
  }
  return typeof err?.message === 'string' ? err.message : null;
}

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  if (isDevMode()) {
    console.log(`[HTTP] ${req.method} ${req.url}`, req.body ?? '');
  }

  return next(req).pipe(
    tap(res => { if (isDevMode()) console.log(`[HTTP] Response ${req.url}`, res); }),
    catchError(err => {
      console.error(`[HTTP] Error ${req.url}`, err);
      const message = extractServerMessage(err) ?? 'שגיאה בתקשורת עם השרת';
      snackBar.open(message, 'סגור', { duration: 4000, panelClass: 'snack-error' });
      return throwError(() => err);
    })
  );
};
