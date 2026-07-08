import { UrlListComponent } from './url-list.component';

describe('trendOf', () => {
  it('up when last score higher than previous', () => {
    expect(UrlListComponent.trendOf([{ t: '', score: 40, lcp: 0, cls: 0, tbt: 0 }, { t: '', score: 50, lcp: 0, cls: 0, tbt: 0 }])).toBe('up');
  });
  it('down when last lower', () => {
    expect(UrlListComponent.trendOf([{ t: '', score: 50, lcp: 0, cls: 0, tbt: 0 }, { t: '', score: 40, lcp: 0, cls: 0, tbt: 0 }])).toBe('down');
  });
  it('flat with fewer than 2 points', () => {
    expect(UrlListComponent.trendOf([])).toBe('flat');
  });
});

describe('titleFor', () => {
  it('uses the label when present', () => {
    expect(UrlListComponent.titleFor({ url: 'https://a.com/', label: 'UAT Environment' })).toBe('UAT Environment');
  });
  it('falls back to the hostname when label is null', () => {
    expect(UrlListComponent.titleFor({ url: 'https://xq-booking-uat.newshore.es/', label: null })).toBe('xq-booking-uat.newshore.es');
  });
  it('strips protocol and trailing slash for the hostname fallback', () => {
    expect(UrlListComponent.titleFor({ url: 'http://example.com/path/', label: null })).toBe('example.com/path');
  });
});
