import { Service, signal, inject } from '@angular/core';
import {
  Expense, rowToExpense, expenseToRow, EXPENSE_COLUMNS,
} from '@shared/models/expense.model';
import {
  Category, rowToCategory, categoryToRow, CATEGORY_COLUMNS,
  DEFAULT_CATEGORIES,
} from '@shared/models/category.model';
import { slugify } from '@shared/utils/crypto.util';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';
import { IdbService } from './idb.service';

// ── Valid Material icon names (kept in sync with category-form) ───────────────

const VALID_ICONS = new Set<string>([
  // Food & Drink
  'restaurant', 'local_cafe', 'local_bar', 'fastfood', 'lunch_dining',
  'bakery_dining', 'local_grocery_store',
  // Transport
  'directions_car', 'directions_bus', 'local_taxi', 'train', 'flight',
  'directions_bike', 'local_gas_station',
  // Shopping
  'shopping_bag', 'shopping_cart', 'storefront', 'checkroom', 'chair', 'devices',
  // Health & Wellness
  'favorite', 'local_hospital', 'fitness_center', 'spa', 'medical_services',
  'pharmacy_medication',
  // Entertainment
  'movie', 'sports_esports', 'music_note', 'sports', 'theater_comedy', 'festival',
  // Home & Utilities
  'home', 'bolt', 'water_drop', 'wifi', 'phone_android', 'tv',
  // Finance & Work
  'work', 'school', 'account_balance', 'savings', 'credit_card', 'business_center',
  // Other
  'label', 'star', 'pets', 'child_care', 'volunteer_activism', 'more_horiz',
]);

function fixIcon(icon: string): string {
  return VALID_ICONS.has(icon) ? icon : 'label';
}

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
    // Parse and fix icons from the CSV
    const incoming: Category[] = rows
      .slice(1)
      .filter((r) => r[0])
      .map((r) => ({ ...rowToCategory(r), icon: fixIcon(rowToCategory(r).icon) }));

    // Merge: load existing IDB categories, upsert incoming ones (overwrite by id),
    // keep any existing categories that are not in the CSV
    const existing = await this.idb.getAllCategories();
    const incomingMap = new Map(incoming.map((c) => [c.id, c]));
    const merged: Category[] = [
      // Keep existing categories not overwritten by the CSV
      ...existing.filter((c) => !incomingMap.has(c.id)),
      // Add/update all incoming categories
      ...incoming,
    ];

    await this.idb.putCategories(merged);
    await this.idb.putMeta(META_FILE_CATEGORIES, name);
    this._categories.set(merged);
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
    // Header + one blank sample row so the user knows what to fill in
    const rows: string[][] = [
      [...EXPENSE_COLUMNS],
      ['', 'YYYY-MM-DD', '0.00', '', '', '', ''],
    ];
    downloadCsv(toCsv(rows), 'expenses-template.csv');
  }

  downloadCategoriesTemplate(): void {
    // Header + default categories with plain literal hex colors (no CSS token lookup)
    const CATEGORY_COLORS: Record<string, string> = {
      'Food & Dining':  '#ef5350',
      'Transport':      '#42a5f5',
      'Shopping':       '#ab47bc',
      'Entertainment':  '#ec407a',
      'Health':         '#26a69a',
      'Utilities':      '#78909c',
      'Other':          '#607d8b',
    };
    const rows: string[][] = [[...CATEGORY_COLUMNS]];
    for (const c of DEFAULT_CATEGORIES) {
      rows.push(categoryToRow({
        id:          slugify(c.name),
        name:        c.name,
        color:       CATEGORY_COLORS[c.name] ?? '#607d8b',
        budgetLimit: 0,
        icon:        c.icon,
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
