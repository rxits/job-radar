import type { JobSource, RawJob } from "../types";
import { safeDateISO } from "../normalize";

function normalizeHimalayasDate(pubDate: unknown): string | null {
  if (!pubDate) return null;
  // numeric = epoch seconds; string = ISO date string
  if (typeof pubDate === "number") return safeDateISO(pubDate * 1000);
  if (typeof pubDate === "string" && /^\d+$/.test(pubDate.trim())) {
    return safeDateISO(Number(pubDate) * 1000);
  }
  return safeDateISO(pubDate as string);
}

// "Trase-systems" → "Trase Systems"
function prettifySlug(slug: string): string {
  return slug.split(/[-_]/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// The bulk listing API redacts companyName to the literal placeholder "name";
// fall back to the still-present companySlug in that case.
function companyOf(r: any): string {
  const name = String(r.companyName ?? "").trim();
  if (name && name.toLowerCase() !== "name") return name;
  const slug = String(r.companySlug ?? "").trim();
  if (slug) return prettifySlug(slug);
  return "Unknown";
}

export function parseHimalayas(rows: any[]): RawJob[] {
  return rows.map((r): RawJob => {
    const restrictions: string[] = Array.isArray(r.locationRestrictions) ? r.locationRestrictions : [];
    const geoRaw = restrictions.length > 0 ? restrictions.join(", ") : "Worldwide";
    const minSalary = Number(r.minSalary);
    const maxSalary = Number(r.maxSalary);
    const salary = minSalary > 0 && maxSalary > 0 ? `$${minSalary}–$${maxSalary}` : null;
    return {
      company: companyOf(r),
      title: String(r.title ?? ""),
      location: geoRaw,
      remote: true,
      salary,
      url: String(r.applicationLink || r.guid || ""),
      description: String(r.description ?? "").slice(0, 4000),
      postedAt: normalizeHimalayasDate(r.pubDate),
      geoRaw,
    };
  });
}

export const himalayasSource: JobSource = {
  id: "himalayas",
  async fetch() {
    const res = await fetch("https://himalayas.app/jobs/api?limit=100");
    if (!res.ok) throw new Error(`himalayas ${res.status}`);
    const data = await res.json();
    return parseHimalayas(data.jobs ?? []);
  },
};
