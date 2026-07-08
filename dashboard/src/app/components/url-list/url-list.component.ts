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
  template: `
    <div class="page">
      <h1 style="font-size:20px;margin-bottom:16px;color:#1a1a2e;">Monitored Environments</h1>
      <div *ngFor="let s of summaries" style="margin-bottom:16px;">
        <div style="background:#fff;border:1px solid #d7dbe4;border-radius:999px;padding:10px 12px 10px 22px;display:flex;align-items:center;gap:20px;max-width:520px;box-shadow:0 4px 14px rgba(30,40,80,.12);">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:15px;color:#1a1a2e;">{{ titleFor(s) }}</div>
            <div style="font-size:11px;color:#8a8f98;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ s.url }}</div>
          </div>
          <div style="text-align:center;">
            <div style="display:flex;align-items:baseline;gap:2px;justify-content:center;">
              <span [style.color]="scoreColor(s, 'mobile')" style="font-size:20px;font-weight:700;">{{ last(s, 'mobile')?.score ?? '—' }}</span>
              <span style="font-size:11px;color:#b0b5bd;">{{ badge(s, 'mobile') }}</span>
            </div>
            <div style="font-size:10px;color:#8a8f98;">📱 mobile</div>
          </div>
          <div style="text-align:center;">
            <div style="display:flex;align-items:baseline;gap:2px;justify-content:center;">
              <span [style.color]="scoreColor(s, 'desktop')" style="font-size:20px;font-weight:700;">{{ last(s, 'desktop')?.score ?? '—' }}</span>
              <span style="font-size:11px;color:#b0b5bd;">{{ badge(s, 'desktop') }}</span>
            </div>
            <div style="font-size:10px;color:#8a8f98;">🖥️ desktop</div>
          </div>
          <a [routerLink]="['/url', s.slug]" style="background:#3d5afe;color:#fff;padding:8px 18px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;">Details →</a>
        </div>
      </div>
      <p *ngIf="summaries.length === 0">No data yet.</p>
    </div>
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
