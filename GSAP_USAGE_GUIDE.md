# 🎬 מדריך שימוש ב-GSAP באפליקציית תזרים המזומנים

## 📦 הספרייה הותקנה!
GSAP הותקן בהצלחה בפרויקט. עכשיו אפשר להשתמש באנימציות מתקדמות.

---

## 🎯 Directives שנוצרו

### 1️⃣ **AnimateNumberDirective** - אנימציית מספרים
מקום: `src/app/directives/animate-number.directive.ts`

**שימוש:**
```html
<!-- אנימציית סכומי כסף -->
<span [appAnimateNumber]="monthCtrl.get('endingBalance')?.value" 
      [duration]="0.8">
</span>

<!-- עם עשרוניות -->
<span [appAnimateNumber]="totalAmount" 
      [decimals]="2" 
      [duration]="1">
</span>
```

**איפה להשתמש:**
- ✅ יתרה סופית (Ending Balance)
- ✅ סך הכנסות
- ✅ סך הוצאות
- ✅ חיסכון

---

### 2️⃣ **StaggerFadeInDirective** - אנימציית כניסה מדורגת
מקום: `src/app/directives/stagger-fade-in.directive.ts`

**שימוש:**
```html
<!-- אנימציה לכל השורות בטבלה -->
<div class="table-container" 
     appStaggerFadeIn 
     [childSelector]="'.mat-mdc-row'" 
     [staggerDelay]="0.05">
  <table mat-table [dataSource]="dataSource">
    <!-- ... -->
  </table>
</div>

<!-- אנימציה לרשימת הוצאות -->
<div appStaggerFadeIn 
     [childSelector]="'.expense-row'" 
     [staggerDelay]="0.03">
  @for (expCtrl of getRegularExpenses(i).controls; track expCtrl; let j = $index) {
    <div class="expense-row">
      <!-- ... -->
    </div>
  }
</div>
```

**איפה להשתמש:**
- ✅ שורות בטבלת תזרים
- ✅ רשימת הוצאות מתרחבת
- ✅ כרטיסים במצב מובייל
- ✅ תפריטים

---

### 3️⃣ **AnimateProgressDirective** - אנימציית Progress Bar
מקום: `src/app/directives/animate-progress.directive.ts`

**שימוש:**
```html
<!-- Mini bars בעמודת הסיכום החזותי -->
<div class="mini-bar income-bar" 
     [appAnimateProgress]="getBarWidth(getTotalIncome(i), i)"
     [duration]="0.8">
</div>

<!-- Progress bar כללי -->
<div class="progress">
  <div class="progress-bar" 
       [appAnimateProgress]="percentageValue"
       [duration]="1.2">
  </div>
</div>
```

**איפה להשתמש:**
- ✅ Mini charts בטבלת תזרים
- ✅ Pie chart segments
- ✅ Progress indicators
- ✅ Loading bars

---

### 4️⃣ **Skeleton Loading** - אפקט טעינה מודרני
מקום: `src/app/components/cash-flow-table/cash-flow-table.component.html/scss`

**מה זה:**
אפקט טעינה יפה עם shimmer animation שמציג placeholder בצורת שורות בזמן שהנתונים נטענים.

**שימוש בטבלת תזרים:**
```html
<!-- בתחילת table-container -->
@if (isLoading) {
  <div class="skeleton-table">
    <div class="skeleton-header"></div>
    @for (i of [1, 2, 3, 4, 5]; track i) {
      <div class="skeleton-row">
        <div class="skeleton-cell skeleton-cell-small"></div>
        <div class="skeleton-cell skeleton-cell-medium"></div>
        <div class="skeleton-cell skeleton-cell-large"></div>
        <!-- ... -->
      </div>
    }
  </div>
}
```

**עיצוב:**
- אפקט shimmer עם gradients מונפשים
- תמיכה ב-dark mode עם glow effects
- התאמה אוטומטית לצבעי הערכה
- אנימציה חלקה מ-skeleton לנתונים אמיתיים

**כיצד זה עובד:**
1. כשהקומפוננטה נטענת, `isLoading = true`
2. מוצג skeleton table עם 5 שורות דמה
3. כשהנתונים נטענים, `isLoading = false`
4. ה-skeleton נעלם והטבלה האמיתית מופיעה עם stagger animation

**איפה להשתמש:**
- ✅ טעינה ראשונית של טבלה
- ✅ רענון נתונים
- ✅ טעינת רשימות
- ✅ כרטיסים במובייל

---

## 💡 דוגמאות נוספות לשימוש מתקדם

### 🎨 אנימציית Cards במובייל
```typescript
// בקובץ cash-flow-cards.component.ts
import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export class CashFlowCardsComponent implements OnInit {
  @ViewChild('cardsContainer') cardsContainer!: ElementRef;

  ngAfterViewInit() {
    const cards = this.cardsContainer.nativeElement.querySelectorAll('.month-card');
    
    gsap.from(cards, {
      scrollTrigger: {
        trigger: this.cardsContainer.nativeElement,
        start: 'top 80%',
      },
      y: 50,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power2.out'
    });
  }
}
```

### 🔄 אנימציית החלפת חודשים
```typescript
// Animation when switching months in Sankey
switchMonth(newMonth: string) {
  const container = this.sankeyContainer.nativeElement;
  
  // Fade out
  gsap.to(container, {
    opacity: 0,
    duration: 0.3,
    onComplete: () => {
      // Update data
      this.selectedMonthControl.setValue(newMonth);
      this.renderSankey();
      
      // Fade in
      gsap.fromTo(container, 
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.2)' }
      );
    }
  });
}
```

### ✨ אנימציית פתיחת Dialog
```typescript
// בקובץ cash-flow-table.component.ts
openDefaultsDialog() {
  this.cashFlowService.loadDefaults().subscribe(defaults => {
    // ... existing code ...
    this.showDefaultsDialog = true;
    
    // Animate dialog entrance
    setTimeout(() => {
      const dialog = document.querySelector('.cf-defaults-card');
      if (dialog) {
        gsap.from(dialog, {
          scale: 0.9,
          opacity: 0,
          duration: 0.3,
          ease: 'back.out(1.4)'
        });
      }
    }, 0);
  });
}
```

---

## 🎭 אנימציות Timeline מורכבות

### דוגמה: אנימציית שמירה עם Feedback
```typescript
save(silent: boolean = false) {
  const saveBtn = document.querySelector('button[color="warn"]');
  
  if (!silent && saveBtn) {
    const tl = gsap.timeline();
    
    tl.to(saveBtn, {
      scale: 0.95,
      duration: 0.1
    })
    .to(saveBtn, {
      scale: 1.1,
      backgroundColor: '#10b981',
      duration: 0.2
    })
    .to(saveBtn, {
      scale: 1,
      duration: 0.2
    });
  }
  
  // ... existing save logic ...
}
```

---

## 📍 איפה מומלץ להוסיף אנימציות:

### ⭐ עדיפות גבוהה (כבר מיושם):
1. ✅ **יתרה סופית** - AnimateNumberDirective
2. ✅ **Mini charts** - AnimateProgressDirective
3. ✅ **שורות טבלה** - StaggerFadeInDirective
4. ✅ **Skeleton Loading** - אפקט טעינה מודרני
5. ✅ **רשימות מתרחבות** - StaggerFadeInDirective (הוצאות/הכנסות)

### 🎯 עדיפות בינונית:
4. **Sankey Diagram** - אנימציית מעבר בין חודשים
5. **Dialogs** - אנימציית כניסה ויציאה
6. **Pie Chart** - אנימציית segments

### 💎 Nice to have:
7. **Scroll animations** - כרטיסים במובייל
8. **Button feedback** - כפתור שמירה
9. **Hover effects** - עם GSAP flip plugin

---

## 🚀 איך להוסיף directive לקומפוננטה:

```typescript
// cash-flow-table.component.ts
import { AnimateNumberDirective } from '../../directives/animate-number.directive';
import { StaggerFadeInDirective } from '../../directives/stagger-fade-in.directive';

@Component({
  selector: 'app-cash-flow-table',
  standalone: true,
  imports: [
    // ... existing imports
    AnimateNumberDirective,
    StaggerFadeInDirective
  ],
  // ...
})
```

---

## 📚 משאבים נוספים:

- [GSAP Docs](https://greensock.com/docs/)
- [GSAP Cheat Sheet](https://greensock.com/cheatsheet/)
- [ScrollTrigger](https://greensock.com/scrolltrigger/)
- [GSAP Easing Visualizer](https://greensock.com/ease-visualizer/)

---

## 🎓 Tips למתקדמים:

1. **Performance** - השתמש ב-`will-change` CSS property לאנימציות מורכבות
2. **Cleanup** - תמיד עשה `kill()` לאנימציות ב-`ngOnDestroy`
3. **Accessibility** - הוסף `prefers-reduced-motion` support
4. **Bundle Size** - import רק את מה שצריך מ-GSAP

```typescript
// ✅ טוב
import { gsap } from 'gsap';

// ❌ לא טוב - מייבא הכל
import * as gsap from 'gsap';
```

---

**נוצר עבור פרויקט cash-flow-app - Angular 21 + GSAP 3**
