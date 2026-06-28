import { Service, signal, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import {
  Expense, rowToExpense, expenseToRow, EXPENSE_COLUMNS,
} from '@shared/models/expense.model';
import {
  Category, rowToCategory, categoryToRow, CATEGORY_COLUMNS,
  DEFAULT_CATEGORIES,
} from '@shared/models/category.model';
import { resolveMatToken } from '@shared/utils/mat-colors.util';
import { slugify } from '@shared/utils/crypto.util';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';

const TAB = {
  expenses:   'Expenses',
  categories: 'Categories',
  settings:   'Settings',
} as const;

const STORAGE_KEY = 'et_local_file_name';

export interface LocalData {
  expenses:   Expense[];
  categories: Category[];
  settings:   Map<string, string>;
}

@Service()
export class LocalFileService {
  private readonly sheetConfig = inject(SheetConfigService);

  // ── State ─────────────────────────────────────────────────────────────────

  private readonly _fileName    = signal<string | null>(localStorage.getItem(STORAGE_KEY));
  private readonly _expenses    = signal<Expense[]>([]);
  private readonly _categories  = signal<Category[]>([]);
  private readonly _settings    = new Map<string, string>();

  readonly fileName   = this._fileName.asReadonly();
  readonly expenses   = this._expenses.asReadonly();
  readonly categories = this._categories.asReadonly();

  // ── Upload ────────────────────────────────────────────────────────────────

  /**
   * Parse an uploaded .xlsx or .csv File and load its data into memory.
   * Returns the parsed data so callers can react immediately.
   */
  async load(file: File): Promise<LocalData> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    const expenses   = this.readTab<Expense>(workbook,   TAB.expenses,   rowToExpense);
    const categories = this.readTab<Category>(workbook,  TAB.categories, rowToCategory);
    const settings   = this.readSettings(workbook);

    this._expenses.set(expenses.sort((a, b) => b.date.localeCompare(a.date)));
    this._categories.set(categories);
    this._settings.clear();
    settings.forEach((v, k) => this._settings.set(k, v));
    this._fileName.set(file.name);
    localStorage.setItem(STORAGE_KEY, file.name);
    this.sheetConfig.setLocalFileLoaded(true);

    return { expenses, categories, settings };
  }

  // ── In-memory CRUD ────────────────────────────────────────────────────────

  addExpense(e: Expense): void {
    this._expenses.update((list) => [e, ...list]);
  }

  updateExpense(updated: Expense): void {
    this._expenses.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
  }

  deleteExpense(id: string): void {
    this._expenses.update((list) => list.filter((e) => e.id !== id));
  }

  addCategory(c: Category): void {
    this._categories.update((list) => [...list, c]);
  }

  updateCategory(updated: Category): void {
    this._categories.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
  }

  deleteCategory(id: string): void {
    this._categories.update((list) => list.filter((c) => c.id !== id));
  }

  getSetting(key: string): string | null {
    return this._settings.get(key) ?? null;
  }

  setSetting(key: string, value: string): void {
    this._settings.set(key, value);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Serialises the current in-memory state back to an .xlsx file and
   * triggers a browser download.
   */
  export(fileName = 'expense-tracker.xlsx'): void {
    const wb = XLSX.utils.book_new();

    // Expenses tab
    const expRows = [
      [...EXPENSE_COLUMNS],
      ...this._expenses().map(expenseToRow),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), TAB.expenses);

    // Categories tab
    const catRows = [
      [...CATEGORY_COLUMNS],
      ...this._categories().map(categoryToRow),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catRows), TAB.categories);

    // Settings tab
    const settingsRows: string[][] = [['key', 'value']];
    this._settings.forEach((v, k) => settingsRows.push([k, v]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(settingsRows), TAB.settings);

    XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : fileName + '.xlsx');
  }

  // ── Template download ─────────────────────────────────────────────────────

  /**
   * Generates and downloads a blank template .xlsx file pre-populated with
   * headers and the 7 default categories.
   */
  downloadTemplate(): void {
    const wb = XLSX.utils.book_new();

    // Expenses — header only
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([[...EXPENSE_COLUMNS]]),
      TAB.expenses,
    );

    // Categories — header + default categories
    const catRows: string[][] = [[...CATEGORY_COLUMNS]];
    for (const c of DEFAULT_CATEGORIES) {
      const color = resolveMatToken(c.colorToken) || '#607d8b';
      catRows.push(categoryToRow({
        id:          slugify(c.name),
        name:        c.name,
        color,
        budgetLimit: 0,
        icon:        c.icon,
      }));
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catRows), TAB.categories);

    // Settings — header only
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['key', 'value']]),
      TAB.settings,
    );

    XLSX.writeFile(wb, 'expense-tracker-template.xlsx');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  clearFile(): void {
    this._expenses.set([]);
    this._categories.set([]);
    this._settings.clear();
    this._fileName.set(null);
    localStorage.removeItem(STORAGE_KEY);
    this.sheetConfig.setLocalFileLoaded(false);
  }

  private readTab<T>(
    wb: XLSX.WorkBook,
    tabName: string,
    mapper: (row: string[]) => T,
  ): T[] {
    const ws = wb.Sheets[tabName];
    if (!ws) return [];
    const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    return rows.slice(1).filter((r) => r[0]).map(mapper);
  }

  private readSettings(wb: XLSX.WorkBook): Map<string, string> {
    const map = new Map<string, string>();
    const ws = wb.Sheets[TAB.settings];
    if (!ws) return map;
    const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    rows.slice(1).forEach((r) => {
      if (r[0]) map.set(String(r[0]), String(r[1] ?? ''));
    });
    return map;
  }
}
