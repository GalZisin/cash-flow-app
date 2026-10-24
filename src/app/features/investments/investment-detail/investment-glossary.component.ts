import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/** מפתחות המושגים ב-INVESTMENTS.GLOSSARY.ITEMS, לפי סדר ההצגה */
export const GLOSSARY_TERMS = [
  'XIRR', 'XIRR_YEARLY', 'CAGR', 'TOTAL_PROFIT',
  'PERIOD_DEPOSITS', 'PERIOD_PROFIT', 'PERIOD_RETURN', 'VALUE_CHANGE', 'SNAPSHOT',
] as const;

/** מילון מושגים מתקפל: הסבר, נוסחה ודוגמה לכל מדד בטאב ההשקעות */
@Component({
  selector: 'app-investment-glossary',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './investment-glossary.component.html',
  styleUrl: './investment-glossary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvestmentGlossaryComponent {
  readonly terms = GLOSSARY_TERMS;
}
