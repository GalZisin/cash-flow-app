import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder rows shown while the cash flow table loads (styles split out of cash-flow-table). */
@Component({
  selector: 'app-cash-flow-table-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cash-flow-table-skeleton.component.html',
  styleUrl: './cash-flow-table-skeleton.component.scss'
})
export class CashFlowTableSkeletonComponent {
  readonly rows = Array.from({ length: 50 });
}
