import type { JobSource, RawJob } from "../types";
import { looksRemote, safeDateISO } from "../normalize";

// Thin best-effort X/Twitter source. X has no free API; this scrapes the public
// syndication timeline widget, which is heavily rate-limited and breaks often.
// Documented as low-confidence — it fails soft and never blocks a scrape run.
const ENDPOINT = "https://syndication.twitter.com/srv/timeline-profile/screen-name";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Curated hiring accounts. Extend freely.
const HANDLES = ["WeWorkRemotely", "remoteok", "hnhiring", "remotejobsclub"];

const HIRING_RE = /\b(hiring|we'?re hiring|open role|open position|join (our|the) team|apply now|now hiring)\b/i;

interface TweetEntry {
  content?: { tweet?: { full_text?: string; created_at?: string; user?: { screen_name?: string }; entities?: { urls?: { url?: string; expanded_url?: string }[] } } };
}

function entriesOf(json: any): TweetEntry[] {
  const e = json?.props?.pageProps?.timeline?.entries ?? json?.entries;
  return Array.isArray(e) ? e : [];
}

export function parseTimeline(json: any, handle: string): RawJob[] {
  const jobs: RawJob[] = [];
  for (const entry of entriesOf(json)) {
    const tw = entry?.content?.tweet;
    if (!tw?.full_text) continue;
    const text = tw.full_text;
    if (!HIRING_RE.test(text)) continue;
    const expanded = tw.entities?.urls?.find((u) => u.expanded_url)?.expanded_url;
    const url = expanded ?? null;
    if (!url) continue; // a hiring tweet with no link isn't actionable
    // title = first line / sentence, link stripped
    const title = text.replace(/https?:\/\/\S+/g, "").split(/[\n.!?]/)[0].trim().slice(0, 140);
    jobs.push({
      company: tw.user?.screen_name ?? handle,
      title: title || "Hiring (via X)",
      location: null,
      remote: looksRemote(text),
      salary: null,
      url,
      description: text.slice(0, 1000),
      postedAt: safeDateISO(tw.created_at),
      geoRaw: null,
    });
  }
  return jobs;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Extract the __NEXT_DATA__ JSON blob embedded in the syndication HTML response.
function extractNextData(html: string): any | null {
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export const twitterSource: JobSource = {
  id: "twitter",
  async fetch() {
    const out: RawJob[] = [];
    const seen = new Set<string>();
    for (const handle of HANDLES) {
      try {
        const res = await fetch(`${ENDPOINT}/${handle}`, { headers: { "User-Agent": UA } });
        if (!res.ok) continue; // 429/4xx — skip this handle, keep going
        const data = extractNextData(await res.text());
        if (!data) continue;
        for (const j of parseTimeline(data, handle)) {
          if (seen.has(j.url)) continue;
          seen.add(j.url);
          out.push(j);
        }
      } catch {
        // network/parse failure — fail soft
      }
      await sleep(800);
    }
    return out;
  },
};
