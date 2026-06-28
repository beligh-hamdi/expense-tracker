import { Service } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Expense } from '@shared/models/expense.model';
import { Category } from '@shared/models/category.model';

// ── Schema ────────────────────────────────────────────────────────────────────

interface EtDB extends DBSchema {
  expenses: {
    key: string;      // Expense.id
    value: Expense;
    indexes: { 'by-date': string };
  };
  categories: {
    key: string;      // Category.id
    value: Category;
  };
  settings: {
    key: string;      // setting key
    value: { key: string; value: string };
  };
  meta: {
    key: string;
    value: { key: string; value: string };
  };
}

const DB_NAME    = 'expense-tracker';
const DB_VERSION = 1;

// ── Service ───────────────────────────────────────────────────────────────────

@Service()
export class IdbService {
  private _db: IDBPDatabase<EtDB> | null = null;

  private async db(): Promise<IDBPDatabase<EtDB>> {
    if (this._db) return this._db;
    this._db = await openDB<EtDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('expenses')) {
          const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expStore.createIndex('by-date', 'date');
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
    return this._db;
  }

  // ── Expenses ──────────────────────────────────────────────────────────────

  async getAllExpenses(): Promise<Expense[]> {
    return (await this.db()).getAll('expenses');
  }

  async putExpense(e: Expense): Promise<void> {
    await (await this.db()).put('expenses', e);
  }

  async putExpenses(list: Expense[]): Promise<void> {
    const db  = await this.db();
    const tx  = db.transaction('expenses', 'readwrite');
    await Promise.all([...list.map((e) => tx.store.put(e)), tx.done]);
  }

  async deleteExpense(id: string): Promise<void> {
    await (await this.db()).delete('expenses', id);
  }

  async clearExpenses(): Promise<void> {
    await (await this.db()).clear('expenses');
  }

  // ── Categories ────────────────────────────────────────────────────────────

  async getAllCategories(): Promise<Category[]> {
    return (await this.db()).getAll('categories');
  }

  async putCategory(c: Category): Promise<void> {
    await (await this.db()).put('categories', c);
  }

  async putCategories(list: Category[]): Promise<void> {
    const db  = await this.db();
    const tx  = db.transaction('categories', 'readwrite');
    await Promise.all([...list.map((c) => tx.store.put(c)), tx.done]);
  }

  async deleteCategory(id: string): Promise<void> {
    await (await this.db()).delete('categories', id);
  }

  async clearCategories(): Promise<void> {
    await (await this.db()).clear('categories');
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSetting(key: string): Promise<string | null> {
    const row = await (await this.db()).get('settings', key);
    return row?.value ?? null;
  }

  async putSetting(key: string, value: string): Promise<void> {
    await (await this.db()).put('settings', { key, value });
  }

  async getAllSettings(): Promise<Map<string, string>> {
    const rows = await (await this.db()).getAll('settings');
    return new Map(rows.map((r) => [r.key, r.value]));
  }

  async clearSettings(): Promise<void> {
    await (await this.db()).clear('settings');
  }

  // ── Meta (file name, mode, …) ─────────────────────────────────────────────

  async getMeta(key: string): Promise<string | null> {
    const row = await (await this.db()).get('meta', key);
    return row?.value ?? null;
  }

  async putMeta(key: string, value: string): Promise<void> {
    await (await this.db()).put('meta', { key, value });
  }

  async deleteMeta(key: string): Promise<void> {
    await (await this.db()).delete('meta', key);
  }

  // ── Bulk clear (used when removing local file) ────────────────────────────

  async clearAll(): Promise<void> {
    await Promise.all([
      this.clearExpenses(),
      this.clearCategories(),
      this.clearSettings(),
    ]);
  }
}
