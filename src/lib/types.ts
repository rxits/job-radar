export type Status = "to_apply" | "applied" | "interviewing" | "offer" | "rejected" | "archived";
export const STATUSES: Status[] = ["to_apply", "applied", "interviewing", "offer", "rejected", "archived"];

export interface RawJob {
  company: string;
  title: string;
  location: string | null;
  remote: boolean;
  salary: string | null;
  url: string;
  description: string;
  postedAt: string | null; // ISO
}

export interface NormalizedJob extends RawJob {
  source: string;
  dedupeKey: string;
}

export interface JobRow extends NormalizedJob {
  id: string;
  status: Status;
  scrapedAt: string;
  score: number | null;
  reason: string | null;
}

export interface JobSource {
  id: string;
  fetch(): Promise<RawJob[]>;
}

export interface MatchResult { id: string; score: number; reason: string; }
export interface DeepMatch { score: number; summary: string; gaps: string[]; tailoring: string[]; }

export interface GeminiClient {
  generateJSON(model: string, prompt: string): Promise<string>;
}
