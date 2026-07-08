import { statusStyle } from './status-style';

describe('statusStyle', () => {
  it('returns green when score meets the threshold exactly', () => {
    expect(statusStyle(50, 50)).toEqual({ color: '#2f9e44', bg: '#e6f6ea' });
  });
  it('returns green when score exceeds the threshold', () => {
    expect(statusStyle(70, 50).color).toBe('#2f9e44');
  });
  it('returns red when score is below the threshold', () => {
    expect(statusStyle(40, 50)).toEqual({ color: '#e03131', bg: '#fdecec' });
  });
});
