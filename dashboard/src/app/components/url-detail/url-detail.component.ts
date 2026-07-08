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
  switch (key) {
    case 'cls': return v.toFixed(2);                 // unitless, 2 decimals
    case 'tbt': return `${Math.round(v)} ms`;        // ms, whole number
    case 'fcp': case 'lcp': case 'si': return `${(v / 1000).toFixed(1)} s`; // seconds, 1 decimal
    default: return String(v);
  }
}

export function ringGradient(score: number | undefined, color: string): string {
  const pct = score ?? 0;
  return `conic-gradient(${color} 0% ${pct}%, #eef0f4 ${pct}% 100%)`;
}

export interface Visibility { mobile: boolean; desktop: boolean; }

// Toggle a strategy on/off, but never allow both off (at least one series always shown).
export function nextVisibility(cur: Visibility, strat: 'mobile' | 'desktop'): Visibility {
  const next = { ...cur, [strat]: !cur[strat] };
  return next.mobile || next.desktop ? next : cur;
}

const EMPTY: SeriesPoint[] = [];

@Component({
  selector: 'app-url-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MetricChartComponent],
  templateUrl: './url-detail.component.html',
  styleUrl: './url-detail.component.scss'
})
export class UrlDetailComponent implements OnInit {
  private data = inject(DataService);
  private route = inject(ActivatedRoute);
  summary?: SummaryFile;
  rawMetrics = RAW_METRICS;
  strategies = ['mobile', 'desktop'] as const;

  visible: Visibility = { mobile: true, desktop: true };
  // Series passed to the charts — stable references (recomputed only on toggle/load) so
  // the charts don't re-render every change-detection cycle.
  mobileSeries: SeriesPoint[] = EMPTY;
  desktopSeries: SeriesPoint[] = EMPTY;

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.data.getSummary(slug).subscribe((s) => { this.summary = s; this.applyVisibility(); });
  }

  toggle(strat: 'mobile' | 'desktop') {
    this.visible = nextVisibility(this.visible, strat);
    this.applyVisibility();
  }

  private applyVisibility() {
    const s = this.summary;
    if (!s) return;
    this.mobileSeries = this.visible.mobile ? s.series.mobile : EMPTY;
    this.desktopSeries = this.visible.desktop ? s.series.desktop : EMPTY;
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
