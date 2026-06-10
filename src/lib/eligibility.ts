import type { Eligibility } from "./types";

const WORLDWIDE_RE = /\bworldwide\b|\banywhere\b|\bglobal(ly)?\b|\binternational\b|\bany\s*country\b|\bany\s*location\b/i;
// country → tokens that make a geo string eligible for that candidate
const REGION_TOKENS: Record<string, RegExp> = {
  india: /\bindia\b|\bapac\b|\basia\b|\bsouth asia\b|\bist\b/i,
  germany: /\bgermany\b|\beurope\b|\beu\b|\bemea\b|\beu time ?zones?\b|\bcet\b/i,
  // extensible; OSS users add their country here or rely on name match
};
// known restriction tokens that signal a real region limit (so we can call ineligible confidently)
const RESTRICTION_RE = /\bus(a)?\b|\bunited states\b|\bcanada\b|\buk\b|\bunited kingdom\b|\beurope\b|\beu\b|\bemea\b|\blatam\b|\bamericas?\b|\baustralia\b|\bnew zealand\b|\bafrica\b|\basia\b|\bapac\b|\bindia\b|\bgermany\b|\bfrance\b|\bnetherlands\b|\bspain\b|\bpoland\b|\bbrazil\b|\bmexico\b|\bjapan\b|\bsingapore\b|\bphilippines\b|\b[a-z ]*time ?zones?\b|\bonly\b/i;

function candidateRegexes(candidateLocation: string): RegExp[] {
  const lower = candidateLocation.toLowerCase();
  const res: RegExp[] = [];
  for (const [country, re] of Object.entries(REGION_TOKENS)) if (lower.includes(country)) res.push(re);
  // always also match the candidate's own country word(s) from the location string (last comma segment)
  const country = lower.split(",").pop()?.trim();
  if (country) res.push(new RegExp(`\\b${country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
  return res;
}

export function classifyGeo(geoRaw: string | null, candidateLocation: string): { eligibility: Eligibility; reason: string | null } {
  const g = (geoRaw ?? "").trim();
  if (!g) return { eligibility: "unknown", reason: null };
  if (WORLDWIDE_RE.test(g)) return { eligibility: "eligible", reason: `open worldwide ("${g}")` };
  if (candidateRegexes(candidateLocation).some((re) => re.test(g)))
    return { eligibility: "eligible", reason: `region includes you ("${g}")` };
  if (RESTRICTION_RE.test(g)) return { eligibility: "ineligible", reason: `restricted: ${g}` };
  return { eligibility: "unknown", reason: g };
}
