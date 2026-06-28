import { Service, signal, inject } from '@angular/core';
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
import { IdbService } from './idb.service';

const META_FILE_EXPENSES   = 'csvExpensesName';
const META_FILE_CATEGORIES = 'csvCategoriesName';

// ── CSV helpers ───────────────────────────────────────────────────────────────

/** Parse a CSV string → array of string[] rows (skips blank lines). */
function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.trim()))
    .filter((row) => row.some((c) => c !== ''));
}

/** Serialise rows to a CSV string. Values with commas/quotes are quoted. */
function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(',')
    )
    .join('\n');
}

/** Trigger a browser download of a UTF-8 text file. */
function downloadCsv(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Service ───────────────────────────────────────────────────────────────────

@Service()
export class LocalFileService {
  private readonly idb         = inject(IdbService);
  private readonly sheetConfig = inject(SheetConfigService);

  // ── Reactive signals (in-memory view of IndexedDB) ────────────────────────

  private readonly _expensesFileName   = signal<string | null>(null);
  private readonly _categoriesFileName = signal<string | null>(null);
  private readonly _expenses           = signal<Expense[]>([]);
  private readonly _categories         = signal<Category[]>([]);

  /** Kept for backwards-compat (Settings UI shows a single file name badge). */
  readonly fileName   = this._expensesFileName.asReadonly();
  readonly expenses   = this._expenses.asReadonly();
  readonly categories = this._categories.asReadonly();

  // ── Initialise from IndexedDB on startup ──────────────────────────────────

  async restoreFromIdb(): Promise<void> {
    const [eName, cName, expenses, categories] = await Promise.all([
      this.idb.getMeta(META_FILE_EXPENSES),
      this.idb.getMeta(META_FILE_CATEGORIES),
      this.idb.getAllExpenses(),
      this.idb.getAllCategories(),
    ]);

    if (!eName && !cName) return; // nothing was ever saved

    this._expensesFileName.set(eName);
    this._categoriesFileName.set(cName);
    this._expenses.set(expenses.sort((a, b) => b.date.localeCompare(a.date)));
    this._categories.set(categories);
    this.sheetConfig.setLocalFileLoaded(true);
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  /**
   * Load a CSV file. The file type is auto-detected by its header row:
   *   - If first column header is 'id' and second is 'date'  → Expenses CSV
   *   - If first column header is 'id' and second is 'name'  → Categories CSV
   *
   * Uploading either file independently is fine — the other dataset is
   * kept as-is in IndexedDB/signals.
   */
  async load(file: File): Promise<void> {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 1) throw new Error('Empty CSV file');

    const header = rows[0].map((h) => h.toLowerCase());

    if (header[0] === 'id' && header[1] === 'date') {
      // Expenses CSV
      await this.loadExpensesCsv(rows, file.name);
    } else if (header[0] === 'id' && header[1] === 'name') {
      // Categories CSV
      await this.loadCategoriesCsv(rows, file.name);
    } else {
      throw new Error(
        'Unrecognised CSV format. Expected header row starting with "id,date" (expenses) or "id,name" (categories).'
      );
    }
  }

  private async loadExpensesCsv(rows: string[][], name: string): Promise<void> {
    const expenses = rows.slice(1).filter((r) => r[0]).map(rowToExpense);
    await this.idb.clearExpenses();
    await this.idb.putExpenses(expenses);
    await this.idb.putMeta(META_FILE_EXPENSES, name);
    this._expenses.set(expenses.sort((a, b) => b.date.localeCompare(a.date)));
    this._expensesFileName.set(name);
    this.sheetConfig.setLocalFileLoaded(true);
  }

  private async loadCategoriesCsv(rows: string[][], name: string): Promise<void> {
    const categories = rows.slice(1).filter((r) => r[0]).map(rowToCategory);
    await this.idb.clearCategories();
    await this.idb.putCategories(categories);
    await this.idb.putMeta(META_FILE_CATEGORIES, name);
    this._categories.set(categories);
    this._categoriesFileName.set(name);
    this.sheetConfig.setLocalFileLoaded(true);
  }

  // ── Expenses CRUD (mutates signal + IDB) ──────────────────────────────────

  async addExpense(e: Expense): Promise<void> {
    await this.idb.putExpense(e);
    this._expenses.update((list) => [e, ...list]);
  }

  async updateExpense(updated: Expense): Promise<void> {
    await this.idb.putExpense(updated);
    this._expenses.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
  }

  async deleteExpense(id: string): Promise<void> {
    await this.idb.deleteExpense(id);
    this._expenses.update((list) => list.filter((e) => e.id !== id));
  }

  // ── Categories CRUD (mutates signal + IDB) ────────────────────────────────

  async addCategory(c: Category): Promise<void> {
    await this.idb.putCategory(c);
    this._categories.update((list) => [...list, c]);
  }

  async updateCategory(updated: Category): Promise<void> {
    await this.idb.putCategory(updated);
    this._categories.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
  }

  async deleteCategory(id: string): Promise<void> {
    await this.idb.deleteCategory(id);
    this._categories.update((list) => list.filter((c) => c.id !== id));
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSetting(key: string): Promise<string | null> {
    return this.idb.getSetting(key);
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.idb.putSetting(key, value);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  exportExpenses(baseName = 'expenses'): void {
    const rows: string[][] = [
      [...EXPENSE_COLUMNS],
      ...this._expenses().map(expenseToRow),
    ];
    downloadCsv(toCsv(rows), baseName.endsWith('.csv') ? baseName : baseName + '-expenses.csv');
  }

  exportCategories(baseName = 'categories'): void {
    const rows: string[][] = [
      [...CATEGORY_COLUMNS],
      ...this._categories().map(categoryToRow),
    ];
    downloadCsv(toCsv(rows), baseName.endsWith('.csv') ? baseName : baseName + '-categories.csv');
  }

  /** Convenience: export both at once. */
  async export(baseName = 'expense-tracker'): Promise<void> {
    this.exportExpenses(baseName);
    this.exportCategories(baseName);
  }

  // ── Template download ─────────────────────────────────────────────────────

  downloadExpensesTemplate(): void {
    downloadCsv(toCsv([[...EXPENSE_COLUMNS]]), 'expenses-template.csv');
  }

  downloadCategoriesTemplate(): void {
    const rows: string[][] = [[...CATEGORY_COLUMNS]];
    for (const c of DEFAULT_CATEGORIES) {
      const color = resolveMatToken(c.colorToken) || '#607d8b';
      rows.push(categoryToRow({
        id: slugify(c.name), name: c.name, color, budgetLimit: 0, icon: c.icon,
      }));
    }
    downloadCsv(toCsv(rows), 'categories-template.csv');
  }

  /** Kept for backwards-compat (called from SettingsService). */
  downloadTemplate(): void {
    this.downloadExpensesTemplate();
    this.downloadCategoriesTemplate();
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  async clearFile(): Promise<void> {
    await Promise.all([
      this.idb.clearAll(),
      this.idb.deleteMeta(META_FILE_EXPENSES),
      this.idb.deleteMeta(META_FILE_CATEGORIES),
    ]);
    this._expenses.set([]);
    this._categories.set([]);
    this._expensesFileName.set(null);
    this._categoriesFileName.set(null);
    this.sheetConfig.setLocalFileLoaded(false);
  }
}
