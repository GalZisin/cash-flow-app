import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { Workbook, Worksheet, Row, Fill, Borders } from 'exceljs';
import {
  buildExportDetailRows, buildExportMonthRows, buildExportTotals, exportFileName,
  ExportItem, ExportItemKind, ExportMonthInput, ExportMonthRow,
} from '../utils/cash-flow-export.util';

type ExcelJsModule = typeof import('exceljs');

/** צבעי הקובץ (ARGB). זה קובץ אקסל, לא SCSS, ולכן לא דרך טוקני ה-theme. */
const XL = {
  headerBg: 'FF1E3A8A',
  headerText: 'FFFFFFFF',
  titleText: 'FF1E3A8A',
  border: 'FFD1D5DB',
  totalsBg: 'FFE5E7EB',
};

/** כמו בטבלה: סכומים שלמים עם ₪, שלילי באדום. */
const MONEY_FMT = '#,##0 "₪";[Red]-#,##0 "₪"';

const KIND_LABEL_KEYS: Record<ExportItemKind, string> = {
  additionalIncome: 'CASH_FLOW.ADDITIONAL_INCOMES',
  regular: 'CASH_FLOW.REGULAR_EXPENSES',
  special: 'CASH_FLOW.SPECIAL_EXPENSES',
};

/** עמודות גיליון התזרים, באותו סדר כמו בטבלה (בלי עמודת הפעולות ועם חיסכון במקום הגרף). */
const TABLE_COLUMNS: { key: keyof ExportMonthRow | 'month'; labelKey: string; width: number; items?: ExportItemKind }[] = [
  { key: 'month', labelKey: 'CASH_FLOW.MONTH', width: 16 },
  { key: 'startingBalance', labelKey: 'CASH_FLOW.STARTING_BALANCE', width: 18 },
  { key: 'income', labelKey: 'CASH_FLOW.INCOME', width: 14 },
  { key: 'additionalIncomes', labelKey: 'CASH_FLOW.ADDITIONAL_INCOMES', width: 16, items: 'additionalIncome' },
  { key: 'mortgagePayment', labelKey: 'CASH_FLOW.MORTGAGE', width: 14 },
  { key: 'loanPayment', labelKey: 'CASH_FLOW.LOAN', width: 16 },
  { key: 'installmentsPayment', labelKey: 'CASH_FLOW.INSTALLMENTS_PAYMENT', width: 16 },
  { key: 'regularExpenses', labelKey: 'CASH_FLOW.REGULAR_EXPENSES', width: 16, items: 'regular' },
  { key: 'specialExpenses', labelKey: 'CASH_FLOW.SPECIAL_EXPENSES', width: 16, items: 'special' },
  { key: 'savings', labelKey: 'CASH_FLOW.SAVINGS', width: 14 },
  { key: 'endingBalance', labelKey: 'CASH_FLOW.ENDING_BALANCE', width: 18 },
];

/**
 * ייצוא טבלת התזרים לקובץ xlsx: גיליון "תזרים" שנראה כמו הטבלה (RTL, צבעי שורות,
 * פירוט הפריטים בהערה על התא) וגיליון "פירוט" עם שורה לכל פריט.
 * ExcelJS נטען רק בלחיצה על הכפתור (dynamic import), כדי לא להגדיל את ה-bundle הראשי.
 */
@Injectable({ providedIn: 'root' })
export class CashFlowExcelExportService {
  private translate = inject(TranslateService);

  private readonly monthFormat = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' });
  private readonly moneyFormat = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });

  async exportToFile(months: ExportMonthInput[]): Promise<void> {
    const workbook = await this.buildWorkbook(months);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async buildWorkbook(months: ExportMonthInput[]): Promise<Workbook> {
    const ExcelJS = await this.loadExcelJs();
    const rows = buildExportMonthRows(months);

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    this.addTableSheet(workbook, rows);
    this.addDetailsSheet(workbook, rows);
    return workbook;
  }

  private async loadExcelJs(): Promise<ExcelJsModule> {
    const mod = await import('exceljs');
    return ((mod as unknown as { default?: ExcelJsModule }).default ?? mod) as ExcelJsModule;
  }

  private t(key: string): string {
    return this.translate.instant(key);
  }

  private formatMonth(date: Date): string {
    return this.monthFormat.format(date);
  }

  private addTableSheet(workbook: Workbook, rows: ExportMonthRow[]): void {
    const sheet = workbook.addWorksheet(this.t('CASH_FLOW.EXPORT_SHEET_TABLE'), {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 2, xSplit: 1 }],
    });
    sheet.columns = TABLE_COLUMNS.map(c => ({ key: c.key, width: c.width }));

    this.addTitleRow(sheet, TABLE_COLUMNS.length);
    this.styleHeaderRow(sheet.addRow(TABLE_COLUMNS.map(c => this.t(c.labelKey))));

    rows.forEach(r => {
      const row = sheet.addRow(TABLE_COLUMNS.map(c => c.key === 'month' ? this.formatMonth(r.month) : r[c.key as keyof ExportMonthRow]));
      this.styleBodyRow(row, r.rowColor);
      TABLE_COLUMNS.forEach((c, i) => {
        if (c.items && r.items[c.items].length > 0) {
          row.getCell(i + 1).note = this.itemsNote(r.items[c.items]);
        }
      });
    });

    if (rows.length > 0) {
      const totals = buildExportTotals(rows);
      const totalsRow = sheet.addRow(TABLE_COLUMNS.map(c => {
        if (c.key === 'month') return this.t('CASH_FLOW.EXPORT_TOTAL');
        if (c.key === 'startingBalance') return rows[0].startingBalance;
        if (c.key === 'endingBalance') return rows[rows.length - 1].endingBalance;
        return totals[c.key as keyof typeof totals];
      }));
      this.styleBodyRow(totalsRow, null);
      totalsRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = this.solid(XL.totalsBg);
      });
    }

    sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: TABLE_COLUMNS.length } };
  }

  private addDetailsSheet(workbook: Workbook, rows: ExportMonthRow[]): void {
    const sheet = workbook.addWorksheet(this.t('CASH_FLOW.EXPORT_SHEET_DETAILS'), {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 2 }],
    });
    sheet.columns = [
      { key: 'month', width: 16 },
      { key: 'kind', width: 18 },
      { key: 'description', width: 30 },
      { key: 'category', width: 16 },
      { key: 'amount', width: 14 },
    ];

    this.addTitleRow(sheet, 5);
    this.styleHeaderRow(sheet.addRow([
      this.t('CASH_FLOW.MONTH'),
      this.t('CASH_FLOW.EXPORT_ITEM_TYPE'),
      this.t('CASH_FLOW.DESCRIPTION'),
      this.t('CASH_FLOW.EXPORT_CATEGORY'),
      this.t('CASH_FLOW.AMOUNT'),
    ]));

    buildExportDetailRows(rows).forEach(d => {
      const row = sheet.addRow([
        this.formatMonth(d.month),
        this.t(KIND_LABEL_KEYS[d.kind]),
        d.description,
        d.category ? this.t(`CATEGORIES.${d.category}`) : '',
        d.amount,
      ]);
      this.styleBodyRow(row, d.rowColor);
    });

    sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 5 } };
  }

  private addTitleRow(sheet: Worksheet, columnCount: number): void {
    const row = sheet.addRow([`${this.t('TABS.CASH_FLOW')} - ${new Date().toLocaleDateString('he-IL')}`]);
    sheet.mergeCells(row.number, 1, row.number, columnCount);
    row.height = 26;
    const cell = row.getCell(1);
    cell.font = { bold: true, size: 14, color: { argb: XL.titleText } };
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  }

  private styleHeaderRow(row: Row): void {
    row.height = 22;
    row.eachCell(cell => {
      cell.font = { bold: true, color: { argb: XL.headerText } };
      cell.fill = this.solid(XL.headerBg);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = this.border();
    });
  }

  private styleBodyRow(row: Row, rowColor: string | null): void {
    const fill = rowColor ? this.solid(this.hexToArgb(rowColor)) : null;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.border = this.border();
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (typeof cell.value === 'number') cell.numFmt = MONEY_FMT;
      if (fill) cell.fill = fill;
    });
  }

  /** פירוט הפריטים, כמו ברשימה שנפתחת בטבלה ובהדפסה: "תיאור: סכום ₪" בכל שורה. */
  private itemsNote(items: ExportItem[]): string {
    return items
      .map(i => `${i.description || '-'}: ${this.moneyFormat.format(i.amount)} ₪`)
      .join('\n');
  }

  private solid(argb: string): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  }

  private border(): Partial<Borders> {
    const side = { style: 'thin' as const, color: { argb: XL.border } };
    return { top: side, bottom: side, left: side, right: side };
  }

  private hexToArgb(hex: string): string {
    return `FF${hex.replace('#', '').toUpperCase()}`;
  }
}
