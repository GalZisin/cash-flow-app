import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal,
} from '@angular/core';
import { PercentPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { area as d3Area, curveMonotoneX, line as d3Line } from 'd3-shape';
import { FlowBucket, formatMoney, movingAverage, niceTicks } from '../../../utils/cash-flow-chart.util';

export type ChartVariant = 'balance' | 'flows' | 'net';

interface Bar { d: string; cls: string; }

const MARGIN = { top: 22, right: 16, bottom: 28, left: 60 };
const BAR_MAX = 24;
/** רוחב משוער של תווית ציר X, לקביעת כל כמה עמודות מציגים תווית */
const X_LABEL_WIDTH = 52;

/** עמודה עם קצה עגול (4px) בצד הנתון וקצה ישר על קו הבסיס, גם לערכים שליליים. */
export function barPath(x: number, yBase: number, yEnd: number, w: number): string {
  const h = Math.abs(yEnd - yBase);
  if (h < 0.5 || w <= 0) return '';
  const r = Math.min(4, w / 2, h);
  const s = yEnd < yBase ? 1 : -1;
  return `M${x},${yBase}V${yEnd + s * r}Q${x},${yEnd} ${x + r},${yEnd}`
    + `H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd + s * r}V${yBase}Z`;
}

/**
 * גרף SVG אחד לתזרים. variant קובע את הסימנים:
 * balance = שטח וקו של היתרה, flows = עמודות הכנסות מול הוצאות, net = חיסכון נטו חיובי / שלילי.
 * תקופות תחזית מצוירות בקו מקווקו / עמודות שקופות, עם רקע "תחזית" ברקע.
 */
@Component({
  selector: 'app-cash-flow-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, PercentPipe],
  templateUrl: './cash-flow-chart.component.html',
  styleUrl: './cash-flow-chart.component.scss',
})
export class CashFlowChartComponent {
  readonly buckets = input.required<FlowBucket[]>();
  readonly variant = input.required<ChartVariant>();
  /** תוויות קצרות לציר X ותוויות מלאות ל-tooltip, באותו סדר כמו buckets */
  readonly labels = input.required<string[]>();
  readonly longLabels = input.required<string[]>();
  /** אינדקס התקופה של היום (-1 אם מחוץ לטווח) */
  readonly todayIndex = input(-1);
  readonly showAverage = input(true);
  readonly locale = input('he-IL');
  readonly ariaLabel = input('');
  readonly height = input(260);

  readonly width = signal(640);
  readonly hover = signal(-1);
  readonly m = MARGIN;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      const update = () => this.width.set(Math.max(280, Math.floor(el.clientWidth)));
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  readonly plotRight = computed(() => this.width() - MARGIN.right);
  readonly plotBottom = computed(() => this.height() - MARGIN.bottom);
  readonly band = computed(() => (this.plotRight() - MARGIN.left) / Math.max(1, this.buckets().length));

  /** ממוצע נע של הנטו (3 תקופות), לגרף net */
  readonly netAverage = computed(() => movingAverage(this.buckets().map(b => b.net), 3));

  private readonly values = computed<number[]>(() => {
    const b = this.buckets();
    switch (this.variant()) {
      case 'balance': return b.map(x => x.balance);
      case 'flows': return b.flatMap(x => [x.income, x.expenses]);
      default: return b.map(x => x.net);
    }
  });

  readonly ticks = computed(() => {
    const v = this.values();
    if (!v.length) return [0, 1];
    const min = Math.min(0, ...v);
    const max = Math.max(0, ...v);
    return niceTicks(min, max, this.height() < 240 ? 4 : 5);
  });

  private readonly yScale = computed(() => {
    const t = this.ticks();
    const lo = t[0], hi = t[t.length - 1];
    const top = MARGIN.top, bottom = this.plotBottom();
    return (v: number) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
  });

  y(v: number): number { return this.yScale()(v); }
  cx(i: number): number { return MARGIN.left + (i + 0.5) * this.band(); }

  readonly xLabels = computed(() => {
    const labels = this.labels();
    const step = Math.max(1, Math.ceil(X_LABEL_WIDTH / this.band()));
    const last = labels.length - 1;
    return labels
      .map((text, i) => ({ i, text, x: this.cx(i) }))
      .filter(l => (last - l.i) % step === 0);
  });

  /**
   * תחילת אזור התחזית: בגרף היתרה מהנקודה האחרונה של הנתונים (שם מתחיל הקו המקווקו),
   * בגרפי העמודות מתחילת העמודה הראשונה שהיא תחזית.
   */
  readonly projectionX = computed(() => {
    const i = this.buckets().findIndex(b => b.kind === 'projected');
    if (i < 0) return null;
    return this.variant() === 'balance' && i > 0 ? this.cx(i - 1) : MARGIN.left + i * this.band();
  });

  readonly todayX = computed(() => {
    const i = this.todayIndex();
    return i < 0 || i >= this.buckets().length ? null : this.cx(i);
  });

  // ---- balance ----

  private readonly splitIndex = computed(() => {
    const i = this.buckets().findIndex(b => b.kind === 'projected');
    return i < 0 ? this.buckets().length : i;
  });

  private path(kind: 'line' | 'area', from: number, to: number): string {
    const pts = this.buckets().slice(from, to).map((b, k) => [this.cx(from + k), this.y(b.balance)] as [number, number]);
    if (!pts.length) return '';
    if (pts.length === 1) pts.push([pts[0][0] + 0.01, pts[0][1]]);
    if (kind === 'line') return d3Line().curve(curveMonotoneX)(pts) ?? '';
    const base = this.y(Math.max(this.ticks()[0], 0));
    return d3Area().curve(curveMonotoneX).y0(base)(pts) ?? '';
  }

  readonly balancePaths = computed(() => {
    const n = this.buckets().length, s = this.splitIndex();
    return {
      area: this.path('area', 0, s),
      line: this.path('line', 0, s),
      // התחזית מתחילה בנקודה האחרונה של הנתונים כדי שהקו יהיה רציף
      projArea: s < n ? this.path('area', Math.max(0, s - 1), n) : '',
      projLine: s < n ? this.path('line', Math.max(0, s - 1), n) : '',
    };
  });

  readonly endPoint = computed(() => {
    const b = this.buckets();
    if (!b.length) return null;
    const i = b.length - 1;
    return { x: this.cx(i), y: this.y(b[i].balance), value: b[i].balance };
  });

  // ---- bars ----

  readonly bars = computed<Bar[]>(() => {
    const band = this.band();
    const base = this.y(0);
    const bars: Bar[] = [];
    if (this.variant() === 'flows') {
      const w = Math.max(1, Math.min(BAR_MAX, (band * 0.8 - 2) / 2));
      this.buckets().forEach((b, i) => {
        const proj = b.kind === 'projected' ? ' projected' : '';
        const left = this.cx(i) - w - 1;
        bars.push({ d: barPath(left, base, this.y(b.income), w), cls: 'bar income' + proj });
        bars.push({ d: barPath(left + w + 2, base, this.y(b.expenses), w), cls: 'bar expenses' + proj });
      });
    } else if (this.variant() === 'net') {
      const w = Math.max(1, Math.min(BAR_MAX, band * 0.6));
      this.buckets().forEach((b, i) => {
        const proj = b.kind === 'projected' ? ' projected' : '';
        bars.push({ d: barPath(this.cx(i) - w / 2, base, this.y(b.net), w), cls: `bar ${b.net >= 0 ? 'positive' : 'negative'}${proj}` });
      });
    }
    return bars.filter(b => b.d);
  });

  /** קווי ממוצע (תקופות שאינן תחזית) לגרף flows */
  readonly averages = computed(() => {
    const real = this.buckets().filter(b => b.kind !== 'projected');
    if (!real.length || this.variant() !== 'flows') return [];
    const avg = (f: (b: FlowBucket) => number) => real.reduce((s, b) => s + f(b), 0) / real.length;
    const lines = [
      { cls: 'income', value: avg(b => b.income) },
      { cls: 'expenses', value: avg(b => b.expenses) },
    ].map(a => ({ ...a, y: this.y(a.value), labelY: this.y(a.value) - 5 }));
    // תוויות קרובות מדי: התווית של הקו הנמוך יורדת אל מתחת לקו
    const [hi, lo] = [...lines].sort((a, b) => a.y - b.y);
    if (lo.y - hi.y < 14) lo.labelY = lo.y + 13;
    return lines;
  });

  readonly netAveragePath = computed(() => {
    if (this.variant() !== 'net' || this.buckets().length < 2) return '';
    const pts = this.netAverage().map((v, i) => [this.cx(i), this.y(v)] as [number, number]);
    return d3Line().curve(curveMonotoneX)(pts) ?? '';
  });

  // ---- hover ----

  readonly hovered = computed(() => {
    const i = this.hover();
    const b = this.buckets()[i];
    if (!b) return null;
    const x = this.cx(i);
    const alignRight = x > this.width() * 0.6;
    return {
      i, b, x,
      label: this.longLabels()[i] ?? '',
      movingAvg: this.netAverage()[i],
      y: this.variant() === 'balance' ? this.y(b.balance) : null,
      tipLeft: alignRight ? null : x + 12,
      tipRight: alignRight ? this.width() - x + 12 : null,
    };
  });

  onPointerMove(event: PointerEvent): void {
    const svg = (event.currentTarget as SVGElement).ownerSVGElement ?? (event.currentTarget as SVGElement);
    const rect = svg.getBoundingClientRect();
    const i = Math.floor((event.clientX - rect.left - MARGIN.left) / this.band());
    this.hover.set(Math.min(this.buckets().length - 1, Math.max(0, i)));
  }

  onKey(event: KeyboardEvent): void {
    const n = this.buckets().length;
    if (!n) return;
    const current = this.hover() < 0 ? n - 1 : this.hover();
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -n, End: n } as Record<string, number>;
    if (!(event.key in step)) { if (event.key === 'Escape') this.hover.set(-1); return; }
    event.preventDefault();
    this.hover.set(Math.min(n - 1, Math.max(0, current + step[event.key])));
  }

  onFocus(): void {
    if (this.hover() < 0 && this.buckets().length) this.hover.set(this.buckets().length - 1);
  }

  money(v: number | null | undefined): string { return formatMoney(v, this.locale()); }

  /** ₪12.9K / ₪1.2M לציר ולתוויות */
  compact(v: number): string {
    const formatted = new Intl.NumberFormat(this.locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(v));
    return `${v < 0 ? '-' : ''}₪${formatted}`;
  }
}
