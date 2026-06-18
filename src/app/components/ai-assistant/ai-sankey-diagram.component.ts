import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms'; // Import ReactiveFormsModule and FormControl

import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, SankeyGraph, SankeyNode, SankeyLink } from 'd3-sankey';
import { MonthData } from '../../models/cash-flow.model'; // Import shared MonthData

// Define types for Sankey nodes and links
interface SankeyNodeData {
  id: string;
  originalId?: string; // To store the original ID if a node is filtered
  name: string; // Display name for the node
}

interface SankeyLinkData {
  source: string; // ID of the source node
  target: string; // ID of the target node
  value: number;  // Value of the flow
  // Add other properties as needed based on your service data structure
}

@Component({
  selector: 'app-ai-sankey-diagram',
  standalone: true,
  imports: [CommonModule, TranslateModule, ReactiveFormsModule], // Add ReactiveFormsModule
  templateUrl: './ai-sankey-diagram.component.html',
  styleUrl: './ai-sankey-diagram.component.scss'
})
export class AiSankeyDiagramComponent implements OnChanges, AfterViewInit {
  @Input() cashFlowMonths: MonthData[] = [];
  @ViewChild('sankeyContainer') sankeyContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('tooltip') tooltipElement!: ElementRef<HTMLDivElement>;

  // מאזין לשינוי גודל מסך כדי לרנדר מחדש את הגרף
  @HostListener('window:resize')
  onResize() {
    if (this.cashFlowMonths.length > 0) {
      this.renderSankey();
    }
  }

  // FormControl לבחירת חודש ספציפי
  selectedMonthControl = new FormControl<string | null>(null);

  // Placeholder for Sankey data (nodes and links)
  sankeyData = signal<{ nodes: SankeyNodeData[], links: SankeyLinkData[] }>({
    nodes: [],
    links: []
  });

  private getAllMonthsAggregatedData(): MonthData | null {
    if (!this.cashFlowMonths || this.cashFlowMonths.length === 0) {
      return null;
    }
    
    const first = this.cashFlowMonths[0];
    const last = this.cashFlowMonths[this.cashFlowMonths.length - 1];

    const totalBaseIncome = this.cashFlowMonths.reduce((sum, m) => sum + (m.income || 0), 0);
    const totalAdditionalIncomesAmount = this.cashFlowMonths.reduce((sum, m) => sum + (m.additionalIncomes?.reduce((s, i) => s + i.amount, 0) || 0), 0);
    const totalIncome = totalBaseIncome + totalAdditionalIncomesAmount;

    const totalMortgage = this.cashFlowMonths.reduce((sum, m) => sum + (m.mortgagePayment || 0), 0);
    const totalLoanPayments = this.cashFlowMonths.reduce((sum, m) => sum + (m.loanPayment || 0), 0);
    const totalInstallments = this.cashFlowMonths.reduce((sum, m) => sum + (m.installmentsPayment || 0), 0);
    const totalRegularExpensesAmount = this.cashFlowMonths.reduce((sum, m) => sum + (m.regularExpenses?.reduce((s, e) => s + e.amount, 0) || 0), 0);
    const totalSpecialExpensesAmount = this.cashFlowMonths.reduce((sum, m) => sum + (m.specialExpenses?.reduce((s, e) => s + e.amount, 0) || 0), 0);
    const totalSavings = this.cashFlowMonths.reduce((sum, m) => sum + (m.savings || 0), 0);

    return {
      month: this.cashFlowMonths.length > 1 
        ? `${first.month.substring(0, 7)} - ${last.month.substring(0, 7)}` 
        : first.month.substring(0, 7),
      startingBalance: first.startingBalance,
      income: totalIncome, // This is the sum of base income + additional incomes
      mortgagePayment: totalMortgage,
      loanPayment: totalLoanPayments,
      installmentsPayment: totalInstallments,
      additionalIncomes: [{ description: 'סה"כ הכנסות נוספות', amount: totalAdditionalIncomesAmount }],
      regularExpenses: [{ description: 'סה"כ הוצאות שוטפות', amount: totalRegularExpensesAmount }],
      specialExpenses: [{ description: 'סה"כ הוצאות מיוחדות', amount: totalSpecialExpensesAmount }],
      endingBalance: last.endingBalance,
      savings: this.cashFlowMonths.reduce((sum, m) => sum + (m.savings || 0), 0)
    } as MonthData;
  }

  private getCurrentViewData(): MonthData | null {
    const selectedMonth = this.selectedMonthControl.value;
    if (selectedMonth) {
      // Find the specific month data
      const monthData = this.cashFlowMonths.find(m => m.month.substring(0, 7) === selectedMonth);
      if (monthData) {
        // Return a full MonthData object for the selected month
        return {
          ...monthData,
          month: selectedMonth, // Ensure month format is YYYY-MM
          // Ensure all detailed fields are present, even if optional in the model
          mortgagePayment: monthData.mortgagePayment || 0,
          loanPayment: monthData.loanPayment || 0,
          installmentsPayment: monthData.installmentsPayment || 0,
          additionalIncomes: monthData.additionalIncomes || [],
          regularExpenses: monthData.regularExpenses || [],
          specialExpenses: monthData.specialExpenses || [],
          savings: monthData.savings || 0,
        } as MonthData;
      }
    }
    // Default to aggregated data if no specific month is selected or found
    return this.getAllMonthsAggregatedData();
  }

  constructor(private translate: TranslateService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cashFlowMonths'] && this.cashFlowMonths) {
      this.processCashFlowData();
      if (this.sankeyContainer) {
        this.renderSankey();
      }
    }
  }

  updateChart() {
    this.processCashFlowData();
    if (this.sankeyContainer) {
      this.renderSankey();
    }
  }

  showAllMonths() {
    this.selectedMonthControl.setValue(null);
    this.updateChart();
  }

  ngAfterViewInit(): void {
    // Ensure rendering happens after the view is initialized and data is processed
    if (this.cashFlowMonths && this.cashFlowMonths.length > 0 && this.sankeyData().nodes.length > 0) {
      if (this.sankeyContainer) {
        this.renderSankey();
      }
    }
  }

  private processCashFlowData(): void {
    const data = this.getCurrentViewData();
    if (!data) {
      this.sankeyData.set({ nodes: [], links: [] });
      return;
    }

    const totalIncome = data.income || 0; // This now includes base income + additional incomes
    const totalMortgage = data.mortgagePayment || 0;
    const totalLoanPayments = data.loanPayment || 0; // Manual loan payment
    const totalInstallments = data.installmentsPayment || 0; // Calculated installments
    const totalRegularExpenses = data.regularExpenses?.reduce((s, e) => s + e.amount, 0) || 0; // Sum of regular expenses
    const totalSpecialExpenses = data.specialExpenses?.reduce((s, e) => s + e.amount, 0) || 0; // Sum of special expenses
    const totalSavings = data.savings || 0;
    const currentEndingBalance = data.endingBalance;
    
    // Define nodes
    const nodes: SankeyNodeData[] = [
      { id: 'startingBalance', name: 'יתרה התחלתית' },
      { id: 'income', name: 'הכנסות' },
      { id: 'totalAvailable', name: 'סה"כ זמין' }, // Intermediate node for total money available
      { id: 'mortgage', name: 'משכנתא' },
      { id: 'loanPayments', name: 'החזרי הלוואות' },
      { id: 'installmentsPayment', name: 'תשלומי פריסות' },
      { id: 'regularExpenses', name: 'הוצאות שוטפות' },
      { id: 'specialExpenses', name: 'הוצאות מיוחדות' },
      { id: 'savings', name: 'חיסכון' },
      { id: 'endingBalance', name: 'יתרה בסוף חודש' },
    ];
    
    // Add a node for 'totalExpenses' to group all expense categories
    // This helps in balancing the Sankey if totalAvailable is directly linked to totalExpenses
    // nodes.push({ id: 'totalExpenses', name: 'סה"כ הוצאות' });

    // Define links
    const links: SankeyLinkData[] = [];

    // Flow from Starting Balance to Total Available
    if (data.startingBalance > 0) {
      links.push({ source: 'startingBalance', target: 'totalAvailable', value: Math.max(0, data.startingBalance) });
    }

    // Flow from Income to Total Available
    if (totalIncome > 0) {
      links.push({ source: 'income', target: 'totalAvailable', value: Math.max(0, totalIncome) });
    }

    // Flow from Total Available to various expense categories and then to a conceptual 'totalExpenses' node
    // Or directly from totalAvailable to each expense category
    // For simplicity and to avoid too many nodes, let's link directly from totalAvailable to each expense category
    if (totalMortgage > 0) {
      links.push({ source: 'totalAvailable', target: 'mortgage', value: Math.max(0, totalMortgage) });
    }
    if (totalLoanPayments > 0) {
      links.push({ source: 'totalAvailable', target: 'loanPayments', value: Math.max(0, totalLoanPayments) });
    }
    if (totalInstallments > 0) { // This is the sum of all installment payments for the period
      links.push({ source: 'totalAvailable', target: 'installmentsPayment', value: Math.max(0, totalInstallments) });
    }
    if (totalRegularExpenses > 0) {
      links.push({ source: 'totalAvailable', target: 'regularExpenses', value: Math.max(0, totalRegularExpenses) });
    }
    if (totalSpecialExpenses > 0) {
      links.push({ source: 'totalAvailable', target: 'specialExpenses', value: Math.max(0, totalSpecialExpenses) });
    }
    
    // Flow from Total Available to Savings and Ending Balance
    if (totalSavings > 0) {
      links.push({ source: 'totalAvailable', target: 'savings', value: Math.max(0, totalSavings) });
    }
    if (currentEndingBalance > 0) {
      links.push({ source: 'totalAvailable', target: 'endingBalance', value: Math.max(0, currentEndingBalance) });
    }

    // If totalAvailable has no outgoing links (e.g., all values are zero),
    // ensure it's not filtered out if it has incoming links.
    // This is a common issue with Sankey where nodes with no flow are removed.
    // If totalAvailable has incoming links but no outgoing, it means all money is "lost" or not accounted for.
    // For a balanced diagram, the sum of outgoing links from 'totalAvailable' should equal the sum of incoming links.
    const sumOutgoingFromTotalAvailable = links.filter(l => l.source === 'totalAvailable').reduce((sum, l) => sum + l.value, 0);
    const sumIncomingToTotalAvailable = links.filter(l => l.target === 'totalAvailable').reduce((sum, l) => sum + l.value, 0);
    if (sumIncomingToTotalAvailable > sumOutgoingFromTotalAvailable) {
      // This indicates a discrepancy, potentially some money is not flowing out correctly.
      // For now, we'll just log it, but in a real app, you might add a 'unaccounted' node.
      console.warn(`Sankey: Discrepancy in totalAvailable node. Incoming: ${sumIncomingToTotalAvailable}, Outgoing: ${sumOutgoingFromTotalAvailable}`);
    }
    const activeNodeIds = new Set<string>();
    links.forEach(link => {
      activeNodeIds.add(link.source);
      activeNodeIds.add(link.target);
    });
    const filteredNodes = nodes.filter(node => activeNodeIds.has(node.id));

    this.sankeyData.set({ nodes: filteredNodes, links });
  }

  private renderSankey(): void {
    console.log('Rendering Sankey diagram with data:', this.sankeyData());
    const container = this.sankeyContainer.nativeElement;
    container.innerHTML = ''; // Clear previous SVG

    const width = container.clientWidth;
    const height = 500; // Fixed height, can be dynamic

    // Fetch colors from CSS variables for theme compatibility
    const style = getComputedStyle(container);
    const incomeColor = style.getPropertyValue('--sankey-income-color').trim() || '#4CAF50';
    const startingBalanceColor = style.getPropertyValue('--sankey-starting-balance-color').trim() || '#607D8B';
    const savingsColor = style.getPropertyValue('--sankey-savings-color').trim() || '#2196F3';
    const endingBalanceColor = style.getPropertyValue('--sankey-ending-balance-color').trim() || '#9C27B0';

    const mortgageColor = style.getPropertyValue('--sankey-mortgage-color').trim() || '#F44336';
    const loanColor = style.getPropertyValue('--sankey-loan-color').trim() || '#FF9800';
    const installmentsColor = style.getPropertyValue('--sankey-installments-color').trim() || '#FFC107';
    const regularExpensesColor = style.getPropertyValue('--sankey-regular-expenses-color').trim() || '#E91E63';
    const specialExpensesColor = style.getPropertyValue('--sankey-special-expenses-color').trim() || '#673AB7';
    const defaultExpenseColor = style.getPropertyValue('--sankey-default-expense-color').trim() || '#EF5350';

    const linkStrokeColor = style.getPropertyValue('--sankey-link-stroke-color').trim() || '#BDBDBD';
    const nodeStrokeColor = style.getPropertyValue('--sankey-node-stroke-color').trim() || '#757575';

    const monthStr = this.getCurrentViewData()?.month || ''; // Use currentViewData for month string
    const svg = d3.select(container).append('svg')
      .attr('width', width)
      .attr('height', height);

    const defs = svg.append('defs');
    const tooltip = d3.select(this.tooltipElement.nativeElement);

    // Helper to get node color
    const getNodeColor = (id: string) => {
      if (id === 'income' || id === 'startingBalance') return incomeColor;
      if (id === 'savings' || id === 'endingBalance') return savingsColor;
      if (id === 'mortgage') return mortgageColor;
      if (id === 'loanPayments') return loanColor;
      if (id === 'installmentsPayment') return installmentsColor;
      if (id === 'regularExpenses') return regularExpensesColor;
      if (id === 'specialExpenses') return specialExpensesColor;
      return defaultExpenseColor;
    };

    // Helper functions for custom tooltip
    const showTooltip = (event: MouseEvent, content: string) => {
      tooltip.style('opacity', 1).html(content);
      moveTooltip(event);
    };

    const moveTooltip = (event: MouseEvent) => {
      tooltip
        .style('left', (event.clientX + 15) + 'px')
        .style('top', (event.clientY - 20) + 'px');
    };

    const hideTooltip = () => tooltip.style('opacity', 0);

    const g = svg.append('g');

    const { nodes, links } = this.sankeyData();

    // Create a Sankey generator
    const sankeyGenerator = sankey<SankeyNodeData, SankeyLinkData>()
      .nodeId((d: SankeyNode<SankeyNodeData, SankeyLinkData>) => d.id)
      .nodeWidth(25) // הגדלת עובי העמודות (הצמתים) לנראות טובה יותר
      .nodePadding(10)
      // הקטנת השוליים האופקיים (extent) כדי שהגרף יתפרס על שטח רחב יותר
      // ויותיר פחות רווח בין העמודות לטקסטים
      .extent([[60, 10], [width - 60, height - 20]]);

    const textPadding = 6; // רווח בין העמודה לטקסט

    // Compute the Sankey layout. Use explicit types for graph.nodes and graph.links
    const graph: SankeyGraph<SankeyNodeData, SankeyLinkData> = sankeyGenerator({
      nodes: nodes.map(d => ({ ...d })), // Create copies to avoid modifying original data
      links: links.map(d => ({ ...d }))
    });

    // Create gradients for links
    graph.links.forEach((link: any, i) => { // Use 'any' here for simplicity, or cast inside
      const sourceNode = link.source as SankeyNode<SankeyNodeData, SankeyLinkData>;
      const targetNode = link.target as SankeyNode<SankeyNodeData, SankeyLinkData>;

      const gradientId = `link-grad-${i}`;
      const grad = defs.append('linearGradient')
        .attr('id', gradientId)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', sourceNode.x1 || 0)
        .attr('x2', targetNode.x0 || 0);

      grad.append('stop').attr('offset', '0%').attr('stop-color', getNodeColor(sourceNode.id));
      grad.append('stop').attr('offset', '100%').attr('stop-color', getNodeColor(targetNode.id));
    });

    // Draw links
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.3)
      .selectAll<SVGPathElement, SankeyLink<SankeyNodeData, SankeyLinkData>>('path') // Explicit type for selection
      .data(graph.links as Array<SankeyLink<SankeyNodeData, SankeyLinkData>>) // Cast to expected type
      .join('path')
      .attr('class', 'sankey-link')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke-width', (d: SankeyLink<SankeyNodeData, SankeyLinkData>) => Math.max(1, d.width || 0))
      .attr('stroke', (d: any, i) => `url(#link-grad-${i})`)
      .on('mouseover', (event, d: any) => {
        const source = d.source as SankeyNode<SankeyNodeData, SankeyLinkData>;
        const target = d.target as SankeyNode<SankeyNodeData, SankeyLinkData>;
        const content = `
          <div class="fw-bold mb-1">${source.name} <i class="bi bi-arrow-left small"></i> ${target.name}</div>
          <div class="text-primary fw-bold">₪${d.value?.toLocaleString()}</div>
          <div class="text-muted small">${monthStr}</div>
        `;
        showTooltip(event, content);
        d3.select(event.currentTarget).style('stroke-opacity', 0.6);
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', (event) => {
        hideTooltip();
        d3.select(event.currentTarget).style('stroke-opacity', 0.3);
      });

    // Draw nodes
    g.append('g')
      .attr('class', 'sankey-nodes-group')
      .selectAll<SVGRectElement, SankeyNode<SankeyNodeData, SankeyLinkData>>('rect') // Explicit type for selection
      .data(graph.nodes as Array<SankeyNode<SankeyNodeData, SankeyLinkData>>) // Cast to expected type
      .join('rect')
      .attr('class', 'sankey-node')
      .attr('x', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => d.x0 || 0)
      .attr('y', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => d.y0 || 0)
      .attr('height', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => (d.y1 || 0) - (d.y0 || 0))
      .attr('width', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => (d.x1 || 0) - (d.x0 || 0))
      .attr('rx', 3)
      .attr('fill', (d: any) => getNodeColor(d.id))
      .on('mouseover', (event, d: any) => {
        const content = `
          <div class="fw-bold">${d.name}</div>
          <div class="text-primary fw-bold">₪${(d.value || 0).toLocaleString()}</div>
          <div class="text-muted small">${monthStr}</div>
        `;
        showTooltip(event, content);
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', hideTooltip);

    // הוספת קווי קישור (Connectors) בין העמודות לטקסט בצדדים
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke', 'var(--bs-secondary-color)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.5)
      .selectAll('line')
      .data(graph.nodes as Array<SankeyNode<SankeyNodeData, SankeyLinkData>>)
      .join('line')
      .attr('x1', d => (d.x0 || 0) < width / 2 ? (d.x1 || 0) + 10 : (d.x0 || 0) - 10) // קצה העמודה + רווח קטן
      .attr('y1', d => ((d.y1 || 0) + (d.y0 || 0)) / 2)
      .attr('x2', d => (d.x0 || 0) < width / 2 ? (d.x1 || 0) + textPadding : (d.x0 || 0) - textPadding) // מיקום הטקסט
      .attr('y2', d => ((d.y1 || 0) + (d.y0 || 0)) / 2);

    // הוספת תוויות טקסט בצדדי הגרף
    g.append('g')
      .attr('font-family', 'sans-serif')
      .attr('font-size', 13)
      .selectAll<SVGTextElement, SankeyNode<SankeyNodeData, SankeyLinkData>>('text') // Explicit type for selection
      .data(graph.nodes as Array<SankeyNode<SankeyNodeData, SankeyLinkData>>) // Cast to expected type
      .join('text')
      // מיקום הטקסט: צמוד לקצה העמודה עם רווח קטן
      .attr('x', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => (d.x0 || 0) < width / 2 ? (d.x1 || 0) + textPadding : (d.x0 || 0) - textPadding)
      .attr('y', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => ((d.y1 || 0) + (d.y0 || 0)) / 2)
      .attr('dy', '0.35em')
      // הצמדה לשמאל עבור צד שמאל, הצמדה לימין עבור צד ימין
      .attr('text-anchor', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => (d.x0 || 0) < width / 2 ? 'end' : 'start')
      .text((d: SankeyNode<SankeyNodeData, SankeyLinkData>) => d.name)
      .append('title')
      .text((d: SankeyNode<SankeyNodeData, SankeyLinkData>) => `${d.name} (${monthStr})\n${(d.value || 0).toLocaleString()} ₪`);
  }
}