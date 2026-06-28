import { Service, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, forkJoin } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '@environments/environment';
import { SheetConfigService } from './sheet-config.service';
import {
  Expense, expenseToRow, rowToExpense, EXPENSE_COLUMNS,
} from '@shared/models/expense.model';
import {
  Category, categoryToRow, rowToCategory, CATEGORY_COLUMNS,
  DEFAULT_CATEGORIES,
} from '@shared/models/category.model';
import { resolveMatToken } from '@shared/utils/mat-colors.util';
import { slugify } from '@shared/utils/crypto.util';

// ── Sheets API response shapes ───────────────────────────────────────────────

interface ValuesResponse {
  range: string;
  majorDimension: string;
  values?: string[][];
}

interface AppendResponse {
  updates: { updatedRange: string; updatedRows: number };
}

interface BatchUpdateResponse {
  spreadsheetId: string;
}

interface SpreadsheetResponse {
  spreadsheetId: string;
  sheets: Array<{ properties: { sheetId: number; title: string } }>;
}

// ── Tab names ────────────────────────────────────────────────────────────────

export const SHEET_TABS = {
  expenses:   'Expenses',
  categories: 'Categories',
  settings:   'Settings',
} as const;

// ── Header rows ──────────────────────────────────────────────────────────────

const EXPENSE_HEADERS   = [...EXPENSE_COLUMNS];
const CATEGORY_HEADERS  = [...CATEGORY_COLUMNS];
const SETTINGS_HEADERS  = ['key', 'value'];

@Service()
export class GoogleSheetsService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(SheetConfigService);
  private readonly transloco = inject(TranslocoService);

  private get baseUrl(): string {
    return environment.sheetsApi.baseUrl;
  }

  private get spreadsheetId(): string {
    const id = this.config.spreadsheetId();
    if (!id) throw new Error('No spreadsheet configured. Go to Settings to set one up.');
    return id;
  }

  // ── First-run setup ────────────────────────────────────────────────────────

  /**
   * Inspects the spreadsheet and creates any missing tabs
   * (Expenses, Categories, Settings) with their header rows.
   * Seeds default categories if the Categories tab was just created.
   */
  async ensureSheetTabs(): Promise<void> {
    const meta = await firstValueFrom(
      this.http.get<SpreadsheetResponse>(`${this.baseUrl}/${this.spreadsheetId}`)
    );

    const existingTitles = new Set(
      meta.sheets.map((s) => s.properties.title)
    );

    const tabsToCreate = Object.values(SHEET_TABS).filter(
      (t) => !existingTitles.has(t)
    );

    if (tabsToCreate.length > 0) {
      await this.createTabs(tabsToCreate);
    }

    // Write headers to any freshly-created tabs
    if (!existingTitles.has(SHEET_TABS.expenses)) {
      await this.writeHeaders(SHEET_TABS.expenses, EXPENSE_HEADERS);
    }
    if (!existingTitles.has(SHEET_TABS.categories)) {
      await this.writeHeaders(SHEET_TABS.categories, CATEGORY_HEADERS);
      await this.seedDefaultCategories();
    }
    if (!existingTitles.has(SHEET_TABS.settings)) {
      await this.writeHeaders(SHEET_TABS.settings, SETTINGS_HEADERS);
    }
  }

  private async createTabs(titles: string[]): Promise<void> {
    const requests = titles.map((title) => ({
      addSheet: { properties: { title } },
    }));

    await firstValueFrom(
      this.http.post<BatchUpdateResponse>(
        `${this.baseUrl}/${this.spreadsheetId}:batchUpdate`,
        { requests }
      )
    );
  }

  private async writeHeaders(tab: string, headers: string[]): Promise<void> {
    await firstValueFrom(
      this.http.put(
        `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(tab + '!A1')}`,
        { values: [headers] },
        { params: { valueInputOption: 'RAW' } }
      )
    );
  }

  private async seedDefaultCategories(): Promise<void> {
    // selectTranslate waits for the translation file to finish loading
    // before resolving — avoids getting the key back instead of the translation
    const names = await firstValueFrom(
      forkJoin(DEFAULT_CATEGORIES.map((c) => this.transloco.selectTranslate<string>(c.nameKey)))
    );
    const rows = DEFAULT_CATEGORIES.map((c, i) => {
      const name  = names[i] && names[i] !== c.nameKey ? names[i] : c.name;
      const color = resolveMatToken(c.colorToken) || c.colorToken; // fallback to token name if not resolved
      return categoryToRow({ id: slugify(c.name), name, color, budgetLimit: c.budgetLimit, icon: c.icon });
    });
    if (rows.length === 0) return;
    await firstValueFrom(
      this.http.post<AppendResponse>(
        `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.categories + '!A:E')}:append`,
        { values: rows },
        { params: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' } }
      )
    );
  }

  // ── Expenses CRUD ──────────────────────────────────────────────────────────

  async getExpenses(): Promise<Expense[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ValuesResponse>(
          `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.expenses + '!A:G')}`
        )
      );
      const rows = res.values ?? [];
      return rows.slice(1).filter((r) => r[0]).map(rowToExpense);
    } catch (e) {
      this.rethrow(e, 'Failed to load expenses');
    }
  }

  async addExpense(expense: Expense): Promise<void> {
    await firstValueFrom(
      this.http.post<AppendResponse>(
        `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.expenses + '!A:G')}:append`,
        { values: [expenseToRow(expense)] },
        { params: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' } }
      )
    );
  }

  async updateExpense(expense: Expense): Promise<void> {
    const rowIndex = await this.findRowIndex(SHEET_TABS.expenses, expense.id);
    if (rowIndex === -1) throw new Error(`Expense ${expense.id} not found in sheet`);

    const sheetRow = rowIndex + 1; // Sheets rows are 1-based
    await firstValueFrom(
      this.http.put(
        `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.expenses + `!A${sheetRow}:G${sheetRow}`)}`,
        { values: [expenseToRow(expense)] },
        { params: { valueInputOption: 'RAW' } }
      )
    );
  }

  async deleteExpense(id: string): Promise<void> {
    await this.clearRowById(SHEET_TABS.expenses, id, 7);
  }

  // ── Categories CRUD ────────────────────────────────────────────────────────

  async getCategories(): Promise<Category[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ValuesResponse>(
          `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.categories + '!A:E')}`
        )
      );
      const rows = res.values ?? [];
      return rows.slice(1).filter((r) => r[0]).map(rowToCategory);
    } catch (e) {
      this.rethrow(e, 'Failed to load categories');
    }
  }

  async addCategory(category: Category): Promise<void> {
    await firstValueFrom(
      this.http.post<AppendResponse>(
        `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.categories + '!A:E')}:append`,
        { values: [categoryToRow(category)] },
        { params: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' } }
      )
    );
  }

  async updateCategory(category: Category): Promise<void> {
    const rowIndex = await this.findRowIndex(SHEET_TABS.categories, category.id);
    if (rowIndex === -1) throw new Error(`Category ${category.id} not found in sheet`);

    const sheetRow = rowIndex + 1;
    await firstValueFrom(
      this.http.put(
        `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.categories + `!A${sheetRow}:E${sheetRow}`)}`,
        { values: [categoryToRow(category)] },
        { params: { valueInputOption: 'RAW' } }
      )
    );
  }

  async deleteCategory(id: string): Promise<void> {
    await this.clearRowById(SHEET_TABS.categories, id, 5);
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async getSetting(key: string): Promise<string | null> {
    const res = await firstValueFrom(
      this.http.get<ValuesResponse>(
        `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.settings + '!A:B')}`
      )
    );
    const rows = res.values ?? [];
    // Skip index 0 (header row) when searching
    const found = rows.slice(1).find((r) => r[0] === key);
    return found?.[1] ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<ValuesResponse>(
        `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.settings + '!A:A')}`
      )
    );
    const rows = res.values ?? [];
    // Start from index 1 to skip the header row ['key', 'value']
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === key);

    if (rowIndex > 0) {
      const sheetRow = rowIndex + 1;
      await firstValueFrom(
        this.http.put(
          `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.settings + `!A${sheetRow}:B${sheetRow}`)}`,
          { values: [[key, value]] },
          { params: { valueInputOption: 'RAW' } }
        )
      );
    } else {
      await firstValueFrom(
        this.http.post<AppendResponse>(
          `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(SHEET_TABS.settings + '!A:B')}:append`,
          { values: [[key, value]] },
          { params: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' } }
        )
      );
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Reads column A of the given tab and returns the 0-based index of the row
   * whose first cell matches `id`. Returns -1 if not found.
   * Index 0 = header row, so data starts at index 1.
   */
  private async findRowIndex(tab: string, id: string): Promise<number> {
    const res = await firstValueFrom(
      this.http.get<ValuesResponse>(
        `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(tab + '!A:A')}`
      )
    );
    const rows = res.values ?? [];
    return rows.findIndex((r) => r[0] === id);
  }

  /**
   * Soft-deletes a row by blanking all its cells.
   * Google Sheets API v4 does not support row deletion via values API;
   * actual row removal requires a batchUpdate with deleteDimension which
   * needs the numeric sheetId. We use blank-row strategy here for simplicity;
   * getExpenses/getCategories already filter out rows with empty id.
   */
  private async clearRowById(tab: string, id: string, numCols: number): Promise<void> {
    const rowIndex = await this.findRowIndex(tab, id);
    if (rowIndex === -1) return; // Already gone

    const sheetRow = rowIndex + 1;
    const lastCol = String.fromCharCode(64 + numCols); // e.g. 7 → 'G'
    const emptyRow = Array(numCols).fill('');

    await firstValueFrom(
      this.http.put(
        `${this.baseUrl}/${this.spreadsheetId}/values/${encodeURIComponent(tab + `!A${sheetRow}:${lastCol}${sheetRow}`)}`,
        { values: [emptyRow] },
        { params: { valueInputOption: 'RAW' } }
      )
    );
  }

  private rethrow(e: unknown, prefix: string): never {
    const msg =
      e instanceof HttpErrorResponse
        ? `${prefix}: ${e.error?.error?.message ?? e.message}`
        : `${prefix}`;
    throw new Error(msg);
  }
}
