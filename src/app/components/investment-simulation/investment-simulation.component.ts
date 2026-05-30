import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { InvestmentService } from '../../services/investment.service';

const W = 720, H = 320, PAD = { top: 12, right: 16, bottom: 32, left: 64 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

@Component({
  selector: 'app-investment-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatTooltipModule],
  templateUrl: './investment-simulation.component.html',
  styleUrl: './investment-simulation.component.scss',

})
export class InvestmentSimulationComponent implements OnInit {
  initial = 10000;
  monthly = 500;
  annualRate = 7;
  years = 10;
  result: number | null = null;
  totalDeposited = 0;

  readonly W = W; readonly H = H; readonly PAD = PAD; readonly CW = CW; readonly CH = CH;

  projLinePoints = '';
  depLinePoints = '';
  projAreaPath = '';
  depAreaPath = '';
  yTicks: { y: number; label: string }[] = [];
  yearPoints: { year: number; x: number; projY: number; projVal: number }[] = [];

  constructor(private svc: InvestmentService) { }

  ngOnInit() {
    this.calculate();
  }

  calculate() {
    const n = this.years * 12;

    // יצירת "חוק" זמני עבור הסימולטור הפשוט (הפקדה קבועה לאורך כל התקופה)
    const defaultRule = [{
      id: 'default',
      fromMonth: 1,
      toMonth: n,
      monthlyAmount: this.monthly,
      oneTimeAmount: 0
    }];

    const { projVals, depVals, totalDeposited, finalValue } =
      this.svc.calculateSimulation(this.initial, this.annualRate, this.years, defaultRule);

    this.result = finalValue;
    this.totalDeposited = totalDeposited;

    const allVals = [...projVals, ...depVals];
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;

    const toX = (m: number) => (m / n) * CW;
    const toY = (v: number) => CH - ((v - minV) / range) * CH;

    this.projLinePoints = projVals.map((v, m) => `${toX(m)},${toY(v)}`).join(' ');
    this.depLinePoints = depVals.map((v, m) => `${toX(m)},${toY(v)}`).join(' ');

    this.projAreaPath = `M${toX(0)},${CH} ` + projVals.map((v, m) => `L${toX(m)},${toY(v)}`).join(' ') + ` L${toX(n)},${CH} Z`;
    this.depAreaPath = `M${toX(0)},${CH} ` + depVals.map((v, m) => `L${toX(m)},${toY(v)}`).join(' ') + ` L${toX(n)},${CH} Z`;

    // Y ticks
    this.yTicks = [0, 1, 2, 3, 4].map(i => {
      const v = minV + (range / 4) * i;
      return { y: toY(v), label: this.formatK(v) };
    });

    // Yearly dots
    this.yearPoints = Array.from({ length: this.years + 1 }, (_, yr) => {
      const m = yr * 12;
      return { year: yr, x: toX(m), projY: toY(projVals[m]), projVal: projVals[m] };
    });
  }

  private formatK(v: number): string {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
    return v.toFixed(0);
  }
}
