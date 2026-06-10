import type { Db } from "./db";
import type { JobSource } from "./types";
import { normalize } from "./normalize";
import { sources as defaultSources } from "./sources";

export interface ScrapeReport { source: string; ok: boolean; fetched: number; inserted: number; error?: string; }

export async function runScrape(db: Db, sources: JobSource[] = defaultSources): Promise<ScrapeReport[]> {
  const reports: ScrapeReport[] = [];
  for (const s of sources) {
    try {
      const raw = await s.fetch();
      const normalized = raw.map((r) => normalize(r, s.id));
      const inserted = db.upsertJobs(normalized);
      reports.push({ source: s.id, ok: true, fetched: raw.length, inserted });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      reports.push({ source: s.id, ok: false, fetched: 0, inserted: 0, error });
    }
  }
  return reports;
}
