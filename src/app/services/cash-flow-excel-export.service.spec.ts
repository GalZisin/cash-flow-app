import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { CashFlowExcelExportService } from './cash-flow-excel-export.service';

describe('CashFlowExcelExportService', () => {
  let service: CashFlowExcelExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
    service = TestBed.inject(CashFlowExcelExportService);
  });

  it('builds an RTL table sheet with row colors, item notes and totals, plus a details sheet', async () => {
    const workbook = await service.buildWorkbook([
      {
        month: new Date(2026, 9, 1),
        rowColor: '#fee2e2',
        startingBalance: 1000,
        income: 5000,
        endingBalance: 4500,
        regularExpenses: [{ description: 'מזון', amount: 1500, category: 'FOOD' }],
      },
    ]);

    const [table, details] = workbook.worksheets;
    expect(workbook.worksheets.length).toBe(2);
    expect(table.views[0].rightToLeft).toBeTrue();

    // שורה 1 כותרת, 2 כותרות עמודות, 3 החודש, 4 סה"כ
    expect(table.rowCount).toBe(4);
    const monthRow = table.getRow(3);
    expect(monthRow.getCell(3).value).toBe(5000);
    expect(monthRow.getCell(8).value).toBe(1500);
    expect(monthRow.getCell(8).note).toBe('מזון: 1,500 ₪');
    expect((monthRow.getCell(1).fill as { fgColor: { argb: string } }).fgColor.argb).toBe('FFFEE2E2');
    expect(table.getRow(4).getCell(11).value).toBe(4500);

    expect(details.rowCount).toBe(3);
    expect(details.getRow(3).getCell(3).value).toBe('מזון');
    expect(details.getRow(3).getCell(5).value).toBe(1500);
  });
});
