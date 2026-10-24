export type TransactionType = 'deposit' | 'withdraw';
export type InvestmentCurrency = 'ILS' | 'USD';

export interface SimulationRule {
  id: string;
  fromMonth: number;
  toMonth: number;
  monthlyAmount: number;
  oneTimeAmount: number;
  description?: string;
}

export interface Transaction {
  id?: string;
  date: string;
  amount: number;
  type: TransactionType;
  currency?: InvestmentCurrency;
  currencyAmount?: number;
  exchangeRate?: number;
}

export interface Snapshot {
  id?: string;
  date: string;
  value: number;
  currency?: InvestmentCurrency;
  currencyAmount?: number;
  exchangeRate?: number;
}

/** השינוי בין צילום לצילום הקודם, מפורק להפקדות ולרווח */
export interface PeriodReturn {
  /** הפקדות פחות משיכות בתקופה */
  deposits: number;
  /** שווי סיום - שווי פתיחה - הפקדות נטו */
  profit: number;
  /** תשואה לתקופה (Modified Dietz), לא שנתית */
  returnPct: number | null;
  /** השינוי הגולמי בשווי, כולל הפקדות */
  valueChange: number;
  valueChangePct: number | null;
}

export interface Investment {
  id: string;
  name: string;
  type: 'pension' | 'fund' | 'stock' | 'other';
  currency?: InvestmentCurrency;
  transactions: Transaction[];
  snapshots: Snapshot[];
  initialValue?: number;
  annualReturn?: number;
  simulationRules?: SimulationRule[];
}

