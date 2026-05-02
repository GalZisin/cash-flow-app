export type TransactionType = 'deposit' | 'withdraw';

export interface Transaction {
  date: string;
  amount: number;
  type: TransactionType;
}

export interface Snapshot {
  date: string;
  value: number;
}

export interface Investment {
  id: string;
  name: string;
  type: 'pension' | 'fund' | 'stock' | 'other';
  transactions: Transaction[];
  snapshots: Snapshot[];
}
