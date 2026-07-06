import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '../../services/data.service';
import { SeriesPoint, SummaryFile } from '../../models/psi.model';

@Component({
  selector: 'app-url-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h1>Monitored URLs</h1>
    <ul>
      <li *ngFor="let s of summaries">
        <a [routerLink]="['/url', s.slug]">{{ s.url }}</a>
        <span> mobile {{ last(s, 'mobile')?.score ?? '—' }}/100 {{ badge(s, 'mobile') }}</span>
        <span> · desktop {{ last(s, 'desktop')?.score ?? '—' }}/100 {{ badge(s, 'desktop') }}</span>
      </li>
    </ul>
    <p *ngIf="summaries.length === 0">No data yet.</p>
  `
})
export class UrlListComponent implements OnInit {
  private data = inject(DataService);
  summaries: SummaryFile[] = [];

  ngOnInit() {
    this.data.getIndex().subscribe((idx) => {
      for (const slug of idx.slugs) this.data.getSummary(slug).subscribe((s) => this.summaries.push(s));
    });
  }
  last(s: SummaryFile, strat: 'mobile' | 'desktop'): SeriesPoint | undefined { const a = s.series[strat]; return a[a.length - 1]; }
  badge(s: SummaryFile, strat: 'mobile' | 'desktop') {
    return { up: '▲', down: '▼', flat: '—' }[UrlListComponent.trendOf(s.series[strat])];
  }
  static trendOf(points: SeriesPoint[]): 'up' | 'down' | 'flat' {
    if (points.length < 2) return 'flat';
    const d = points[points.length - 1].score - points[points.length - 2].score;
    return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
  }
}
