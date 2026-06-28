import {
  Component, input, output, inject,
  computed, effect, viewChild,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { Expense } from '@shared/models/expense.model';
import { Category } from '@shared/models/category.model';

@Component({
  selector: 'app-expense-list',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslocoModule,
  ],
  templateUrl: './expense-list.html',
  styleUrl: './expense-list.scss',
})
export class ExpenseListComponent {
  private readonly lang = inject(LanguageService);

  readonly expenses  = input.required<Expense[]>();
  readonly categories = input.required<Category[]>();
  readonly loading   = input<boolean>(false);

  readonly edit   = output<Expense>();
  readonly delete = output<Expense>();

  readonly sort      = viewChild(MatSort);
  readonly paginator = viewChild(MatPaginator);

  catName = (name: string) => this.lang.translateCategoryName(name);

  readonly filterValue = signal('');
  readonly displayedColumns = ['date', 'category', 'description', 'amount', 'actions'];
  readonly dataSource = new MatTableDataSource<Expense>([]);

  readonly categoryMap = computed(() =>
    Object.fromEntries(this.categories().map((c) => [c.id, c]))
  );

  readonly totalFiltered = computed(() =>
    this.dataSource.filteredData.reduce((sum, e) => sum + e.amount, 0)
  );

  constructor() {
    // Sync datasource when expenses input changes
    effect(() => {
      this.dataSource.data = this.expenses();
    });

    // Wire sort + paginator once rendered
    effect(() => {
      const sort      = this.sort();
      const paginator = this.paginator();
      if (!sort || !paginator) return;
      this.dataSource.sort      = sort;
      this.dataSource.paginator = paginator;
      this.dataSource.filterPredicate = (expense: Expense, filter: string) => {
        const cat = this.categoryMap()[expense.categoryId];
        const haystack = [expense.description, expense.date, cat?.name ?? '']
          .join(' ').toLowerCase();
        return haystack.includes(filter);
      };
    });
  }

  applyFilter(value: string): void {
    this.dataSource.filter = value.trim().toLowerCase();
  }

  clearFilter(): void {
    this.filterValue.set('');
    this.dataSource.filter = '';
  }
}
