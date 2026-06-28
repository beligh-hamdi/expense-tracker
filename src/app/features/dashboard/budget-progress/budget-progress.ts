import { Component, input, computed, inject } from '@angular/core';
import { CurrencyPipe, PercentPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoModule } from '@jsverse/transloco';
import { DashboardStats } from '../dashboard.service';
import { Category } from '@shared/models/category.model';
import { LanguageService } from '@core/i18n/language.service';

@Component({
  selector: 'app-budget-progress',
  imports: [CurrencyPipe, PercentPipe, MatCardModule, MatIconModule, MatProgressBarModule, TranslocoModule],
  templateUrl: './budget-progress.html',
  styleUrl: './budget-progress.scss',
})
export class BudgetProgressComponent {
  private readonly lang = inject(LanguageService);

  readonly stats = input.required<DashboardStats>();
  readonly categories = input.required<Category[]>();

  catName = (name: string) => this.lang.translateCategoryName(name);

  readonly budgetItems = computed(() => {
    const s = this.stats();
    return this.categories()
      .filter((c) => c.budgetLimit > 0)
      .map((cat) => {
        const breakdown = s.categoryBreakdown.find((b) => b.category.id === cat.id);
        const spent = breakdown?.total ?? 0;
        return { category: cat, spent, pct: spent / cat.budgetLimit };
      });
  });
}
