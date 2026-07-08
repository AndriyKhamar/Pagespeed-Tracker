export interface StatusStyle { color: string; bg: string; }

export function statusStyle(score: number, threshold: number): StatusStyle {
  return score >= threshold
    ? { color: '#2f9e44', bg: '#e6f6ea' }
    : { color: '#e03131', bg: '#fdecec' };
}
