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
