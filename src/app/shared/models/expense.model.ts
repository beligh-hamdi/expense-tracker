export interface Expense {
  id: string;           // UUID, generated client-side
  date: string;         // ISO date string: YYYY-MM-DD
  amount: number;       // Positive number
  categoryId: string;   // References Category.id
  description: string;
  receiptUrl?: string;  // Optional — set after OCR/upload (Phase 3)
  createdAt: string;    // ISO timestamp
}

/** Column order in the Expenses sheet tab (0-based index = column letter) */
export const EXPENSE_COLUMNS = [
  'id',           // A
  'date',         // B
  'amount',       // C
  'categoryId',   // D
  'description',  // E
  'receiptUrl',   // F
  'createdAt',    // G
] as const satisfies (keyof Expense)[];

export type ExpenseRow = [
  string, // id
  string, // date
  string, // amount (stored as string in Sheets)
  string, // categoryId
  string, // description
  string, // receiptUrl
  string, // createdAt
];

/** Maps a raw Sheets row array → typed Expense */
export function rowToExpense(row: string[]): Expense {
  return {
    id:          row[0] ?? '',
    date:        row[1] ?? '',
    amount:      parseFloat(row[2]) || 0,
    categoryId:  row[3] ?? '',
    description: row[4] ?? '',
    receiptUrl:  row[5] || undefined,
    createdAt:   row[6] ?? '',
  };
}

/** Maps a typed Expense → raw Sheets row array */
export function expenseToRow(e: Expense): string[] {
  return [
    e.id,
    e.date,
    String(e.amount),
    e.categoryId,
    e.description,
    e.receiptUrl ?? '',
    e.createdAt,
  ];
}
