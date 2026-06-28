import { Service, inject, signal, computed } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { GoogleSheetsService } from '@core/google-sheets/google-sheets.service';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';
import { LanguageService } from '@core/i18n/language.service';
import { Category } from '@shared/models/category.model';

@Service()
export class CategoriesService {
  private readonly sheets      = inject(GoogleSheetsService);
  readonly sheetConfig         = inject(SheetConfigService);
  private readonly snack       = inject(MatSnackBar);
  private readonly transloco   = inject(TranslocoService);
  private readonly lang        = inject(LanguageService);

  // ── Private writable state ─────────────────────────────────────────────────

  private readonly _loading    = signal(false);
  private readonly _categories = signal<Category[]>([]);

  // ── Public read-only ───────────────────────────────────────────────────────

  readonly loading    = this._loading.asReadonly();
  readonly categories = this._categories.asReadonly();

  readonly categoriesWithBudget = computed(() =>
    this._categories().filter((c) => c.budgetLimit > 0).length
  );

  catName = (name: string) => this.lang.translateCategoryName(name);

  // ── Load ───────────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    if (!this.sheetConfig.isConfigured()) return;
    this._loading.set(true);
    try {
      this._categories.set(await this.sheets.getCategories());
    } catch (err) {
      this.snack.open(this.errMsg(err), this.t('categories.an_error_occurred'), { duration: 5000 });
    } finally {
      this._loading.set(false);
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async add(cat: Category): Promise<void> {
    await this.sheets.addCategory(cat);
    this._categories.update((list) => [...list, cat]);
    this.snack.open(this.t('categories.category_created'), this.t('common.ok'), { duration: 3000 });
  }

  async update(updated: Category): Promise<void> {
    await this.sheets.updateCategory(updated);
    this._categories.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
    this.snack.open(this.t('categories.category_updated'), this.t('common.ok'), { duration: 3000 });
  }

  async delete(id: string): Promise<void> {
    await this.sheets.deleteCategory(id);
    this._categories.update((list) => list.filter((c) => c.id !== id));
    this.snack.open(this.t('categories.category_deleted'), this.t('common.ok'), { duration: 3000 });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  errMsg(err: unknown): string {
    return err instanceof Error ? err.message : this.t('categories.an_error_occurred');
  }

  private t(key: string): string {
    return this.transloco.translate(key);
  }
}
