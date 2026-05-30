import { HttpInterceptorFn } from '@angular/common/http';
import { inject, isDevMode } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, tap, throwError } from 'rxjs';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  if (isDevMode()) {
    console.log(`[HTTP] ${req.method} ${req.url}`, req.body ?? '');
  }

  return next(req).pipe(
    tap(res => { if (isDevMode()) console.log(`[HTTP] Response ${req.url}`, res); }),
    catchError(err => {
      console.error(`[HTTP] Error ${req.url}`, err);
      const message = err?.error?.message ?? err?.message ?? 'שגיאה בתקשורת עם השרת';
      snackBar.open(message, 'סגור', { duration: 4000, panelClass: 'snack-error' });
      return throwError(() => err);
    })
  );
};
