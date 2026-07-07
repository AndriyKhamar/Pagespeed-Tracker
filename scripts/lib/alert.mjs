export function shouldAlert({ score, threshold, lastDate, today }) {
  return score < threshold && lastDate !== today;
}
