export interface Snapshot {
  date: string;
  value: number;
  deposit?: number;
}

export interface Investment {
  id: string;
  name: string;
  type: 'pension' | 'fund' | 'stock' | 'other';
  snapshots: Snapshot[];
}
