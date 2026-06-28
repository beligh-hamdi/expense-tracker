import { Service, inject, signal, computed, SecurityContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';
import { LanguageService } from '@core/i18n/language.service';
import { ExpensesService } from '@features/expenses/expenses.service';
import { DashboardService } from '@features/dashboard/dashboard.service';
import { Expense } from '@shared/models/expense.model';
import { Category } from '@shared/models/category.model';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
    finishReason: string;
  }>;
}

@Service()
export class InsightsService {
  readonly sheetConfig          = inject(SheetConfigService);
  private readonly expensesSvc  = inject(ExpensesService);
  private readonly dashSvc      = inject(DashboardService);
  private readonly http         = inject(HttpClient);
  private readonly sanitizer    = inject(DomSanitizer);
  private readonly snack        = inject(MatSnackBar);
  private readonly transloco    = inject(TranslocoService);
  private readonly lang         = inject(LanguageService);

  // ── Private writable state ─────────────────────────────────────────────────

  private readonly _loading      = signal(false);
  private readonly _rawMarkdown  = signal<string | null>(null);
  private readonly _renderedHtml = signal<string>('');
  private readonly _lastRun      = signal<string | null>(null);

  // ── Public read-only ───────────────────────────────────────────────────────

  readonly loading      = this._loading.asReadonly();
  readonly rawMarkdown  = this._rawMarkdown.asReadonly();
  readonly renderedHtml = this._renderedHtml.asReadonly();
  readonly lastRun      = this._lastRun.asReadonly();

  readonly expenses    = this.expensesSvc.expenses;
  readonly categories  = this.expensesSvc.categories;
  readonly dataLoading = this.expensesSvc.loading;

  readonly hasExpenses = computed(() => this.expenses().length > 0);
  readonly hasResult   = computed(() => !!this._rawMarkdown());
  readonly isRtl       = computed(() => this.lang.activeLang() === 'ar');

  // ── Actions ────────────────────────────────────────────────────────────────

  async runAnalysis(): Promise<void> {
    this._loading.set(true);
    try {
      const markdown = await this.generateInsights(this.expenses(), this.categories());
      const { marked } = await import('marked');
      const html = await marked(markdown, { async: false }) as string;
      const safeHtml = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
      this._rawMarkdown.set(markdown);
      this._renderedHtml.set(safeHtml);
      this._lastRun.set(new Date().toLocaleTimeString());
    } catch (err) {
      this.snack.open(this.errMsg(err), this.t('insights.dismiss'), { duration: 8000 });
    } finally {
      this._loading.set(false);
    }
  }

  // ── Gemini API ─────────────────────────────────────────────────────────────

  private async generateInsights(expenses: Expense[], categories: Category[]): Promise<string> {
    const apiKey = this.sheetConfig.aiApiKey();
    if (!apiKey) {
      throw new Error('No Gemini API key configured. Go to Settings → AI & Insights to add your key.');
    }
    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await firstValueFrom(
      this.http.post<GeminiResponse>(url, {
        contents: [{ parts: [{ text: this.buildPrompt(expenses, categories) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      })
    );
    const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
  }

  // ── Prompt builder ─────────────────────────────────────────────────────────

  private buildPrompt(expenses: Expense[], categories: Category[]): string {
    const catMap  = Object.fromEntries(categories.map((c) => [c.id, c]));
    const stats   = this.dashSvc.compute(expenses, categories);
    const now     = new Date();
    const activeLang  = this.lang.activeLang();
    const langNames: Record<string, string> = { en: 'English', fr: 'French', ar: 'Arabic' };
    const langLabel   = langNames[activeLang] ?? 'English';
    const monthLabel  = now.toLocaleString(activeLang, { month: 'long', year: 'numeric' });

    const breakdownTable = stats.categoryBreakdown
      .map((b) => `| ${this.lang.translateCategoryName(b.category.name)} | $${b.total.toFixed(2)} | ${b.percentOfTotal.toFixed(1)}% | ${b.count} expenses |`)
      .join('\n');

    const monthlyTable = stats.monthOverMonth
      .map((m) => `| ${m.label} | $${m.total.toFixed(2)} |`)
      .join('\n');

    const budgetLines = categories
      .filter((c) => c.budgetLimit > 0)
      .map((c) => {
        const spent = stats.categoryBreakdown.find((b) => b.category.id === c.id)?.total ?? 0;
        const pct   = ((spent / c.budgetLimit) * 100).toFixed(0);
        return `- ${c.name}: spent $${spent.toFixed(2)} of $${c.budgetLimit.toFixed(2)} limit (${pct}%)`;
      })
      .join('\n') || '- No budget limits configured';

    const topExpenses = [...expenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((e) => `- $${e.amount.toFixed(2)} on ${e.date} — ${catMap[e.categoryId]?.name ?? 'Unknown'}: ${e.description || '(no description)'}`)
      .join('\n') || '- No expenses recorded';

    return `You are a personal finance advisor. Analyze the user's expense data below and provide clear, actionable, friendly insights in Markdown format.
IMPORTANT: Respond entirely in ${langLabel}. All section headings, analysis text, and recommendations must be written in ${langLabel} only.

## User's Expense Summary — ${monthLabel}

**This month:** $${stats.totalThisMonth.toFixed(2)} across ${stats.countThisMonth} expenses (avg $${stats.avgPerDay.toFixed(2)}/day)
**Last month:** $${stats.totalLastMonth.toFixed(2)}
**All-time total:** $${stats.totalAllTime.toFixed(2)} across ${expenses.length} expenses

### Spending by Category (this month)
| Category | Amount | % of Total | Count |
|----------|--------|-----------|-------|
${breakdownTable || '| No data | — | — | — |'}

### Monthly Totals (last 6 months)
| Month | Total |
|-------|-------|
${monthlyTable}

### Budget Status
${budgetLines}

### Top 10 Expenses (all time)
${topExpenses}

---

Please provide your analysis with the following sections, using Markdown headings (##):

1. **Key Observations** — 3–5 notable patterns or facts from their data
2. **Potential Savings** — Specific, practical suggestions to reduce spending
3. **Budget Recommendations** — Suggested monthly budget limits for each category based on their actual spending patterns
4. **Positive Habits** — What they are doing well financially
5. **Action Plan** — 3 concrete next steps they should take this month

Be specific with numbers. Be encouraging, not preachy. Keep the total response concise (under 600 words).`;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  errMsg(err: unknown): string {
    return err instanceof Error ? err.message : this.t('insights.an_error_occurred');
  }

  private t(key: string): string {
    return this.transloco.translate(key);
  }
}
