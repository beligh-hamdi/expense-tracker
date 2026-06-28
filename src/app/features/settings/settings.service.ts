import { Service, inject, signal, computed } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';
import { GoogleSheetsService } from '@core/google-sheets/google-sheets.service';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { APP_VERSION } from '@core/version/version.token';
import { ExpensesService } from '@features/expenses/expenses.service';
import { CategoriesService } from '@features/categories/categories.service';

const SHEET_KEY_AI = 'gemini_api_key';

@Service()
export class SettingsService {
  readonly sheetConfig  = inject(SheetConfigService);
  readonly auth         = inject(AuthService);
  readonly langService  = inject(LanguageService);
  readonly appVersion   = inject(APP_VERSION);
  private readonly sheets    = inject(GoogleSheetsService);
  private readonly snack     = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly expensesSvc    = inject(ExpensesService);
  private readonly categoriesSvc  = inject(CategoriesService);

  // ── Private writable state ─────────────────────────────────────────────────

  private readonly _loading    = signal(false);
  private readonly _savingKey  = signal(false);
  private readonly _syncing    = signal(false);
  private readonly _lastSynced = signal<Date | null>(null);

  // ── Public signals ─────────────────────────────────────────────────────────

  readonly loading            = this._loading.asReadonly();
  readonly savingKey          = this._savingKey.asReadonly();
  readonly syncing            = this._syncing.asReadonly();
  readonly lastSynced         = this._lastSynced.asReadonly();
  readonly spreadsheetIdInput = signal(this.sheetConfig.spreadsheetId() ?? ''); // writable: two-way binding
  readonly aiApiKeyInput      = signal(this.sheetConfig.aiApiKey() ?? '');       // writable: two-way binding

  readonly spreadsheetUrl = computed(
    () => `https://docs.google.com/spreadsheets/d/${this.sheetConfig.spreadsheetId()}/edit`
  );

  // ── Sheet connection ───────────────────────────────────────────────────────

  async connectSheet(): Promise<void> {
    const id = this.spreadsheetIdInput().trim();
    if (!id) return;
    this._loading.set(true);
    try {
      this.sheetConfig.setSpreadsheetId(id);
      await this.sheets.ensureSheetTabs();
      // Load saved AI key from sheet into localStorage
      await this.loadAiKeyFromSheet();
      this.snack.open(this.t('settings.spreadsheet_connected_success'), this.t('settings.ok'), { duration: 4000 });
    } catch (err: unknown) {
      this.sheetConfig.clearSpreadsheetId();
      const msg = err instanceof Error ? err.message : this.t('settings.failed_to_connect');
      this.snack.open(msg, this.t('settings.dismiss'), { duration: 6000 });
    } finally {
      this._loading.set(false);
    }
  }

  disconnectSheet(): void {
    this.sheetConfig.clearSpreadsheetId();
    this.spreadsheetIdInput.set('');
    this.snack.open(this.t('settings.spreadsheet_disconnected'), this.t('settings.ok'), { duration: 3000 });
  }

  // ── AI API key ─────────────────────────────────────────────────────────────

  async saveAiApiKey(): Promise<void> {
    const key = this.aiApiKeyInput().trim();
    this._savingKey.set(true);
    try {
      // Persist to Google Sheet Settings tab (source of truth)
      if (this.sheetConfig.isConfigured()) {
        await this.sheets.setSetting(SHEET_KEY_AI, key);
      }
      // Always persist to localStorage (fast read on next load)
      this.sheetConfig.setAiApiKey(key);
      this.snack.open(
        key ? this.t('settings.ai_key_saved') : this.t('settings.ai_key_removed'),
        this.t('settings.ok'),
        { duration: 3000 }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : this.t('settings.failed_to_save_key');
      this.snack.open(msg, this.t('settings.dismiss'), { duration: 6000 });
    } finally {
      this._savingKey.set(false);
    }
  }

  private async loadAiKeyFromSheet(): Promise<void> {
    try {
      const key = await this.sheets.getSetting(SHEET_KEY_AI);
      if (key) {
        this.sheetConfig.setAiApiKey(key);
        this.aiApiKeyInput.set(key);
      }
    } catch {
      // Non-fatal — user can enter the key manually
    }
  }

  // ── Sync ───────────────────────────────────────────────────────────────────

  async syncData(): Promise<void> {
    if (!this.sheetConfig.isConfigured()) return;
    this._syncing.set(true);
    try {
      await Promise.all([
        this.expensesSvc.loadAll(),
        this.categoriesSvc.load(),
      ]);
      this._lastSynced.set(new Date());
      this.snack.open(this.t('settings.sync_success'), this.t('settings.ok'), { duration: 3000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : this.t('settings.sync_failed');
      this.snack.open(msg, this.t('settings.dismiss'), { duration: 6000 });
    } finally {
      this._syncing.set(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private t(key: string): string {
    return this.transloco.translate(key);
  }
}
