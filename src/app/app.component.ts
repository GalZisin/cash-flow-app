import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CashFlowTableComponent } from './components/cash-flow-table/cash-flow-table.component';

@Component({
  selector: 'app-root',
  imports: [
    // RouterOutlet, 
    CashFlowTableComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'cash-flow-app';
}
