export type Status = "to_apply" | "applied" | "interviewing" | "offer" | "rejected" | "archived";
export const STATUSES: Status[] = ["to_apply", "applied", "interviewing", "offer", "rejected", "archived"];

export type Eligibility = "eligible" | "ineligible" | "unknown";

export interface RawJob {
  company: string;
  title: string;
  location: string | null;
  remote: boolean;
  salary: string | null;
  url: string;
  description: string;
  postedAt: string | null; // ISO
  geoRaw: string | null; // source-provided location-restriction text, null if none
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
  hasTailored: boolean;
  hasKit: boolean;
  eligibility: Eligibility;
  eligibilityReason: string | null;
  starred: boolean;
  seenAt: string | null;
  aiFriendly: number | null;
  isInternship: boolean;
  payTier: string | null;
  region: string | null;
}

export interface Contact {
  jobId: string;
  company: string;
  personName: string | null;
  personTitle: string | null;
  emails: string[];
  links: string[];
  source: string;
  confidence: "found" | "guessed" | "none";
}

export interface Kit {
  resumeMd: string;
  coverMd: string;
  outreachMd: string;
  model: string;
  createdAt: string;
}

export interface JobSource {
  id: string;
  fetch(): Promise<RawJob[]>;
}

export interface MatchResult {
  id: string;
  score: number;
  reason: string;
  eligible: "yes" | "no" | "unclear";
  eligibilityReason: string;
  aiFriendly: number;
}
export interface DeepMatch { score: number; summary: string; gaps: string[]; tailoring: string[]; }

export interface GeminiClient {
  generateJSON(model: string, prompt: string): Promise<string>;
}
