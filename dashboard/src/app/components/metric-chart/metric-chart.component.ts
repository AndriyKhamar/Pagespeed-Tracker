import { Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
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
  template: `
    <div style="background:#fff;border:1px solid #e2e5ea;border-radius:14px;padding:20px 24px;box-shadow:0 2px 8px rgba(30,40,80,.06);">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div style="font-weight:700;font-size:15px;color:#1a1a2e;">{{ chartTitle(metric) }}</div>
        <div style="font-size:11px;color:#8a8f98;">data collected hourly</div>
      </div>
      <div style="position:relative;height:220px;margin-top:10px;"><canvas #canvas></canvas></div>
      <div style="display:flex;gap:16px;font-size:12px;color:#5a5f6a;margin-top:8px;flex-wrap:wrap;">
        <span><span style="display:inline-block;width:10px;height:10px;background:#e8710a;border-radius:2px;margin-right:4px;"></span>mobile</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#1a73e8;border-radius:2px;margin-right:4px;"></span>desktop</span>
        <span *ngIf="metric === 'score' && thresholds">
          <svg width="16" height="10" style="vertical-align:middle;margin-right:4px;"><line x1="0" y1="5" x2="16" y2="5" stroke="#e8710a" stroke-dasharray="4,3" stroke-width="1.5"></line></svg>mobile target ({{ thresholds.mobile }})
        </span>
        <span *ngIf="metric === 'score' && thresholds">
          <svg width="16" height="10" style="vertical-align:middle;margin-right:4px;"><line x1="0" y1="5" x2="16" y2="5" stroke="#1a73e8" stroke-dasharray="4,3" stroke-width="1.5"></line></svg>desktop target ({{ thresholds.desktop }})
        </span>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #eef0f4;font-size:12px;color:#5a5f6a;line-height:1.5;">{{ metricCaption(metric) }}</div>
    </div>
  `
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

  ngAfterViewInit() { this.render(); }
  ngOnChanges() { if (this.canvas) this.render(); }
  ngOnDestroy() { this.chart?.destroy(); }

  private line(points: SeriesPoint[]) {
    return points.map((p) => ({ x: p.t, y: (p as any)[this.metric] as number }));
  }

  private thresholdLine(points: SeriesPoint[], value: number) {
    return points.map((p) => ({ x: p.t, y: value }));
  }

  private render() {
    const datasets: any[] = [
      { label: 'mobile', data: this.line(this.mobile), borderColor: '#e8710a', tension: 0.2 },
      { label: 'desktop', data: this.line(this.desktop), borderColor: '#1a73e8', tension: 0.2 }
    ];
    if (this.metric === 'score' && this.thresholds) {
      if (this.mobile.length) datasets.push({ data: this.thresholdLine(this.mobile, this.thresholds.mobile), borderColor: '#e8710a', borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 });
      if (this.desktop.length) datasets.push({ data: this.thresholdLine(this.desktop, this.thresholds.desktop), borderColor: '#1a73e8', borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 });
    }
    const cfg: ChartConfiguration = {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: false }, legend: { display: false } },
        scales: {
          x: { type: 'category', grid: { display: false } },
          y: { grid: { color: '#eef0f4' }, ...(this.metric === 'score' ? { min: 0, max: 100 } : {}) }
        }
      }
    };
    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, cfg);
  }
}
