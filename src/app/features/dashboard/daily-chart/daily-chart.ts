import { Component, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoModule } from '@jsverse/transloco';
import { ChartConfiguration } from 'chart.js';
import { ChartComponent } from '@shared/components/chart/chart';
import { resolveMatToken } from '@shared/utils/mat-colors.util';
import { DashboardStats } from '../dashboard.service';

@Component({
  selector: 'app-daily-chart',
  imports: [MatCardModule, TranslocoModule, ChartComponent],
  templateUrl: './daily-chart.html',
  styleUrl: './daily-chart.scss',
})
export class DailyChartComponent {
  readonly stats = input.required<DashboardStats>();

  readonly monthLabel = computed(() =>
    new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
  );

  readonly config = computed<ChartConfiguration>(() => {
    const today      = new Date().getDate();
    const pastPoints = (this.stats().dailyThisMonth ?? []).slice(0, today);
    const primary    = resolveMatToken('--mat-sys-primary')            || '#6750a4';
    const fill       = resolveMatToken('--mat-sys-primary-container')  || '#eaddff';
    const text       = resolveMatToken('--mat-sys-on-surface-variant') || '#6b7280';
    const gridColor  = resolveMatToken('--mat-sys-outline-variant')    || '#cac4d0';
    return {
      type: 'line',
      data: {
        labels: pastPoints.map((p) => p.label),
        datasets: [{
          label: 'Daily spend',
          data: pastPoints.map((p) => p.total),
          borderColor: primary,
          backgroundColor: fill,
          pointBackgroundColor: primary,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
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
