import type { JobSource, RawJob } from "../types";
import { safeDateISO } from "../normalize";

export function parseRemoteOK(rows: any[]): RawJob[] {
  return rows
    .filter((r) => r && r.id && r.position) // drops the leading {legal:...} row
    .map((r): RawJob => {
      // salary_min/salary_max are 0 (not null) when unset
      const salary =
        r.salary_min > 0 && r.salary_max > 0
          ? `$${r.salary_min}–$${r.salary_max}`
          : null;
      // location often has a trailing ", " — trim it
      const rawLocation: string | null = r.location ? String(r.location).replace(/,\s*$/, "").trim() : null;
      const location = rawLocation || null;
      return {
        company: String(r.company ?? "Unknown"),
        title: String(r.position),
        location,
        remote: true,
        salary,
        url: String(r.url ?? `https://remoteok.com/remote-jobs/${r.id}`),
        // description is HTML; slice to 4000 chars
        description: String(r.description ?? (r.tags ? (r.tags as string[]).join(", ") : "")).slice(0, 4000),
        postedAt: safeDateISO(r.date),
      };
    });
}

export const remoteOkSource: JobSource = {
  id: "remoteok",
  async fetch() {
    const res = await fetch("https://remoteok.com/api", {
      headers: { "User-Agent": "job-radar" },
    });
    if (!res.ok) throw new Error(`remoteok ${res.status}`);
    return parseRemoteOK(await res.json());
  },
};
