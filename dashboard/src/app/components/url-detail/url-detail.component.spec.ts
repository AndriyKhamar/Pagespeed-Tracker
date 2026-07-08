import { metricValueFor, ringGradient } from './url-detail.component';

describe('metricValueFor', () => {
  it('returns em-dash when there is no point', () => {
    expect(metricValueFor(undefined, 'lcp')).toBe('—');
  });
  it('returns em-dash when the metric is missing on the point (old data)', () => {
    expect(metricValueFor({ t: '', score: 50, lcp: 1200, cls: 0, tbt: 0 }, 'fcp')).toBe('—');
  });
  it('appends ms for timing metrics', () => {
    expect(metricValueFor({ t: '', score: 50, lcp: 1200, cls: 0.05, tbt: 0 }, 'lcp')).toBe('1200ms');
  });
  it('does not append a unit for CLS', () => {
    expect(metricValueFor({ t: '', score: 50, lcp: 1200, cls: 0.05, tbt: 0 }, 'cls')).toBe('0.05');
  });
});

describe('ringGradient', () => {
  it('builds a conic-gradient stopping at the score percentage', () => {
    expect(ringGradient(62, '#2f9e44')).toBe('conic-gradient(#2f9e44 0% 62%, #eef0f4 62% 100%)');
  });
  it('treats a missing score as 0%', () => {
    expect(ringGradient(undefined, '#e03131')).toBe('conic-gradient(#e03131 0% 0%, #eef0f4 0% 100%)');
  });
});
