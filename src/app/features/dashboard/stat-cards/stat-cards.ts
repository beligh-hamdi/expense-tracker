import { Component, input, computed, signal } from '@angular/core';
import { CurrencyPipe, PercentPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslocoModule } from '@jsverse/transloco';
import { DashboardStats } from '../dashboard.service';
import { LanguageService } from '@core/i18n/language.service';
import { inject } from '@angular/core';

export type TotalFilter = 'year' | 'all';

@Component({
  selector: 'app-stat-cards',
  imports: [CurrencyPipe, PercentPipe, MatCardModule, MatIconModule, MatButtonToggleModule, TranslocoModule],
  templateUrl: './stat-cards.html',
  styleUrl: './stat-cards.scss',
})
export class StatCardsComponent {
  private readonly lang = inject(LanguageService);

  readonly stats        = input.required<DashboardStats>();
  readonly expenseCount = input.required<number>();

  readonly totalFilter = signal<TotalFilter>('year');

  catName = (name: string) => this.lang.translateCategoryName(name);

  readonly monthChange = computed(() => {
    const s = this.stats();
    if (!s || s.totalLastMonth === 0) return 0;
    return (s.totalThisMonth - s.totalLastMonth) / s.totalLastMonth;
  });

  readonly topCategoryTotal = computed(() =>
    this.stats()?.categoryBreakdown[0]?.total ?? 0
  );

  readonly displayTotal = computed(() =>
    this.totalFilter() === 'year'
      ? this.stats().totalThisYear
      : this.stats().totalAllTime
  );

  readonly displayCount = computed(() =>
    this.totalFilter() === 'year'
      ? this.stats().countThisYear
      : this.expenseCount()
  );

  setFilter(f: TotalFilter): void { this.totalFilter.set(f); }
}
