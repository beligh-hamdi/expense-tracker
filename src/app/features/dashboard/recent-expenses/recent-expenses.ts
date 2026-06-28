import { Component, input, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoModule } from '@jsverse/transloco';
import { Expense } from '@shared/models/expense.model';
import { Category } from '@shared/models/category.model';
import { LanguageService } from '@core/i18n/language.service';

@Component({
  selector: 'app-recent-expenses',
  imports: [
    CurrencyPipe, DatePipe, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule, MatDividerModule,
    TranslocoModule,
  ],
  templateUrl: './recent-expenses.html',
  styleUrl: './recent-expenses.scss',
})
export class RecentExpensesComponent {
  readonly expenses = input.required<Expense[]>();
  readonly categories = input.required<Category[]>();

  readonly catMap = computed(() =>
    Object.fromEntries(this.categories().map((c) => [c.id, c]))
  );

  readonly recent = computed(() =>
    [...this.expenses()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
  );
}
