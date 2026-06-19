export enum ExpenseCategory {
  FOOD = 'FOOD',
  CAR = 'CAR',
  HOME = 'HOME',
  VACATION = 'VACATION',
  ENTERTAINMENT = 'ENTERTAINMENT',
  GIFTS = 'GIFTS',
  HEALTH = 'HEALTH',
  PROFESSIONAL = 'PROFESSIONAL',
  INVESTMENTS = 'INVESTMENTS',
  EDUCATION = 'EDUCATION',
  SHOPPING = 'SHOPPING',
  OTHER = 'OTHER',
}

export interface ExpenseCategoryConfig {
  id: ExpenseCategory;
  label: string;
  icon: string;
  color: string;
}

export const EXPENSE_CATEGORY_CONFIGS: ExpenseCategoryConfig[] = [
  { id: ExpenseCategory.FOOD, label: 'מזון', icon: 'restaurant', color: '#10B981' },
  { id: ExpenseCategory.CAR, label: 'רכב', icon: 'directions_car', color: '#3B82F6' },
  { id: ExpenseCategory.HOME, label: 'בית', icon: 'home', color: '#8B5CF6' },
  { id: ExpenseCategory.VACATION, label: 'חופשה', icon: 'flight', color: '#F59E0B' },
  { id: ExpenseCategory.ENTERTAINMENT, label: 'בידור', icon: 'local_activity', color: '#EF4444' },
  { id: ExpenseCategory.GIFTS, label: 'מתנות', icon: 'redeem', color: '#EC4899' },
  { id: ExpenseCategory.HEALTH, label: 'בריאות', icon: 'health_and_safety', color: '#14B8A6' },
  { id: ExpenseCategory.PROFESSIONAL, label: 'ייעוץ', icon: 'business_center', color: '#6366F1' },
  { id: ExpenseCategory.INVESTMENTS, label: 'השקעות', icon: 'trending_up', color: '#22C55E' },
  { id: ExpenseCategory.EDUCATION, label: 'חינוך', icon: 'school', color: '#0EA5E9' },
  { id: ExpenseCategory.SHOPPING, label: 'קניות', icon: 'shopping_bag', color: '#F97316' },
  { id: ExpenseCategory.OTHER, label: 'אחר', icon: 'category', color: '#6B7280' },
];

const CATEGORY_CONFIG_MAP = new Map(
  EXPENSE_CATEGORY_CONFIGS.map(config => [config.id, config])
);

export function getExpenseCategoryConfig(category: ExpenseCategory): ExpenseCategoryConfig {
  return CATEGORY_CONFIG_MAP.get(category) ?? CATEGORY_CONFIG_MAP.get(ExpenseCategory.OTHER)!;
}

export function normalizeExpenseCategory(category: unknown): ExpenseCategory {
  if (typeof category === 'string' && Object.values(ExpenseCategory).includes(category as ExpenseCategory)) {
    return category as ExpenseCategory;
  }
  return ExpenseCategory.OTHER;
}
