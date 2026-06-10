import { createHash } from "node:crypto";
import type { RawJob, NormalizedJob } from "./types";

export function dedupeKey(company: string, title: string, url: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha1").update(`${norm(company)}|${norm(title)}|${norm(url)}`).digest("hex");
}

const REMOTE_RE = /\bremote\b|\bwork from home\b|\bwfh\b|\bdistributed\b/i;
const ONSITE_RE = /\bon-?site\b|\bin-?person\b|\bin office\b/i;
// HN convention: "No remote" / "not remote" flags an onsite-only role
const NO_REMOTE_RE = /\bno remote\b|\bnot remote\b|\bremote:\s*no\b/i;

export function looksRemote(text: string): boolean {
  if (NO_REMOTE_RE.test(text)) return false;
  if (ONSITE_RE.test(text) && !REMOTE_RE.test(text)) return false;
  return REMOTE_RE.test(text);
}

// Sources pass through API-provided dates; a single bad value must not crash a whole scrape.
export function safeDateISO(d: unknown): string | null {
  if (!d) return null;
  const t = new Date(d as string | number);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export function normalize(raw: RawJob, source: string): NormalizedJob {
  return { ...raw, source, dedupeKey: dedupeKey(raw.company, raw.title, raw.url) };
}
