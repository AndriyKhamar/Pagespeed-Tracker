import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '../../services/data.service';
import { SeriesPoint, SummaryFile } from '../../models/psi.model';
import { statusStyle } from '../../shared/status-style';

@Component({
  selector: 'app-url-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './url-list.component.html',
  styleUrl: './url-list.component.scss'
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
  scoreColor(s: SummaryFile, strat: 'mobile' | 'desktop'): string {
    const point = this.last(s, strat);
    return point ? statusStyle(point.score, s.thresholds[strat]).color : '#8a8f98';
  }
  badge(s: SummaryFile, strat: 'mobile' | 'desktop') {
    return { up: '▲', down: '▼', flat: '—' }[UrlListComponent.trendOf(s.series[strat])];
  }
  titleFor(s: SummaryFile): string { return UrlListComponent.titleFor(s); }

  static trendOf(points: SeriesPoint[]): 'up' | 'down' | 'flat' {
    if (points.length < 2) return 'flat';
    const d = points[points.length - 1].score - points[points.length - 2].score;
    return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
  }
  static titleFor(s: { url: string; label: string | null }): string {
    if (s.label) return s.label;
    return s.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}
