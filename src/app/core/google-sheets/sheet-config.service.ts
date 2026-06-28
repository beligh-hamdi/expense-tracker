import { Service, signal, computed, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { environment } from '@environments/environment';

const STORAGE_KEY_SHEET   = 'et_spreadsheet_id';
const STORAGE_KEY_AI_KEY  = 'et_ai_api_key';
const STORAGE_KEY_MODE    = 'et_data_mode';

export type DataMode = 'google' | 'local';

/**
 * Stores and provides the user's Google Spreadsheet ID and AI API key.
 * Both are kept in localStorage so they persist across sessions, keyed
 * per user (Google sub) so multiple accounts each get their own values.
 */
@Service()
export class SheetConfigService {
  private readonly auth = inject(AuthService);

  // ── Data mode (google | local) ─────────────────────────────────────────────

  private readonly _dataMode = signal<DataMode>(
    (localStorage.getItem(STORAGE_KEY_MODE) as DataMode | null) ?? 'google'
  );
  readonly dataMode    = this._dataMode.asReadonly();
  readonly isLocalMode = computed(() => this._dataMode() === 'local');

  setDataMode(mode: DataMode): void {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
    this._dataMode.set(mode);
  }

  // ── Spreadsheet ID ─────────────────────────────────────────────────────────

  private readonly _spreadsheetId = signal<string | null>(this.loadId());

  readonly spreadsheetId = this._spreadsheetId.asReadonly();
  // True when google mode has a sheet ID, OR local mode has a file loaded.
  // LocalFileService sets this via setLocalFileLoaded() to avoid a circular dep.
  private readonly _localFileLoaded = signal(false);
  readonly isConfigured = computed(
    () => this._dataMode() === 'local'
      ? this._localFileLoaded()
      : !!this._spreadsheetId()
  );

  setLocalFileLoaded(loaded: boolean): void {
    this._localFileLoaded.set(loaded);
  }

  setSpreadsheetId(id: string): void {
    const key = this.sheetStorageKey();
    if (key) localStorage.setItem(key, id);
    this._spreadsheetId.set(id);
  }

  clearSpreadsheetId(): void {
    const key = this.sheetStorageKey();
    if (key) localStorage.removeItem(key);
    this._spreadsheetId.set(null);
  }

  // ── AI API key ─────────────────────────────────────────────────────────────

  private readonly _aiApiKey = signal<string | null>(this.loadAiKey());

  readonly aiApiKey   = this._aiApiKey.asReadonly();
  readonly hasAiKey   = computed(() => !!this._aiApiKey());

  setAiApiKey(key: string): void {
    const storageKey = this.aiKeyStorageKey();
    if (storageKey) localStorage.setItem(storageKey, key);
    this._aiApiKey.set(key || null);
  }

  clearAiApiKey(): void {
    const storageKey = this.aiKeyStorageKey();
    if (storageKey) localStorage.removeItem(storageKey);
    this._aiApiKey.set(null);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private loadId(): string | null {
    const sub = this.tryGetSub();
    const key = sub ? `${STORAGE_KEY_SHEET}_${sub}` : STORAGE_KEY_SHEET;
    return localStorage.getItem(key) || environment.sheetsApi.defaultSheetId || null;
  }

  private loadAiKey(): string | null {
    const sub = this.tryGetSub();
    const key = sub ? `${STORAGE_KEY_AI_KEY}_${sub}` : STORAGE_KEY_AI_KEY;
    return localStorage.getItem(key) || null;
  }

  private sheetStorageKey(): string | null {
    const sub = this.tryGetSub();
    return sub ? `${STORAGE_KEY_SHEET}_${sub}` : STORAGE_KEY_SHEET;
  }

  private aiKeyStorageKey(): string | null {
    const sub = this.tryGetSub();
    return sub ? `${STORAGE_KEY_AI_KEY}_${sub}` : STORAGE_KEY_AI_KEY;
  }

  private tryGetSub(): string | null {
    try {
      return this.auth.user()?.sub ?? null;
    } catch {
      return null;
    }
  }
}
