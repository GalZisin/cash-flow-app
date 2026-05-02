// export interface Snapshot {
//   date: string;
//   value: number;
//   deposit?: number;
// }

// export interface Investment {
//   id: string;
//   name: string;
//   type: 'pension' | 'fund' | 'stock' | 'other';
//   snapshots: Snapshot[];
// }
// export interface Transaction {
//   date: string;
//   amount: number; // שלילי = הפקדה, חיובי = משיכה
// }

// export interface Investment {
//   id: string;
//   name: string;
//   transactions: Transaction[];
//   snapshots: {
//     date: string;
//     value: number;
//   }[];
// }

export type TransactionType = 'deposit' | 'withdraw';

export interface Transaction {
  id: string;
  date: string;
  amount: number; // deposit = שלילי, withdrawal = חיובי
  type: TransactionType;
}

export interface Snapshot {
  id: string;
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

