import { TestBed } from '@angular/core/testing';
import { MetricChartComponent, chartTitle, metricCaption } from './metric-chart.component';

describe('chartTitle', () => {
  it('drops the /100 suffix for score', () => {
    expect(chartTitle('score')).toBe('Performance score');
  });
  it('includes the unit for timing metrics', () => {
    expect(chartTitle('lcp')).toBe('LCP (ms)');
    expect(chartTitle('fcp')).toBe('FCP (ms)');
    expect(chartTitle('tbt')).toBe('TBT (ms)');
    expect(chartTitle('si')).toBe('SI (ms)');
  });
  it('has no unit for the unitless CLS metric', () => {
    expect(chartTitle('cls')).toBe('CLS');
  });
});

describe('metricCaption', () => {
  it('explains every metric in plain English, lower/higher guidance included', () => {
    expect(metricCaption('score')).toContain('Higher is better');
    expect(metricCaption('fcp')).toContain('Lower is better');
    expect(metricCaption('lcp')).toContain('Lower is better');
    expect(metricCaption('tbt')).toContain('Lower is better');
    expect(metricCaption('cls')).toContain('Lower is better');
    expect(metricCaption('si')).toContain('Lower is better');
  });
});

describe('MetricChartComponent', () => {
  it('creates and renders a canvas', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('metric', 'score');
    fixture.componentRef.setInput('mobile', [{ t: '2026-07-06T14:00:00Z', score: 47, lcp: 1, cls: 0, tbt: 1 }]);
    fixture.componentRef.setInput('desktop', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('canvas')).toBeTruthy();
  });

  it('shows a target legend entry only for the score metric with thresholds set', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('metric', 'lcp');
    fixture.componentRef.setInput('mobile', [{ t: '2026-07-06T14:00:00Z', score: 47, lcp: 1, cls: 0, tbt: 1 }]);
    fixture.componentRef.setInput('desktop', [{ t: '2026-07-06T14:00:00Z', score: 88, lcp: 1, cls: 0, tbt: 1 }]);
    fixture.componentRef.setInput('thresholds', { mobile: 50, desktop: 66 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('target');

    fixture.componentRef.setInput('metric', 'score');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('mobile target (50)');
    expect(fixture.nativeElement.textContent).toContain('desktop target (66)');
  });

  it('drops points missing the current metric instead of feeding Chart.js an undefined y-value', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('metric', 'fcp');
    fixture.componentRef.setInput('mobile', [
      { t: '2026-07-08T10:00:00Z', score: 47, lcp: 6423, cls: 0, tbt: 478 }, // old data point, no fcp
      { t: '2026-07-08T12:00:00Z', score: 54, fcp: 4585, lcp: 11002, tbt: 193, cls: 0, si: 10773 }
    ]);
    fixture.componentRef.setInput('desktop', []);
    fixture.detectChanges();

    const chart = (fixture.componentInstance as any).chart;
    expect(chart.data.datasets[0].data).toEqual([{ x: new Date('2026-07-08T12:00:00Z').getTime(), y: 4585 }]);
  });

  it('gives the y-axis a non-zero range when every value is identical (e.g. CLS stuck at 0)', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('metric', 'cls');
    fixture.componentRef.setInput('mobile', [
      { t: '2026-07-08T10:00:00Z', score: 47, lcp: 6423, cls: 0, tbt: 478 },
      { t: '2026-07-08T12:00:00Z', score: 54, lcp: 11002, cls: 0, tbt: 193 }
    ]);
    fixture.componentRef.setInput('desktop', [
      { t: '2026-07-08T10:00:00Z', score: 29, lcp: 8917, cls: 0, tbt: 4649 },
      { t: '2026-07-08T12:00:00Z', score: 66, lcp: 3478, cls: 0, tbt: 207 }
    ]);

    const start = Date.now();
    fixture.detectChanges();
    expect(Date.now() - start).toBeLessThan(1000);

    const chart = (fixture.componentInstance as any).chart;
    expect(chart.options.scales!['y'].min).toBe(0);
    expect(chart.options.scales!['y'].max).toBe(1);
  });

  it('destroys the chart instance on component teardown', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('metric', 'score');
    fixture.componentRef.setInput('mobile', [{ t: '2026-07-06T14:00:00Z', score: 47, lcp: 1, cls: 0, tbt: 1 }]);
    fixture.componentRef.setInput('desktop', []);
    fixture.detectChanges();

    const chart = (fixture.componentInstance as any).chart;
    expect(chart).toBeTruthy();
    const destroySpy = spyOn(chart, 'destroy').and.callThrough();

    fixture.destroy();

    expect(destroySpy).toHaveBeenCalled();
  });
});
