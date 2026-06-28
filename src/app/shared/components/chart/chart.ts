import {
  Component, ElementRef, OnDestroy,
  effect, input, viewChild,
} from '@angular/core';
import {
  Chart, ChartConfiguration, ChartType,
  ArcElement, DoughnutController,
  LineElement, LineController, PointElement,
  BarElement, BarController,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { resolveMatToken } from '@shared/utils/mat-colors.util';

// Register only the components we use (tree-shakeable)
Chart.register(
  ArcElement, DoughnutController,
  LineElement, LineController, PointElement,
  BarElement, BarController,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
);

/** Apply M3 system colors to Chart.js global defaults. Called before every chart render. */
function applyMatDefaults(): void {
  // Resolve tokens; always fall back to visible non-black values
  const text    = resolveMatToken('--mat-sys-on-surface-variant') || '#6b7280';
  const onSurf  = resolveMatToken('--mat-sys-on-surface')         || '#1c1b1f';
  const grid    = resolveMatToken('--mat-sys-outline-variant')    || '#cac4d0';
  const surface = resolveMatToken('--mat-sys-surface-container')  || '#f3edf7';

  // Global font & tick color — overrides Chart.js black default
  Chart.defaults.color = text;

  // Grid lines
  Chart.defaults.borderColor = grid;

  // Tooltip
  Chart.defaults.plugins.tooltip.backgroundColor = surface;
  Chart.defaults.plugins.tooltip.titleColor      = onSurf;
  Chart.defaults.plugins.tooltip.bodyColor       = text;
  Chart.defaults.plugins.tooltip.borderColor     = grid;
  Chart.defaults.plugins.tooltip.borderWidth     = 1;
  Chart.defaults.plugins.tooltip.padding         = 10;
  Chart.defaults.plugins.tooltip.cornerRadius    = 8;
}

@Component({
  selector: 'app-chart',
  templateUrl: './chart.html',
  styleUrl: './chart.scss',
})
export class ChartComponent implements OnDestroy {
  readonly type   = input.required<ChartType>();
  readonly config = input.required<ChartConfiguration>();

  readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private chart: Chart | null = null;

  constructor() {
    // Runs after view init and whenever config changes — recreates the chart
    effect(() => {
      const canvas = this.canvasRef();
      const cfg    = this.config();
      if (!canvas || !cfg) return;
      // Re-apply M3 defaults on every render so dark/light theme switches take effect
      applyMatDefaults();
      this.chart?.destroy();
      this.chart = new Chart(canvas.nativeElement, cfg);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
