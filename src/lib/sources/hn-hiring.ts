import type { JobSource, RawJob } from "../types";
import { looksRemote, safeDateISO } from "../normalize";

function stripHtml(html: string): string {
  return html
    .replace(/<p>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&#x2F;/g, "/").replace(/&gt;/g, ">").replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

// First line of a Who-is-hiring post is conventionally "Company | Role | Location | ...".
function parsePost(text: string): { company: string; title: string; location: string | null } {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const parts = firstLine.split(/\s*[|•·–—-]\s*/).filter(Boolean);
  const company = parts[0]?.slice(0, 120) || "Unknown";
  const title = parts[1]?.slice(0, 160) || firstLine.slice(0, 160) || "Role";
  const location = parts.slice(2).join(" | ").slice(0, 120) || null;
  return { company, title, location };
}

export function parseHnThread(thread: any): RawJob[] {
  const kids: any[] = thread?.children ?? [];
  const jobs: RawJob[] = [];
  for (const c of kids) {
    if (!c || !c.text) continue;
    const text = stripHtml(String(c.text));
    if (text.length < 20) continue;
    const { company, title, location } = parsePost(text);
    jobs.push({
      company, title, location,
      remote: looksRemote(text),
      salary: null,
      url: `https://news.ycombinator.com/item?id=${c.id}`,
      description: text.slice(0, 4000),
      postedAt: safeDateISO(c.created_at),
    });
  }
  return jobs;
}

export const hnHiringSource: JobSource = {
  id: "hn-hiring",
  async fetch() {
    const search = await fetch(
      'https://hn.algolia.com/api/v1/search_by_date?query=%22Ask%20HN%3A%20Who%20is%20hiring%22&tags=story&hitsPerPage=1'
    );
    if (!search.ok) throw new Error(`hn search ${search.status}`);
    const sj = await search.json();
    const id = sj.hits?.[0]?.objectID;
    if (!id) return [];
    const items = await fetch(`https://hn.algolia.com/api/v1/items/${id}`);
    if (!items.ok) throw new Error(`hn items ${items.status}`);
    return parseHnThread(await items.json());
  },
};
