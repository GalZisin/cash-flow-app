import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContextMeter, QuotaMeter } from './chat-usage';

/** פס מעל שורת הקלט בצ'אט: כמה מההקשר של השיחה נוצל, מכסת ספק ה-AI ואזהרות לפני הגבול. */
@Component({
  selector: 'app-chat-usage-meter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, MatTooltipModule],
  templateUrl: './chat-usage-meter.component.html',
  styleUrl: './chat-usage-meter.component.scss'
})
export class ChatUsageMeterComponent {
  context = input.required<ContextMeter>();
  quota = input<QuotaMeter | null>(null);
  newChat = output<void>();
}
