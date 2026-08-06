import { Injectable } from '@angular/core';
import gsap from 'gsap';

/**
 * שירות לניהול אנימציות בטבלת תזרים
 */
@Injectable({
    providedIn: 'root'
})
export class CashFlowAnimationService {

    /**
     * אנימציה ליפהורות הטבלה - מופיעות אחת אחרי השניה
     */
    animateTableRows(selector: string = '.mat-mdc-row', delay: number = 100): void {
        setTimeout(() => {
            const rows = document.querySelectorAll(selector);

            if (rows.length > 0) {
                // הגדרת מצב התחלתי
                gsap.set(rows, {
                    opacity: 0,
                    y: 30,
                    scale: 0.95
                });

                // אנימציה מדורגת
                gsap.to(rows, {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.6,
                    ease: 'back.out(1.2)',
                    stagger: {
                        amount: 0.8,
                        from: 'start'
                    }
                });
            }
        }, delay);
    }

    /**
     * אנימציה לשורה בודדת חדשה
     */
    animateNewRow(rowSelector?: HTMLElement, delay: number = 50): void {
        setTimeout(() => {
            const rows = document.querySelectorAll('.mat-mdc-row');
            const targetRow = rowSelector || rows[rows.length - 1];

            if (targetRow) {
                gsap.from(targetRow, {
                    opacity: 0,
                    x: -50,
                    scale: 0.9,
                    duration: 0.6,
                    ease: 'back.out(1.4)',
                    clearProps: 'all'
                });
            }
        }, delay);
    }

    /**
     * אנימציה להופעת דיאלוג
     */
    animateDialogOpen(dialogElement: HTMLElement): void {
        gsap.from(dialogElement, {
            scale: 0.9,
            opacity: 0,
            duration: 0.3,
            ease: 'back.out(1.4)'
        });
    }

    /**
     * אנימציה להעלמת דיאלוג
     */
    animateDialogClose(dialogElement: HTMLElement, onComplete: () => void): void {
        gsap.to(dialogElement, {
            scale: 0.9,
            opacity: 0,
            duration: 0.2,
            ease: 'power2.in',
            onComplete
        });
    }

    /**
     * אנימציה לפתיחת/סגירת רשימה מתרחבת
     */
    animateExpansion(items: NodeListOf<Element> | Element[], isExpanding: boolean): void {
        if (items.length === 0) return;

        if (isExpanding) {
            gsap.from(items, {
                opacity: 0,
                y: -10,
                duration: 0.3,
                stagger: 0.03,
                ease: 'power2.out'
            });
        } else {
            gsap.to(items, {
                opacity: 0,
                y: -10,
                duration: 0.2,
                stagger: 0.02,
                ease: 'power2.in'
            });
        }
    }

    /**
     * אנימציה לכפתור שמירה
     */
    animateSaveButton(buttonElement: HTMLElement): void {
        const tl = gsap.timeline();

        tl.to(buttonElement, {
            scale: 0.95,
            duration: 0.1
        })
            .to(buttonElement, {
                scale: 1.1,
                duration: 0.2
            })
            .to(buttonElement, {
                scale: 1,
                duration: 0.2
            });
    }
}
