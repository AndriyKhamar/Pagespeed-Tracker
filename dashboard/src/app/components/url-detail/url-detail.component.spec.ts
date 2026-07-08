import { metricValueFor, ringGradient, nextVisibility } from './url-detail.component';

describe('nextVisibility', () => {
  it('toggles a strategy off when the other stays on', () => {
    expect(nextVisibility({ mobile: true, desktop: true }, 'mobile')).toEqual({ mobile: false, desktop: true });
  });
  it('toggles a strategy back on', () => {
    expect(nextVisibility({ mobile: false, desktop: true }, 'mobile')).toEqual({ mobile: true, desktop: true });
  });
  it('refuses to turn the last visible strategy off', () => {
    const cur = { mobile: false, desktop: true };
    expect(nextVisibility(cur, 'desktop')).toBe(cur);
  });
});

describe('metricValueFor', () => {
  it('returns em-dash when there is no point', () => {
    expect(metricValueFor(undefined, 'lcp')).toBe('—');
  });
  it('returns em-dash when the metric is missing on the point (old data)', () => {
    expect(metricValueFor({ t: '', score: 50, lcp: 1200, cls: 0, tbt: 0 }, 'fcp')).toBe('—');
  });
  it('shows LCP/FCP/SI in seconds with one decimal', () => {
    expect(metricValueFor({ t: '', score: 50, lcp: 11002.878, cls: 0.05, tbt: 0 }, 'lcp')).toBe('11.0 s');
  });
  it('rounds TBT to whole milliseconds', () => {
    expect(metricValueFor({ t: '', score: 50, lcp: 1200, cls: 0.05, tbt: 206.999 }, 'tbt')).toBe('207 ms');
  });
  it('shows CLS as a unitless 2-decimal value', () => {
    expect(metricValueFor({ t: '', score: 50, lcp: 1200, cls: 0, tbt: 0 }, 'cls')).toBe('0.00');
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
