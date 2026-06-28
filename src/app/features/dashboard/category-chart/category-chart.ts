import { Component, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoModule } from '@jsverse/transloco';
import { ChartConfiguration } from 'chart.js';
import { ChartComponent } from '@shared/components/chart/chart';
import { resolveMatToken } from '@shared/utils/mat-colors.util';
import { DashboardStats } from '../dashboard.service';
import { LanguageService } from '@core/i18n/language.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-category-chart',
  imports: [MatCardModule, TranslocoModule, ChartComponent],
  templateUrl: './category-chart.html',
  styleUrl: './category-chart.scss',
})
export class CategoryChartComponent {
  private readonly lang = inject(LanguageService);

  readonly stats = input.required<DashboardStats>();

  readonly barHeight = computed(() =>
    Math.max(160, this.stats().categoryBreakdown.length * 44)
  );

  readonly config = computed<ChartConfiguration>(() => {
    const breakdown = this.stats().categoryBreakdown;
    const textColor = resolveMatToken('--mat-sys-on-surface-variant') || '#666';
    return {
      type: 'bar',
      data: {
        labels: breakdown.map((b) => this.lang.translateCategoryName(b.category.name)),
        datasets: [{
          data:            breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((b) => b.category.color),
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 22,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw as number;
                const pct = breakdown[ctx.dataIndex].percentOfTotal.toFixed(0);
                return ` $${val.toFixed(2)}  (${pct}%)`;
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(128,128,128,0.15)' },
            ticks: { color: textColor, callback: (v) => `$${v}` },
          },
          y: {
            grid: { display: false },
            ticks: { color: textColor },
          },
        },
      },
    };
  });
}
