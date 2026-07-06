import { TestBed } from '@angular/core/testing';
import { MetricChartComponent } from './metric-chart.component';

describe('MetricChartComponent', () => {
  it('creates and renders a canvas', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('title', 'Score');
    fixture.componentRef.setInput('metric', 'score');
    fixture.componentRef.setInput('mobile', [{ t: '2026-07-06T14:00:00Z', score: 47, lcp: 1, cls: 0, tbt: 1 }]);
    fixture.componentRef.setInput('desktop', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('canvas')).toBeTruthy();
  });

  it('destroys the chart instance on component teardown', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('title', 'Score');
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
