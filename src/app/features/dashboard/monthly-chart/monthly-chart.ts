import { Component, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoModule } from '@jsverse/transloco';
import { ChartConfiguration } from 'chart.js';
import { ChartComponent } from '@shared/components/chart/chart';
import { resolveMatToken } from '@shared/utils/mat-colors.util';
import { DashboardStats } from '../dashboard.service';

@Component({
  selector: 'app-monthly-chart',
  imports: [MatCardModule, TranslocoModule, ChartComponent],
  templateUrl: './monthly-chart.html',
  styleUrl: './monthly-chart.scss',
})
export class MonthlyChartComponent {
  readonly stats = input.required<DashboardStats>();

  readonly config = computed<ChartConfiguration>(() => {
    const months    = this.stats().monthOverMonth ?? [];
    const primary   = resolveMatToken('--mat-sys-primary')            || '#6750a4';
    const muted     = resolveMatToken('--mat-sys-primary-container')  || '#eaddff';
    const text      = resolveMatToken('--mat-sys-on-surface-variant') || '#6b7280';
    const gridColor = resolveMatToken('--mat-sys-outline-variant')    || '#cac4d0';
    return {
      type: 'bar',
      data: {
        labels: months.map((m) => m.label),
        datasets: [{
          label: 'Total spent',
          data: months.map((m) => m.total),
          backgroundColor: months.map((_, i) =>
            i === months.length - 1 ? primary : muted
          ),
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: text, callback: (v) => `$${v}` },
            border: { color: gridColor },
          },
          x: {
            grid: { display: false },
            ticks: { color: text },
            border: { color: gridColor },
          },
        },
      },
    };
  });
}
