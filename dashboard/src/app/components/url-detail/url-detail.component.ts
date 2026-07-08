import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '../../services/data.service';
import { SeriesPoint, SummaryFile } from '../../models/psi.model';
import { MetricChartComponent, MetricKey } from '../metric-chart/metric-chart.component';
import { statusStyle } from '../../shared/status-style';

const RAW_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'fcp', label: 'FCP' }, { key: 'lcp', label: 'LCP' }, { key: 'tbt', label: 'TBT' },
  { key: 'cls', label: 'CLS' }, { key: 'si', label: 'SI' }
];

export function metricValueFor(point: SeriesPoint | undefined, key: MetricKey): string {
  if (!point) return '—';
  const v = (point as any)[key];
  if (v == null) return '—';
  return key === 'cls' ? String(v) : `${v}ms`;
}

export function ringGradient(score: number | undefined, color: string): string {
  const pct = score ?? 0;
  return `conic-gradient(${color} 0% ${pct}%, #eef0f4 ${pct}% 100%)`;
}

@Component({
  selector: 'app-url-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MetricChartComponent],
  template: `
    <div class="page">
      <a routerLink="/" style="color:#3d5afe;font-weight:600;font-size:13px;text-decoration:none;">← Back to all URLs</a>
      <ng-container *ngIf="summary as s">
        <h1 style="font-size:20px;margin:12px 0 4px;color:#1a1a2e;">{{ s.label || s.url }}</h1>
        <p style="font-size:12px;color:#8a8f98;margin:0 0 16px;">{{ s.url }} · updated {{ s.updatedAt || '—' }}</p>

        <div style="display:flex;gap:18px;flex-wrap:wrap;">
          <div *ngFor="let strat of strategies" style="background:#fff;border:1px solid #e2e5ea;border-radius:14px;padding:22px 26px;min-width:340px;box-shadow:0 2px 8px rgba(30,40,80,.06);">
            <ng-container *ngIf="cardData(s, strat) as c">
              <div style="display:flex;align-items:center;gap:16px;">
                <div [style.background]="c.gradient" style="width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;">
                  <div [style.color]="c.color" style="width:48px;height:48px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;">{{ c.score ?? '—' }}</div>
                </div>
                <div>
                  <div style="font-size:12px;font-weight:600;color:#8a8f98;">{{ strat === 'mobile' ? '📱 MOBILE' : '🖥️ DESKTOP' }}</div>
                  <span [style.background]="c.bg" [style.color]="c.color" style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;">target {{ c.threshold }}</span>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:16px;text-align:center;">
                <div *ngFor="let m of c.metrics" style="background:#f4f6fb;border-radius:8px;padding:8px 2px;">
                  <div style="font-size:11px;font-weight:800;color:#3a3f4a;">{{ m.label }}</div>
                  <div style="font-size:13px;font-weight:400;color:#1a1a2e;">{{ m.value }}</div>
                </div>
              </div>
            </ng-container>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:20px;margin-top:24px;">
          <app-metric-chart metric="score" [mobile]="s.series.mobile" [desktop]="s.series.desktop" [thresholds]="s.thresholds"></app-metric-chart>
          <app-metric-chart *ngFor="let m of rawMetrics" [metric]="m.key" [mobile]="s.series.mobile" [desktop]="s.series.desktop"></app-metric-chart>
        </div>
      </ng-container>
    </div>
  `
})
export class UrlDetailComponent implements OnInit {
  private data = inject(DataService);
  private route = inject(ActivatedRoute);
  summary?: SummaryFile;
  rawMetrics = RAW_METRICS;
  strategies = ['mobile', 'desktop'] as const;

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.data.getSummary(slug).subscribe((s) => (this.summary = s));
  }

  private latest(s: SummaryFile, strategy: 'mobile' | 'desktop'): SeriesPoint | undefined {
    const a = s.series[strategy];
    return a[a.length - 1];
  }

  cardData(s: SummaryFile, strategy: 'mobile' | 'desktop') {
    const point = this.latest(s, strategy);
    const threshold = s.thresholds[strategy];
    const style = statusStyle(point?.score ?? 0, threshold);
    return {
      score: point?.score ?? null,
      color: style.color,
      bg: style.bg,
      gradient: ringGradient(point?.score, style.color),
      threshold,
      metrics: RAW_METRICS.map((m) => ({ label: m.label, value: metricValueFor(point, m.key) }))
    };
  }
}
