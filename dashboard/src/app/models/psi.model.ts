export interface SeriesPoint { t: string; score: number; lcp: number; cls: number; tbt: number; }
export interface Thresholds { mobile: number; desktop: number; }
export interface SummaryFile {
  url: string; slug: string; updatedAt: string | null;
  series: { mobile: SeriesPoint[]; desktop: SeriesPoint[] };
  thresholds: Thresholds;
}
export interface IndexFile { slugs: string[]; generatedAt: string; }
