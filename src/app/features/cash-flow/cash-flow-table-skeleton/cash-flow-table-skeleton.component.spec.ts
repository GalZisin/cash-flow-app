import { TestBed } from '@angular/core/testing';
import { CashFlowTableSkeletonComponent } from './cash-flow-table-skeleton.component';

describe('CashFlowTableSkeletonComponent', () => {
  it('renders the loader with a header and placeholder rows', () => {
    const fixture = TestBed.createComponent(CashFlowTableSkeletonComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[data-testid="cash-flow-table-loader"]')).not.toBeNull();
    expect(el.querySelector('.skeleton-header')).not.toBeNull();
    expect(el.querySelectorAll('.skeleton-row').length).toBe(50);
  });
});
