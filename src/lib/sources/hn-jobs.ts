import type { JobSource, RawJob } from "../types";
import { looksRemote, safeDateISO } from "../normalize";

export function parseHnJob(item: any): RawJob | null {
  if (!item || item.type !== "job" || !item.title) return null;
  const title: string = String(item.title);
  // "Company (YC ..) is hiring a Role" → company / role
  const m = title.match(/^(.*?)\s+is hiring\s+(?:an?\s+)?(.*)$/i);
  const company = (m ? m[1] : title).replace(/\s*\(YC[^)]*\)/i, "").trim().slice(0, 120);
  const role = (m ? m[2] : title).trim().slice(0, 160);
  return {
    company: company || "Unknown",
    title: role || title,
    location: null,
    remote: looksRemote(title),
    salary: null,
    url: String(item.url ?? `https://news.ycombinator.com/item?id=${item.id}`),
    description: title,
    postedAt: item.time ? safeDateISO(item.time * 1000) : null,
    geoRaw: null,
  };
}

export const hnJobsSource: JobSource = {
  id: "hn-jobs",
  async fetch() {
    const idsRes = await fetch("https://hacker-news.firebaseio.com/v0/jobstories.json");
    if (!idsRes.ok) throw new Error(`hn jobstories ${idsRes.status}`);
    const ids: number[] = await idsRes.json();
    const items = await Promise.all(
      ids.slice(0, 40).map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => (r.ok ? r.json() : null))
      )
    );
    return items.map(parseHnJob).filter((j): j is RawJob => j !== null);
  },
};
