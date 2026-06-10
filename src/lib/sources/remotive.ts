import type { JobSource, RawJob } from "../types";
import { safeDateISO } from "../normalize";

export function parseRemotive(rows: any[]): RawJob[] {
  return rows.map((r): RawJob => {
    const geo = r.candidate_required_location ? String(r.candidate_required_location).trim() : null;
    const geoRaw = geo || null;
    return {
      company: String(r.company_name ?? "Unknown"),
      title: String(r.title ?? ""),
      location: geoRaw,
      remote: true,
      salary: r.salary ? String(r.salary) : null,
      url: String(r.url ?? ""),
      description: String(r.description ?? "").slice(0, 4000),
      postedAt: safeDateISO(r.publication_date),
      geoRaw,
    };
  });
}

export const remotiveSource: JobSource = {
  id: "remotive",
  async fetch() {
    const res = await fetch("https://remotive.com/api/remote-jobs?limit=200");
    if (!res.ok) throw new Error(`remotive ${res.status}`);
    const data = await res.json();
    return parseRemotive(data.jobs ?? []);
  },
};
