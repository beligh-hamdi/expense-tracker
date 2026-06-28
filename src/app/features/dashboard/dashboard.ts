import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@jsverse/transloco';
import { DashboardService } from './dashboard.service';
import { StatCardsComponent } from './stat-cards/stat-cards';
import { CategoryChartComponent } from './category-chart/category-chart';
import { DailyChartComponent } from './daily-chart/daily-chart';
import { MonthlyChartComponent } from './monthly-chart/monthly-chart';
import { BudgetProgressComponent } from './budget-progress/budget-progress';
import { RecentExpensesComponent } from './recent-expenses/recent-expenses';

@Component({
  selector: 'app-dashboard',
  imports: [
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoModule,
    StatCardsComponent,
    CategoryChartComponent,
    DailyChartComponent,
    MonthlyChartComponent,
    BudgetProgressComponent,
    RecentExpensesComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  readonly svc = inject(DashboardService);
}
