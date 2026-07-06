import { Component, ElementRef, Input, OnChanges, ViewChild, AfterViewInit } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SeriesPoint } from '../../models/psi.model';

Chart.register(...registerables);

@Component({
  selector: 'app-metric-chart',
  standalone: true,
  template: `<div style="position:relative;height:260px"><canvas #canvas></canvas></div>`
})
export class MetricChartComponent implements AfterViewInit, OnChanges {
  @Input() title = '';
  @Input() metric: 'score' | 'lcp' | 'cls' | 'tbt' = 'score';
  @Input() mobile: SeriesPoint[] = [];
  @Input() desktop: SeriesPoint[] = [];
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit() { this.render(); }
  ngOnChanges() { if (this.canvas) this.render(); }

  private line(points: SeriesPoint[]) {
    return points.map((p) => ({ x: p.t, y: (p as any)[this.metric] as number }));
  }

  private render() {
    const cfg: ChartConfiguration = {
      type: 'line',
      data: {
        datasets: [
          { label: 'mobile', data: this.line(this.mobile) as any, borderColor: '#e8710a', tension: 0.2 },
          { label: 'desktop', data: this.line(this.desktop) as any, borderColor: '#1a73e8', tension: 0.2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: !!this.title, text: this.title } },
        scales: { x: { type: 'category' } }
      }
    };
    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, cfg);
  }
}
