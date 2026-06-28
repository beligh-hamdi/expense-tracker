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
import { IdbService } from './idb.service';

const TAB = {
  expenses:   'Expenses',
  categories: 'Categories',
  settings:   'Settings',
} as const;

const META_FILE_NAME = 'fileName';

// ── Service ───────────────────────────────────────────────────────────────────

@Service()
export class LocalFileService {
  private readonly idb         = inject(IdbService);
  private readonly sheetConfig = inject(SheetConfigService);

  // ── Reactive signals (in-memory view of IndexedDB) ────────────────────────

  private readonly _fileName   = signal<string | null>(null);
  private readonly _expenses   = signal<Expense[]>([]);
  private readonly _categories = signal<Category[]>([]);

  readonly fileName   = this._fileName.asReadonly();
  readonly expenses   = this._expenses.asReadonly();
  readonly categories = this._categories.asReadonly();

  // ── Initialise from IndexedDB on startup ──────────────────────────────────

  /**
   * Called once at boot (by LocalFileSyncService via APP_INITIALIZER).
   * Restores the last session's data from IndexedDB if local mode was active.
   */
  async restoreFromIdb(): Promise<void> {
    const name = await this.idb.getMeta(META_FILE_NAME);
    if (!name) return; // No local file was ever saved

    const [expenses, categories] = await Promise.all([
      this.idb.getAllExpenses(),
      this.idb.getAllCategories(),
    ]);

    this._fileName.set(name);
    this._expenses.set(expenses.sort((a, b) => b.date.localeCompare(a.date)));
    this._categories.set(categories);
    this.sheetConfig.setLocalFileLoaded(true);
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  /**
   * Parses an uploaded .xlsx or .csv File, persists every row to IndexedDB,
   * and refreshes the in-memory signals.
   */
  async load(file: File): Promise<void> {
    const buffer   = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    const expenses   = this.readTab<Expense>(workbook,  TAB.expenses,   rowToExpense);
    const categories = this.readTab<Category>(workbook, TAB.categories, rowToCategory);
    const settings   = this.readSettings(workbook);

    // Persist everything to IndexedDB
    await Promise.all([
      this.idb.clearAll(),
      this.idb.putMeta(META_FILE_NAME, file.name),
    ]);
    await Promise.all([
      this.idb.putExpenses(expenses),
      this.idb.putCategories(categories),
      ...Array.from(settings.entries()).map(([k, v]) => this.idb.putSetting(k, v)),
    ]);

    // Update signals
    this._expenses.set(expenses.sort((a, b) => b.date.localeCompare(a.date)));
    this._categories.set(categories);
    this._fileName.set(file.name);
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

  /**
   * Serialises the current in-memory state to an .xlsx file and triggers
   * a browser download.
   */
  async export(fileName = 'expense-tracker.xlsx'): Promise<void> {
    const settings = await this.idb.getAllSettings();
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
    settings.forEach((v, k) => settingsRows.push([k, v]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(settingsRows), TAB.settings);

    XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : fileName + '.xlsx');
  }

  // ── Template download ─────────────────────────────────────────────────────

  downloadTemplate(): void {
    const wb = XLSX.utils.book_new();

    // Expenses — headers only
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([[...EXPENSE_COLUMNS]]),
      TAB.expenses,
    );

    // Categories — headers + default categories
    const catRows: string[][] = [[...CATEGORY_COLUMNS]];
    for (const c of DEFAULT_CATEGORIES) {
      const color = resolveMatToken(c.colorToken) || '#607d8b';
      catRows.push(categoryToRow({
        id: slugify(c.name), name: c.name, color, budgetLimit: 0, icon: c.icon,
      }));
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catRows), TAB.categories);

    // Settings — headers only
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['key', 'value']]),
      TAB.settings,
    );

    XLSX.writeFile(wb, 'expense-tracker-template.xlsx');
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  async clearFile(): Promise<void> {
    await Promise.all([
      this.idb.clearAll(),
      this.idb.deleteMeta(META_FILE_NAME),
    ]);
    this._expenses.set([]);
    this._categories.set([]);
    this._fileName.set(null);
    this.sheetConfig.setLocalFileLoaded(false);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

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
    const ws  = wb.Sheets[TAB.settings];
    if (!ws) return map;
    const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    rows.slice(1).forEach((r) => {
      if (r[0]) map.set(String(r[0]), String(r[1] ?? ''));
    });
    return map;
  }
}
