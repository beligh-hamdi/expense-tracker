import { Service, inject, signal, computed, effect } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { GoogleSheetsService } from '@core/google-sheets/google-sheets.service';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';
import { Expense } from '@shared/models/expense.model';
import { Category } from '@shared/models/category.model';

@Service()
export class ExpensesService {
  private readonly sheets      = inject(GoogleSheetsService);
  private readonly sheetConfig = inject(SheetConfigService);
  private readonly snack       = inject(MatSnackBar);
  private readonly transloco   = inject(TranslocoService);

  // ── Private writable state ─────────────────────────────────────────────────

  private readonly _loaded     = signal(false);
  private readonly _loading    = signal(false);
  private readonly _expenses   = signal<Expense[]>([]);
  private readonly _categories = signal<Category[]>([]);

  // ── Public read-only ───────────────────────────────────────────────────────

  readonly loading    = this._loading.asReadonly();
  readonly expenses   = this._expenses.asReadonly();
  readonly categories = this._categories.asReadonly();

  readonly categoryMap = computed(() =>
    Object.fromEntries(this._categories().map((c) => [c.id, c]))
  );

  constructor() {
    // Auto-load once the sheet is configured
    effect(() => {
      if (!this._loaded() && this.sheetConfig.isConfigured()) {
        this._loaded.set(true);
        this.loadAll();
      }
    });
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  async loadAll(): Promise<void> {
    this._loading.set(true);
    try {
      const [expenses, categories] = await Promise.all([
        this.sheets.getExpenses(),
        this.sheets.getCategories(),
      ]);
      this._expenses.set(expenses.sort((a, b) => b.date.localeCompare(a.date)));
      this._categories.set(categories);
    } catch (err) {
      this.snack.open(this.errMsg(err), this.t('expenses.dismiss'), { duration: 6000 });
    } finally {
      this._loading.set(false);
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async add(expense: Expense): Promise<void> {
    await this.sheets.addExpense(expense);
    this._expenses.update((list) => [expense, ...list]);
    this.snack.open(this.t('expenses.expense_added'), this.t('expenses.ok'), { duration: 3000 });
  }

  async update(updated: Expense): Promise<void> {
    await this.sheets.updateExpense(updated);
    this._expenses.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
    this.snack.open(this.t('expenses.expense_updated'), this.t('expenses.ok'), { duration: 3000 });
  }

  async delete(id: string): Promise<void> {
    await this.sheets.deleteExpense(id);
    this._expenses.update((list) => list.filter((e) => e.id !== id));
    this.snack.open(this.t('expenses.expense_deleted'), this.t('expenses.ok'), { duration: 3000 });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  errMsg(err: unknown): string {
    return err instanceof Error ? err.message : this.t('expenses.an_error_occurred');
  }

  private t(key: string): string {
    return this.transloco.translate(key);
  }
}
