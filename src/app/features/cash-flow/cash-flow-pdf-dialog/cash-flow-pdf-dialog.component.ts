import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { presetRange, ReportOptions, ReportPreset } from '../../../utils/cash-flow-report.util';

export interface ReportMonthOption {
  /** YYYY-MM */
  key: string;
  label: string;
}

const PRESETS: { id: ReportPreset; labelKey: string }[] = [
  { id: 'all', labelKey: 'CASH_FLOW.PDF_PRESET_ALL' },
  { id: 'currentYear', labelKey: 'CASH_FLOW.PDF_PRESET_YEAR' },
  { id: 'last12', labelKey: 'CASH_FLOW.PDF_PRESET_LAST12' },
  { id: 'next12', labelKey: 'CASH_FLOW.PDF_PRESET_NEXT12' },
];

/**
 * דיאלוג ייצוא PDF: בחירת טווח חודשים (מ- / עד), קיצורי טווח, והאם לכלול גרפים ופירוט.
 * לא מדפיס בעצמו: מחזיר את הבחירה להורה (confirmed) שמכין את הדוח ופותח את חלון ההדפסה.
 */
@Component({
  selector: 'app-cash-flow-pdf-dialog',
  imports: [ReactiveFormsModule, TranslateModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './cash-flow-pdf-dialog.component.html',
  styleUrl: './cash-flow-pdf-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashFlowPdfDialogComponent implements OnInit {
  /** חודשי הטבלה, בסדר כרונולוגי */
  readonly months = input.required<ReportMonthOption[]>();
  /** הבחירה הקודמת (נשמרת בין פתיחות) */
  readonly initial = input<ReportOptions | null>(null);

  readonly confirmed = output<ReportOptions>();
  readonly closed = output<void>();

  private readonly fb = inject(FormBuilder);

  readonly presets = PRESETS;
  readonly form = this.fb.nonNullable.group({
    from: '',
    to: '',
    includeCharts: true,
    includeDetails: true,
  });

  private readonly range = signal({ from: '', to: '' });
  readonly invalidRange = computed(() => this.range().from > this.range().to);
  readonly selectedCount = computed(() => {
    const { from, to } = this.range();
    return this.months().filter(m => m.key >= from && m.key <= to).length;
  });
  readonly activePreset = signal<ReportPreset | null>(null);

  ngOnInit(): void {
    const keys = this.months().map(m => m.key);
    const prev = this.initial();
    const valid = prev && keys.includes(prev.from) && keys.includes(prev.to);
    const start = valid ? prev : { ...presetRange('all', keys)!, includeCharts: true, includeDetails: true };
    this.form.setValue({
      from: start.from, to: start.to, includeCharts: start.includeCharts, includeDetails: start.includeDetails,
    });
    this.range.set({ from: start.from, to: start.to });
    this.activePreset.set(valid ? null : 'all');

    this.form.valueChanges.subscribe(v => {
      this.range.set({ from: v.from ?? '', to: v.to ?? '' });
    });
  }

  applyPreset(preset: ReportPreset): void {
    const range = presetRange(preset, this.months().map(m => m.key));
    if (!range) return;
    this.form.patchValue(range);
    this.activePreset.set(preset);
  }

  presetAvailable(preset: ReportPreset): boolean {
    return presetRange(preset, this.months().map(m => m.key)) !== null;
  }

  onRangeEdited(): void {
    this.activePreset.set(null);
  }

  submit(): void {
    if (this.invalidRange() || this.selectedCount() === 0) return;
    this.confirmed.emit(this.form.getRawValue());
  }

  close(): void {
    this.closed.emit();
  }
}
