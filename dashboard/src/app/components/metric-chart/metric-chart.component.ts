import { Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, AfterViewInit, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SeriesPoint, Thresholds } from '../../models/psi.model';

Chart.register(...registerables);

export type MetricKey = 'score' | 'fcp' | 'lcp' | 'cls' | 'tbt' | 'si';

const TITLES: Record<MetricKey, string> = {
  score: 'Performance score', fcp: 'FCP (ms)', lcp: 'LCP (ms)', tbt: 'TBT (ms)', cls: 'CLS', si: 'SI (ms)'
};

const CAPTIONS: Record<MetricKey, string> = {
  score: 'Overall health of the page, 0–100. Higher is better.',
  fcp: 'How long until the first bit of content appears on screen. Lower is better.',
  lcp: 'How long until the main content (hero image, headline) is visible. Lower is better.',
  tbt: 'How long the page is too busy to respond to clicks/taps while loading. Lower is better.',
  cls: 'How much page elements jump around while loading. Lower is better.',
  si: 'How quickly the page fills in visually as it loads. Lower is better.'
};

export function chartTitle(metric: MetricKey): string { return TITLES[metric]; }
export function metricCaption(metric: MetricKey): string { return CAPTIONS[metric]; }

@Component({
  selector: 'app-metric-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metric-chart.component.html',
  styleUrl: './metric-chart.component.scss'
})
export class MetricChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() metric: MetricKey = 'score';
  @Input() mobile: SeriesPoint[] = [];
  @Input() desktop: SeriesPoint[] = [];
  @Input() thresholds?: Thresholds;
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;
  chart?: Chart;

  chartTitle = chartTitle;
  metricCaption = metricCaption;

  private zone = inject(NgZone);
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;

  ngAfterViewInit() {
    this.render();
    // One shared window listener instead of Chart.js's per-instance ResizeObserver
    // (which loops when it measures an unstable container). Outside Angular's zone so
    // it doesn't trigger change detection.
    this.zone.runOutsideAngular(() => window.addEventListener('resize', this.onResize));
  }
  ngOnChanges() { if (this.canvas) this.render(); }
  ngOnDestroy() {
    this.chart?.destroy();
    window.removeEventListener('resize', this.onResize);
    clearTimeout(this.resizeTimer);
  }

  private onResize = () => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.fit(), 150);
  };

  private fit() {
    const parent = this.canvas?.nativeElement.parentElement;
    if (this.chart && parent) this.chart.resize(parent.clientWidth, parent.clientHeight);
  }

  // Points as {x: epoch ms, y} so the x-axis is a real time axis (fixed window, gaps shown).
  private line(points: SeriesPoint[]) {
    return points
      .filter((p) => (p as any)[this.metric] != null)
      .map((p) => ({ x: new Date(p.t).getTime(), y: (p as any)[this.metric] as number }));
  }

  private yScaleBounds(mobileLine: { y: number }[], desktopLine: { y: number }[]) {
    if (this.metric === 'score') return { min: 0, max: 100 };
    // Chart.js's auto-range hangs computing ticks when min === max (e.g. CLS staying at 0
    // across every point) — give it an explicit non-zero range in that case.
    const values = [...mobileLine, ...desktopLine].map((d) => d.y);
    if (values.length === 0) return {};
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min !== max) return {};
    return { min: 0, max: max === 0 ? 1 : max * 1.2 };
  }

  private render() {
    const mobileLine = this.line(this.mobile);
    const desktopLine = this.line(this.desktop);
    // Fixed trailing window so sparse data shows in context, empty space where no data yet.
    const winEnd = Date.now();
    const winStart = winEnd - WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const datasets: any[] = [
      { label: 'mobile', data: mobileLine, borderColor: '#e8710a', backgroundColor: 'rgba(232,113,10,0.08)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 },
      { label: 'desktop', data: desktopLine, borderColor: '#1a73e8', backgroundColor: 'rgba(26,115,232,0.08)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 }
    ];
    if (this.metric === 'score' && this.thresholds) {
      const span = (value: number) => [{ x: winStart, y: value }, { x: winEnd, y: value }];
      if (this.mobile.length) datasets.push({ label: 'mobile target', data: span(this.thresholds.mobile), borderColor: '#e8710a', borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, fill: false });
      if (this.desktop.length) datasets.push({ label: 'desktop target', data: span(this.thresholds.desktop), borderColor: '#1a73e8', borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, fill: false });
    }
    const cfg: ChartConfiguration = {
      type: 'line',
      data: { datasets },
      options: {
        // responsive:false → no Chart.js ResizeObserver (its per-instance observer loops
        // when it measures an unstable container). We size the canvas ourselves via fit().
        responsive: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          title: { display: false }, legend: { display: false },
          tooltip: { callbacks: { title: (items) => fullStamp(items[0]?.parsed?.x) } }
        },
        scales: {
          x: {
            type: 'linear',
            min: winStart, max: winEnd,
            grid: { display: false },
            ticks: {
              maxTicksLimit: 8, maxRotation: 0,
              callback: (value) => dayLabel(value as number)
            }
          },
          y: { grid: { color: '#eef0f4' }, ...this.yScaleBounds(mobileLine, desktopLine) }
        }
      }
    };
    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, cfg);
    this.fit();
  }
}

const WINDOW_DAYS = 15;

function dayLabel(epochMs: number): string {
  const d = new Date(epochMs);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fullStamp(epochMs?: number | null): string {
  if (epochMs == null) return '';
  const d = new Date(epochMs);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
