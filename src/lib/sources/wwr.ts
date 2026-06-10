import type { JobSource, RawJob } from "../types";
import { safeDateISO, stripHtml } from "../normalize";

function tag(s: string, t: string): string | null {
  const m = s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`));
  if (!m) return null;
  // Handle CDATA blocks
  const v = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  return v || null;
}

export function parseWwr(xml: string): RawJob[] {
  const items = xml.split("<item>").slice(1).map((s) => s.split("</item>")[0]);
  return items
    .flatMap((it): RawJob[] => {
      const rawTitle = tag(it, "title") ?? "";
      // Decode title HTML entities (e.g. &amp; in company or role names)
      const decodedTitle = rawTitle
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const colonIdx = decodedTitle.indexOf(":");
      if (colonIdx === -1) return [];
      const company = decodedTitle.slice(0, colonIdx).trim();
      const title = decodedTitle.slice(colonIdx + 1).trim();
      if (!company || !title) return [];
      const region = tag(it, "region");
      // description is HTML-entity-encoded HTML; decode entities then strip tags
      const rawDesc = tag(it, "description") ?? "";
      const desc = stripHtml(rawDesc).slice(0, 4000);
      const url = tag(it, "link") ?? "";
      if (!url) return [];
      return [{
        company: company.slice(0, 120),
        title: title.slice(0, 160),
        location: region,
        remote: true,
        salary: null,
        url,
        geoRaw: region,
        description: desc,
        postedAt: safeDateISO(tag(it, "pubDate")),
      }];
    })
    .filter((j) => Boolean(j.url));
}

const WWR_FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
];

export const wwrSource: JobSource = {
  id: "wwr",
  async fetch() {
    const results: RawJob[][] = [];
    let lastError: Error | null = null;
    for (const url of WWR_FEEDS) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "job-radar" } });
        if (!res.ok) throw new Error(`wwr ${res.status}`);
        const xml = await res.text();
        results.push(parseWwr(xml));
      } catch (err) {
        lastError = err as Error;
      }
    }
    if (results.length === 0) throw lastError ?? new Error("wwr all feeds failed");
    return results.flat();
  },
};
