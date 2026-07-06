import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '../../services/data.service';
import { SeriesPoint, SummaryFile } from '../../models/psi.model';
import { MetricChartComponent } from '../metric-chart/metric-chart.component';

@Component({
  selector: 'app-url-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MetricChartComponent],
  template: `
    <a routerLink="/">← back</a>
    <ng-container *ngIf="summary as s">
      <h1>{{ s.url }}</h1>
      <p>Updated {{ s.updatedAt || '—' }}</p>
      <div style="display:flex; gap:1rem; margin: 0.5rem 0 1rem;">
        <div style="border:1px solid #ccc; border-radius:4px; padding:0.5rem 1rem;">
          <strong>Mobile</strong>
          <div>Score: {{ latest('mobile')?.score ?? '—' }}<ng-container *ngIf="latest('mobile')">/100</ng-container></div>
          <div>LCP: {{ latest('mobile')?.lcp ?? '—' }}<ng-container *ngIf="latest('mobile')"> ms</ng-container></div>
          <div>CLS: {{ latest('mobile')?.cls ?? '—' }}</div>
          <div>TBT: {{ latest('mobile')?.tbt ?? '—' }}<ng-container *ngIf="latest('mobile')"> ms</ng-container></div>
          <div>Threshold: {{ s.thresholds.mobile }}</div>
        </div>
        <div style="border:1px solid #ccc; border-radius:4px; padding:0.5rem 1rem;">
          <strong>Desktop</strong>
          <div>Score: {{ latest('desktop')?.score ?? '—' }}<ng-container *ngIf="latest('desktop')">/100</ng-container></div>
          <div>LCP: {{ latest('desktop')?.lcp ?? '—' }}<ng-container *ngIf="latest('desktop')"> ms</ng-container></div>
          <div>CLS: {{ latest('desktop')?.cls ?? '—' }}</div>
          <div>TBT: {{ latest('desktop')?.tbt ?? '—' }}<ng-container *ngIf="latest('desktop')"> ms</ng-container></div>
          <div>Threshold: {{ s.thresholds.desktop }}</div>
        </div>
      </div>
      <app-metric-chart title="Performance score (/100)" metric="score" [mobile]="s.series.mobile" [desktop]="s.series.desktop"></app-metric-chart>
      <app-metric-chart title="LCP (ms)" metric="lcp" [mobile]="s.series.mobile" [desktop]="s.series.desktop"></app-metric-chart>
      <app-metric-chart title="CLS" metric="cls" [mobile]="s.series.mobile" [desktop]="s.series.desktop"></app-metric-chart>
      <app-metric-chart title="TBT (ms)" metric="tbt" [mobile]="s.series.mobile" [desktop]="s.series.desktop"></app-metric-chart>
    </ng-container>
  `
})
export class UrlDetailComponent implements OnInit {
  private data = inject(DataService);
  private route = inject(ActivatedRoute);
  summary?: SummaryFile;
  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.data.getSummary(slug).subscribe((s) => (this.summary = s));
  }
  latest(strategy: 'mobile' | 'desktop'): SeriesPoint | undefined {
    const a = this.summary!.series[strategy];
    return a[a.length - 1];
  }
}
