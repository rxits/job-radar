import type { JobSource, RawJob } from "../types";
import { safeDateISO } from "../normalize";

export function parseJobicy(rows: any[]): RawJob[] {
  return rows.map((r): RawJob => {
    const geo = r.jobGeo ? String(r.jobGeo).trim() : null;
    const geoRaw = geo || null;
    const salaryMin = Number(r.annualSalaryMin);
    const salaryMax = Number(r.annualSalaryMax);
    const salary = salaryMin > 0 && salaryMax > 0 ? `$${salaryMin}–$${salaryMax}` : null;
    const description = String(r.jobExcerpt || r.jobDescription || "").slice(0, 4000);
    return {
      company: String(r.companyName ?? "Unknown"),
      title: String(r.jobTitle ?? ""),
      location: geoRaw,
      remote: true,
      salary,
      url: String(r.url ?? ""),
      description,
      postedAt: safeDateISO(r.pubDate),
      geoRaw,
    };
  });
}

export const jobicySource: JobSource = {
  id: "jobicy",
  async fetch() {
    const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=100");
    if (!res.ok) throw new Error(`jobicy ${res.status}`);
    const data = await res.json();
    return parseJobicy(data.jobs ?? []);
  },
};
