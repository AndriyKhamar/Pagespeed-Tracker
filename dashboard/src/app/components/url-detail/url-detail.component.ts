import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../../services/data.service';
import { SummaryFile } from '../../models/psi.model';
import { MetricChartComponent } from '../metric-chart/metric-chart.component';

@Component({
  selector: 'app-url-detail',
  standalone: true,
  imports: [CommonModule, MetricChartComponent],
  template: `
    <a href="#" (click)="$event.preventDefault(); back()">← back</a>
    <ng-container *ngIf="summary as s">
      <h1>{{ s.url }}</h1>
      <p>Updated {{ s.updatedAt || '—' }}</p>
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
  back() { history.back(); }
}
