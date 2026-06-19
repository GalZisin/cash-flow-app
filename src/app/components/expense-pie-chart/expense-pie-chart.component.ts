import {
  Component, Input, OnChanges, SimpleChanges, AfterViewInit,
  ViewChild, ElementRef, HostListener, inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import * as d3 from 'd3';
import { MonthData } from '../../models/cash-flow.model';
import { ThemeService } from '../../services/theme.service';
import { LanguageService } from '../../services/language.service';
import { calculateCategoryPercentages } from '../../utils/expense-analytics.util';
import { getExpenseCategoryConfig } from '../../models/expense-category.model';

@Component({
  selector: 'app-expense-pie-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslateModule, MatIconModule],
  templateUrl: './expense-pie-chart.component.html',
  styleUrl: './expense-pie-chart.component.scss',
})
export class ExpensePieChartComponent implements OnChanges, AfterViewInit {
  @Input() cashFlowMonths: MonthData[] = [];
  @ViewChild('chartContainer') chartContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('tooltip') tooltipEl!: ElementRef<HTMLDivElement>;

  selectedMonth: string | null = null;

  readonly themeService = inject(ThemeService);
  readonly lang = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  @HostListener('window:resize')
  onResize() { this.render(); }

  get monthOptions(): string[] {
    return this.cashFlowMonths.map(m => m.month.substring(0, 7));
  }

  private get activeMonths(): MonthData[] {
    if (this.selectedMonth) {
      const m = this.cashFlowMonths.find(m => m.month.startsWith(this.selectedMonth!));
      return m ? [m] : [];
    }
    return this.cashFlowMonths;
  }

  get slices() {
    return calculateCategoryPercentages(this.activeMonths).map(item => {
      const config = getExpenseCategoryConfig(item.category);
      return {
        ...item,
        color: config.color,
        icon: config.icon,
        labelKey: `CATEGORIES.${item.category}`,
      };
    });
  }

  get total(): number {
    return this.slices.reduce((s, d) => s + d.total, 0);
  }

  ngAfterViewInit() { this.render(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['cashFlowMonths'] && this.chartContainer) this.render();
  }

  onMonthChange() { this.render(); }

  private render() {
    if (!this.chartContainer) return;
    const container = this.chartContainer.nativeElement;
    container.innerHTML = '';

    const data = this.slices;
    if (!data.length) return;

    const isDark = this.themeService.isDarkMode();
    const textColor = isDark ? '#cccccc' : '#334155';

    const size = Math.min(container.clientWidth || 340, 340);
    const radius = size / 2 - 8;
    const innerRadius = radius * 0.58;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', size)
      .attr('height', size);

    const pie = d3.pie<typeof data[0]>().sort(null).value(d => d.total);
    const arc = d3.arc<d3.PieArcDatum<typeof data[0]>>()
      .innerRadius(innerRadius).outerRadius(radius);
    const arcHover = d3.arc<d3.PieArcDatum<typeof data[0]>>()
      .innerRadius(innerRadius).outerRadius(radius + 8);

    const tooltip = d3.select(this.tooltipEl.nativeElement);
    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);
    const total = data.reduce((s, d) => s + d.total, 0);

    g.selectAll('path')
      .data(pie(data))
      .join('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', isDark ? '#1f1f1f' : '#fff')
      .attr('stroke-width', 2.5)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget).transition().duration(150).attr('d', arcHover as any);
        const label = this.translate.instant(d.data.labelKey);
        tooltip.style('opacity', 1).html(
          `<span class="tip-label">${label}</span>
           <span class="tip-amount">₪${d.data.total.toLocaleString()}</span>
           <span class="tip-pct">${d.data.percentage.toFixed(1)}%</span>`
        );
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.clientX + 14) + 'px').style('top', (event.clientY - 36) + 'px');
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).transition().duration(150).attr('d', arc as any);
        tooltip.style('opacity', 0);
      });

    // Center total
    g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.5em')
      .attr('font-size', '11px').attr('fill', isDark ? '#6b7280' : '#94a3b8')
      .text(this.translate.instant('CHART.TOTAL'));
    g.append('text').attr('text-anchor', 'middle').attr('dy', '1em')
      .attr('font-size', '18px').attr('font-weight', '700').attr('fill', textColor)
      .text(`₪${total.toLocaleString()}`);
  }
}
