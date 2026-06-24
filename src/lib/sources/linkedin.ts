import type { JobSource, RawJob } from "../types";
import { safeDateISO } from "../normalize";

// LinkedIn's public guest job-search endpoint. No auth, no account risk.
// Returns server-rendered <li> job cards. Fragile to markup changes — isolated
// here and fixture-tested so breakage is loud and localized.
const ENDPOINT = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// keyword × location matrix — remote-only (f_WT=2). Kept small to stay polite.
const KEYWORDS = ["AI Engineer", "Machine Learning Engineer", "Full Stack Engineer"];
const LOCATIONS = ["United States", "European Union", "Worldwide"];
const PAGES = 2; // 25 results per page

function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/g, "/");
}

function textOf(html: string): string {
  return decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function field(card: string, re: RegExp): string | null {
  const m = card.match(re);
  return m ? textOf(m[1]) : null;
}

export function parseLinkedInCards(html: string): RawJob[] {
  const cards = html.split(/<li>/).slice(1); // drop the leading non-card chunk
  const jobs: RawJob[] = [];
  for (const card of cards) {
    if (!/base-search-card/.test(card)) continue;
    const hrefMatch = card.match(/class="base-card__full-link[^"]*"\s+href="([^"]+)"/);
    const titleMatch = card.match(/<span class="sr-only">\s*([\s\S]*?)<\/span>/);
    if (!hrefMatch || !titleMatch) continue;
    const title = textOf(titleMatch[1]);
    // strip tracking query string and decode entities from the url
    const url = decode(hrefMatch[1]).split("?")[0];
    if (!title || !url) continue;
    const company = field(card, /base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/) ?? "Unknown";
    const location = field(card, /job-search-card__location[^>]*>([\s\S]*?)<\/span>/);
    const dateMatch = card.match(/listdate[^>]*datetime="([^"]+)"/);
    jobs.push({
      company,
      title,
      location,
      remote: true, // queried with f_WT=2
      salary: null,
      url,
      description: title, // guest search has no body; detail-fetch is out of scope for v3
      postedAt: dateMatch ? safeDateISO(dateMatch[1]) : null,
      geoRaw: location,
    });
  }
  return jobs;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const linkedinSource: JobSource = {
  id: "linkedin",
  async fetch() {
    const out: RawJob[] = [];
    const seen = new Set<string>();
    for (const keywords of KEYWORDS) {
      for (const location of LOCATIONS) {
        for (let page = 0; page < PAGES; page++) {
          const params = new URLSearchParams({ keywords, location, f_WT: "2", start: String(page * 25) });
          try {
            const res = await fetch(`${ENDPOINT}?${params}`, { headers: { "User-Agent": UA } });
            if (!res.ok) break; // 429/4xx — stop paging this query, move on
            const jobs = parseLinkedInCards(await res.text());
            if (jobs.length === 0) break; // no more pages
            for (const j of jobs) {
              if (seen.has(j.url)) continue;
              seen.add(j.url);
              out.push(j);
            }
          } catch {
            break; // network hiccup — skip the rest of this query
          }
          await sleep(800); // be polite
        }
      }
    }
    return out;
  },
};
