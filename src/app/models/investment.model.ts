export type TransactionType = 'deposit' | 'withdraw';

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
}

export interface Snapshot {
  id?: string;
  date: string;
  value: number;
}

export interface Investment {
  id: string;
  name: string;
  type: 'pension' | 'fund' | 'stock' | 'other';
  transactions: Transaction[];
  snapshots: Snapshot[];
  initialValue?: number;
  annualReturn?: number;
  simulationRules?: SimulationRule[];
}
