import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
// import { InstallmentStatus } from '../../models/installment.model'; // Removed as it's not directly used in the header

@Component({
  selector: 'app-installments-header',
  standalone: true,
  imports: [CommonModule, TranslateModule, MatTooltipModule],
  templateUrl: './installments-header.component.html',
  styleUrl: './installments-header.component.scss'
})
export class InstallmentsHeaderComponent {
  @Input() activeCount: number = 0;
  @Input() totalRemaining: number = 0;
  @Input() totalMonthly: number = 0;
  @Input() itemsCount: number = 0;
  @Input() viewMode: 'grid' | 'table' = 'grid';

  @Output() toggleView = new EventEmitter<void>();
  @Output() openAdd = new EventEmitter<void>();

  constructor() { }
}