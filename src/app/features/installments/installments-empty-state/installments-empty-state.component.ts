import { Component, Output, EventEmitter } from '@angular/core';

import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-installments-empty-state',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './installments-empty-state.component.html',
  styleUrl: './installments-empty-state.component.scss'
})
export class InstallmentsEmptyStateComponent {
  @Output() openAdd = new EventEmitter<void>();

  constructor() { }
}