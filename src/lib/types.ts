export type EntityType = 'PHYSICAL' | 'LEGAL';
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    type: TransactionType;
    entity: EntityType;
    category: string;
    date: string;
}

export interface PurchaseSimItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

export interface FinancialSummary {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    physicalBalance: number;
    legalBalance: number;
}

export const ENTITY_TYPES: readonly EntityType[] = ['PHYSICAL', 'LEGAL'];
export const TRANSACTION_TYPES: readonly TransactionType[] = [
    'INCOME',
    'EXPENSE',
];