// Deterministic, dependency-free classifiers run at scrape/normalize time.
// Keep these cheap and well-tested — no network, no AI.

export type PayTier = "high" | "mid" | "low" | "unknown";
export type Region = "us" | "eu" | "au" | "worldwide" | "other" | "unknown";

const INTERN_RE = /\b(intern|internship|co-?op)\b/i;
const INTERN_GUARD_RE = /\binternal\b|\binternational\b/i;

export function detectInternship(title: string, description: string): boolean {
  const t = title ?? "";
  if (INTERN_RE.test(t) && !INTERN_GUARD_RE.test(t)) return true;
  // description: only count an explicit intern/co-op program mention
  const d = description ?? "";
  return /\b(internship|co-?op)\b/i.test(d) && !/\binternal\b/i.test(d.match(/\b\w*intern\w*\b/i)?.[0] ?? "");
}

// Rough FX to USD — good enough for banding, not accounting.
function currencyMult(s: string): number {
  if (/€|\beur\b/i.test(s)) return 1.08;
  if (/£|\bgbp\b/i.test(s)) return 1.27;
  if (/₹|\binr\b|\brs\.?\b/i.test(s)) return 0.012;
  return 1; // $ / USD / unmarked
}

function periodMult(s: string): number {
  if (/\/\s?(hr|hour)|per hour|hourly/i.test(s)) return 2080;
  if (/\/\s?(mo|month)|per month|monthly/i.test(s)) return 12;
  return 1; // annual
}

export function payTier(salary: string | null): PayTier {
  if (!salary || !salary.trim()) return "unknown";
  const s = salary;
  // Find numeric tokens, optionally with a k/m magnitude suffix.
  const matches = [...s.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|m)?/gi)];
  const nums: number[] = [];
  for (const m of matches) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const suf = (m[2] ?? "").toLowerCase();
    if (suf === "k") n *= 1_000;
    else if (suf === "m") n *= 1_000_000;
    nums.push(n);
  }
  if (nums.length === 0) return "unknown";
  const annual = Math.max(...nums) * currencyMult(s) * periodMult(s);
  if (annual >= 100_000) return "high";
  if (annual >= 50_000) return "mid";
  return "low";
}

const WORLDWIDE_RE = /\bworldwide\b|\banywhere\b|\bglobal(ly)?\b|\bany\s*(country|location)\b/i;
const US_RE = /\bunited states\b|\busa\b|\bu\.s\.?\b|\bus[- ]remote\b/i;
const EU_RE = /\beurope\b|\beu\b|\bemea\b|\bgermany\b|\bfrance\b|\bnetherlands\b|\bspain\b|\bpoland\b|\bportugal\b|\bireland\b|\bberlin\b|\blondon\b|\buk\b|\bunited kingdom\b/i;
const AU_RE = /\baustralia\b|\bnew zealand\b|\bsydney\b|\bmelbourne\b/i;

export function regionOf(location: string | null, geoRaw: string | null): Region {
  const text = `${location ?? ""} ${geoRaw ?? ""}`.trim();
  if (!text) return "unknown";
  if (WORLDWIDE_RE.test(text)) return "worldwide";
  if (US_RE.test(text)) return "us";
  if (EU_RE.test(text)) return "eu";
  if (AU_RE.test(text)) return "au";
  return "other";
}
