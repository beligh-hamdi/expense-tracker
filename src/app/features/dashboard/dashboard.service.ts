import { Service, inject, computed } from '@angular/core';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';
import { ExpensesService } from '@features/expenses/expenses.service';
import { Category } from '@shared/models/category.model';
import { Expense } from '@shared/models/expense.model';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface MonthlySummary {
  month: string;   // 'YYYY-MM'
  label: string;   // 'Jun 2025'
  total: number;
}

export interface CategorySummary {
  category: Category;
  total: number;
  count: number;
  percentOfTotal: number;
}

export interface DailyPoint {
  day: string;   // 'YYYY-MM-DD'
  label: string; // 'Jun 1'
  total: number;
}

export interface DashboardStats {
  totalThisMonth: number;
  totalLastMonth: number;
  countThisMonth: number;
  avgPerDay: number;
  topCategory: Category | null;
  monthOverMonth: MonthlySummary[];
  categoryBreakdown: CategorySummary[];
  dailyThisMonth: DailyPoint[];
  totalAllTime: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Service()
export class DashboardService {
  readonly sheetConfig = inject(SheetConfigService);
  private readonly expensesSvc = inject(ExpensesService);

  // Expose pass-through signals for the template
  readonly loading    = this.expensesSvc.loading;
  readonly expenses   = this.expensesSvc.expenses;
  readonly categories = this.expensesSvc.categories;

  readonly categoriesWithBudget = computed(() =>
    this.categories().filter((c) => c.budgetLimit > 0)
  );

  readonly stats = computed<DashboardStats | null>(() => {
    const expenses   = this.expenses();
    const categories = this.categories();
    if (!expenses.length && !categories.length) return null;
    return this.compute(expenses, categories);
  });

  // ── Computation ─────────────────────────────────────────────────────────────

  compute(expenses: Expense[], categories: Category[]): DashboardStats {
    const catMap    = Object.fromEntries(categories.map((c) => [c.id, c]));
    const now       = new Date();
    const thisMonth = monthKey(now);
    const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1));

    const thisMonthExp = expenses.filter((e) => e.date.startsWith(thisMonth));
    const lastMonthExp = expenses.filter((e) => e.date.startsWith(lastMonth));

    const totalThisMonth = sum(thisMonthExp);
    const totalLastMonth = sum(lastMonthExp);
    const countThisMonth = thisMonthExp.length;
    const avgPerDay      = totalThisMonth / Math.max(1, now.getDate());
    const totalAllTime   = sum(expenses);

    // Category breakdown (this month, sorted descending)
    const byCat: Record<string, number> = {};
    for (const e of thisMonthExp) byCat[e.categoryId] = (byCat[e.categoryId] ?? 0) + e.amount;

    const categoryBreakdown: CategorySummary[] = Object.entries(byCat)
      .map(([id, total]) => ({
        category: catMap[id] ?? { id, name: 'Unknown', color: '#9e9e9e', budgetLimit: 0, icon: 'label' },
        total,
        count: thisMonthExp.filter((e) => e.categoryId === id).length,
        percentOfTotal: totalThisMonth > 0 ? (total / totalThisMonth) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const topCategory = categoryBreakdown[0]?.category ?? null;

    // Last 6 months
    const monthOverMonth: MonthlySummary[] = Array.from({ length: 6 }, (_, i) => {
      const d     = new Date(now.getFullYear(), now.getMonth() - (5 - i));
      const key   = monthKey(d);
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      return { month: key, label, total: sum(expenses.filter((e) => e.date.startsWith(key))) };
    });

    // Daily breakdown (current month)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyThisMonth: DailyPoint[] = Array.from({ length: daysInMonth }, (_, i) => {
      const d     = i + 1;
      const day   = `${thisMonth}-${String(d).padStart(2, '0')}`;
      const label = `${now.toLocaleString('default', { month: 'short' })} ${d}`;
      return { day, label, total: sum(thisMonthExp.filter((e) => e.date === day)) };
    });

    return {
      totalThisMonth, totalLastMonth, countThisMonth,
      avgPerDay, topCategory, monthOverMonth,
      categoryBreakdown, dailyThisMonth, totalAllTime,
    };
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function sum(expenses: Expense[]): number {
  return expenses.reduce((acc, e) => acc + e.amount, 0);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
