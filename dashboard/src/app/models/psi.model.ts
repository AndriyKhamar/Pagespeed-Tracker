export interface SeriesPoint { t: string; score: number; lcp: number; cls: number; tbt: number; fcp?: number; si?: number; }
export interface Thresholds { mobile: number; desktop: number; }
export interface SummaryFile {
  url: string; slug: string; label: string | null; updatedAt: string | null;
  series: { mobile: SeriesPoint[]; desktop: SeriesPoint[] };
  thresholds: Thresholds;
}
export interface IndexFile { slugs: string[]; generatedAt: string; }
