# 📖 מדריך שימוש - קומפוננטות ושירותים חדשים

## שירותים שנוצרו

### 1. CashFlowAnimationService

שירות לניהול כל האנימציות באפליקציה.

#### שימוש:

```typescript
import { CashFlowAnimationService } from '../../../services/cash-flow-animation.service';

export class MyCashFlowComponent {
  private animationService = inject(CashFlowAnimationService);

  ngAfterViewInit() {
    // אנימציה לשורות הטבלה
    this.animationService.animateTableRows();
  }

  addNewRow() {
    // ... הוספת שורה ...
    
    // אנימציה לשורה החדשה
    this.animationService.animateNewRow();
  }

  openDialog() {
    this.showDialog = true;
    setTimeout(() => {
      const dialog = document.querySelector('.my-dialog');
      if (dialog) {
        this.animationService.animateDialogOpen(dialog as HTMLElement);
      }
    }, 0);
  }
}
```

#### API:

| מתודה | פרמטרים | תיאור |
|-------|----------|-------|
| `animateTableRows()` | `selector?: string, delay?: number` | אנימציה לכל השורות בטבלה |
| `animateNewRow()` | `rowSelector?: HTMLElement, delay?: number` | אנימציה לשורה חדשה |
| `animateDialogOpen()` | `dialogElement: HTMLElement` | אנימציית פתיחת דיאלוג |
| `animateDialogClose()` | `dialogElement: HTMLElement, onComplete: () => void` | אנימציית סגירת דיאלוג |
| `animateExpansion()` | `items: NodeListOf<Element>, isExpanding: boolean` | אנימציה לפתיחה/סגירה של רשימה |
| `animateSaveButton()` | `buttonElement: HTMLElement` | אנימציה לכפתור שמירה |

---

### 2. CashFlowCalculationService

שירות לכל החישובים של תזרים המזומנים.

#### שימוש:

```typescript
import { CashFlowCalculationService } from '../../../services/cash-flow-calculation.service';

export class MyCashFlowComponent {
  private calculationService = inject(CashFlowCalculationService);

  getTotalIncome(monthIndex: number): number {
    const monthControl = this.months.at(monthIndex);
    const additionalIncomesArray = monthControl.get('additionalIncomes') as FormArray;
    
    const additionalSum = this.calculationService
      .calculateAdditionalIncomesSum(additionalIncomesArray);
    
    return this.calculationService.calculateTotalIncome(
      monthControl,
      additionalSum
    );
  }

  getTotalExpenses(monthIndex: number): number {
    const monthControl = this.months.at(monthIndex);
    const regularArray = monthControl.get('regularExpenses') as FormArray;
    const specialArray = monthControl.get('specialExpenses') as FormArray;
    
    const regularSum = this.calculationService.calculateRegularExpensesSum(regularArray);
    const specialSum = this.calculationService.calculateSpecialExpensesSum(specialArray);
    
    return this.calculationService.calculateTotalExpenses(
      monthControl,
      regularSum,
      specialSum
    );
  }
}
```

#### API:

| מתודה | פרמטרים | החזרה | תיאור |
|-------|----------|--------|-------|
| `calculateAdditionalIncomesSum()` | `FormArray` | `number` | סכום הכנסות נוספות |
| `calculateRegularExpensesSum()` | `FormArray` | `number` | סכום הוצאות שוטפות |
| `calculateSpecialExpensesSum()` | `FormArray` | `number` | סכום הוצאות מיוחדות |
| `calculateTotalIncome()` | `monthControl, additionalSum` | `number` | סה"כ הכנסות |
| `calculateTotalExpenses()` | `monthControl, regularSum, specialSum` | `number` | סה"כ הוצאות |
| `calculateSavings()` | `totalIncome, totalExpenses` | `number` | חיסכון |
| `calculateBarWidth()` | `value, maxValue` | `number` | רוחב עמודה בגרף (%) |
| `calculateEndingBalance()` | `startingBalance, totalIncome, totalExpenses` | `number` | יתרה סופית |
| `toMonthString()` | `Date` | `string` | המרה לפורמט חודש |
| `fromMonthString()` | `string` | `Date` | המרה מפורמט חודש |

---

### 3. ExpenseListComponent

קומפוננטה reusable לרשימת הוצאות.

#### שימוש:

```typescript
// בקומפוננטה האב
export class CashFlowTableComponent {
  getRegularExpenses(monthIndex: number): FormArray {
    return this.months.at(monthIndex).get('regularExpenses') as FormArray;
  }

  addRegularExpense(monthIndex: number) {
    this.getRegularExpenses(monthIndex).push(this.createExpenseGroup());
    this.calculateEndingBalances();
  }

  removeRegularExpense(monthIndex: number, expenseIndex: number) {
    this.confirmDeleteExpense(monthIndex, expenseIndex, 'regular');
  }

  calculateEndingBalances() {
    // ... חישובים ...
  }
}
```

```html
<!-- בתבנית HTML -->
<app-expense-list
  [expenses]="getRegularExpenses(i)"
  [showCategorySelector]="true"
  [descriptionPlaceholder]="'תיאור הוצאה'"
  [amountPlaceholder]="'סכום'"
  [addButtonLabel]="'CASH_FLOW.ADD_EXPENSE'"
  (onAdd)="addRegularExpense(i)"
  (onDelete)="removeRegularExpense(i, $event)"
  (onAmountChange)="calculateEndingBalances()">
</app-expense-list>

<!-- לרשימת הכנסות נוספות (ללא בורר קטגוריות) -->
<app-expense-list
  [expenses]="getAdditionalIncomes(i)"
  [showCategorySelector]="false"
  [descriptionPlaceholder]="'תיאור הכנסה'"
  [amountPlaceholder]="'סכום'"
  [addButtonLabel]="'CASH_FLOW.ADD_INCOME'"
  (onAdd)="addAdditionalIncome(i)"
  (onDelete)="removeAdditionalIncome(i, $event)"
  (onAmountChange)="calculateEndingBalances()">
</app-expense-list>
```

#### Inputs:

| Input | Type | Required | Default | תיאור |
|-------|------|----------|---------|--------|
| `expenses` | `FormArray` | ✅ | - | מערך הוצאות/הכנסות |
| `showCategorySelector` | `boolean` | ❌ | `true` | להציג בורר קטגוריות |
| `descriptionPlaceholder` | `string` | ❌ | `'תיאור'` | placeholder לשדה תיאור |
| `amountPlaceholder` | `string` | ❌ | `'סכום'` | placeholder לשדה סכום |
| `addButtonLabel` | `string` | ❌ | `'CASH_FLOW.ADD_EXPENSE'` | טקסט כפתור הוספה |

#### Outputs:

| Output | Type | תיאור |
|--------|------|--------|
| `onAdd` | `EventEmitter<void>` | כפתור הוספה נלחץ |
| `onDelete` | `EventEmitter<number>` | כפתור מחיקה נלחץ (מחזיר index) |
| `onAmountChange` | `EventEmitter<void>` | סכום השתנה |

---

## דוגמאות שימוש מלאות

### דוגמה 1: שימוש ב-AnimationService בקומפוננטת טבלה

```typescript
import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CashFlowAnimationService } from '../../../services/cash-flow-animation.service';

@Component({
  selector: 'app-cash-flow-table',
  // ...
})
export class CashFlowTableComponent implements OnInit, AfterViewInit {
  private animationService = inject(CashFlowAnimationService);
  isLoading = true;

  ngOnInit() {
    this.loadData().subscribe(() => {
      this.isLoading = false;
    });
  }

  ngAfterViewInit() {
    // המתן שהטעינה תסתיים
    if (!this.isLoading) {
      this.animationService.animateTableRows();
    }
  }

  addMonth() {
    // הוספת חודש חדש...
    this.months.push(newMonth);
    this.refreshDataSource();

    // אנימציה לשורה החדשה
    this.animationService.animateNewRow();
  }

  save() {
    const saveBtn = document.querySelector('.save-button');
    if (saveBtn) {
      this.animationService.animateSaveButton(saveBtn as HTMLElement);
    }

    this.cashFlowService.save(this.data).subscribe(() => {
      // ...
    });
  }
}
```

---

### דוגמה 2: שימוש ב-CalculationService + ExpenseList

```typescript
import { Component, inject } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { CashFlowCalculationService } from '../../../services/cash-flow-calculation.service';
import { ExpenseListComponent } from '../expense-list/expense-list.component';

@Component({
  selector: 'app-my-component',
  imports: [ExpenseListComponent],
  template: `
    <div class="month-summary">
      <h3>חודש {{ monthName }}</h3>
      <p>הכנסות: {{ totalIncome | number:'1.0-0' }} ₪</p>
      <p>הוצאות: {{ totalExpenses | number:'1.0-0' }} ₪</p>
      <p>חיסכון: {{ savings | number:'1.0-0' }} ₪</p>
    </div>

    <app-expense-list
      [expenses]="regularExpenses"
      (onAdd)="addExpense()"
      (onDelete)="removeExpense($event)"
      (onAmountChange)="recalculate()">
    </app-expense-list>
  `
})
export class MyComponent {
  private calculationService = inject(CashFlowCalculationService);
  
  monthControl!: FormGroup;
  totalIncome = 0;
  totalExpenses = 0;
  savings = 0;

  get regularExpenses(): FormArray {
    return this.monthControl.get('regularExpenses') as FormArray;
  }

  get specialExpenses(): FormArray {
    return this.monthControl.get('specialExpenses') as FormArray;
  }

  recalculate() {
    const additionalIncomesArray = this.monthControl.get('additionalIncomes') as FormArray;
    const additionalSum = this.calculationService
      .calculateAdditionalIncomesSum(additionalIncomesArray);

    this.totalIncome = this.calculationService.calculateTotalIncome(
      this.monthControl,
      additionalSum
    );

    const regularSum = this.calculationService
      .calculateRegularExpensesSum(this.regularExpenses);
    const specialSum = this.calculationService
      .calculateSpecialExpensesSum(this.specialExpenses);

    this.totalExpenses = this.calculationService.calculateTotalExpenses(
      this.monthControl,
      regularSum,
      specialSum
    );

    this.savings = this.calculationService.calculateSavings(
      this.totalIncome,
      this.totalExpenses
    );
  }

  addExpense() {
    this.regularExpenses.push(this.createExpenseGroup());
    this.recalculate();
  }

  removeExpense(index: number) {
    this.regularExpenses.removeAt(index);
    this.recalculate();
  }
}
```

---

### דוגמה 3: החלפה ב-cash-flow-table קיים

#### לפני:
```html
<!-- cash-flow-table.component.html -->
<div class="no-print">
  @for (expCtrl of getRegularExpenses(i).controls; track expCtrl; let j = $index) {
    <div class="expense-item-block">
      <div class="expense-row">
        <input [formControl]="getExpenseDescription(i, j)" />
        <input type="number" [formControl]="getExpenseAmount(i, j)" />
        <button (click)="removeRegularExpense(i,j)">
          <mat-icon>delete</mat-icon>
        </button>
      </div>
      <app-expense-category-selector
        [selectedCategory]="getExpenseCategory(i, j).value"
        (selectedCategoryChange)="getExpenseCategory(i, j).setValue($event)" />
    </div>
  }
  <button (click)="addRegularExpense(i)">הוסף הוצאה</button>
</div>
```

#### אחרי:
```html
<!-- cash-flow-table.component.html -->
<app-expense-list
  [expenses]="getRegularExpenses(i)"
  [showCategorySelector]="true"
  [addButtonLabel]="'CASH_FLOW.ADD_EXPENSE'"
  (onAdd)="addRegularExpense(i)"
  (onDelete)="removeRegularExpense(i, $event)"
  (onAmountChange)="calculateEndingBalances()">
</app-expense-list>
```

**תוצאה**: 20+ שורות קוד הפכו ל-7 שורות! 🎉

---

## טיפים ושיטות עבודה מומלצות

### 1. Inject שירותים בצורה נכונה
```typescript
// ✅ טוב
private animationService = inject(CashFlowAnimationService);

// ❌ לא טוב
constructor(private animationService: CashFlowAnimationService) {}
```

### 2. השתמש ב-OnPush
```typescript
@Component({
  selector: 'app-my-component',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

### 3. נקה אנימציות ב-ngOnDestroy
```typescript
ngOnDestroy() {
  gsap.killTweensOf('*'); // נקה את כל האנימציות
}
```

### 4. השתמש ב-async pipe
```typescript
// ✅ טוב
data$ = this.service.getData();

// HTML
<div>{{ data$ | async }}</div>

// ❌ לא טוב
ngOnInit() {
  this.service.getData().subscribe(data => {
    this.data = data;
  });
}
```

---

## בעיות נפוצות ופתרונות

### בעיה 1: אנימציות לא עובדות
**פתרון**: ודא שה-DOM מוכן
```typescript
ngAfterViewInit() {
  setTimeout(() => {
    this.animationService.animateTableRows();
  }, 100);
}
```

### בעיה 2: ExpenseListComponent לא מזהה שינויים
**פתרון**: השתמש ב-EventEmitter
```typescript
// בקומפוננטה האב
<app-expense-list (onAmountChange)="calculateEndingBalances()">
```

### בעיה 3: חישובים לא מתעדכנים
**פתרון**: קרא ל-recalculate() אחרי כל שינוי
```typescript
addExpense() {
  this.expenses.push(this.createExpenseGroup());
  this.recalculate(); // חשוב!
}
```

---

**עודכן לאחרונה**: 8 יולי 2026
**גרסה**: 1.0.0
