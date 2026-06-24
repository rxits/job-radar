import type { Db } from "./db";
import type { Contact, GeminiClient } from "./types";
import { FLASH, parseJson } from "./match";
import { stripHtml } from "./normalize";

// Hosts that are job boards / ATS / aggregators — never the company's own domain.
const JOB_BOARD_HOSTS = [
  "lever.co", "greenhouse.io", "workable.com", "ashbyhq.com", "linkedin.com",
  "remoteok.com", "weworkremotely.com", "remotive.com", "jobicy.com", "himalayas.app",
  "ycombinator.com", "indeed.com", "glassdoor.com", "wellfound.com", "angel.co",
  "syndication.twitter.com", "x.com", "twitter.com", "bamboohr.com", "smartrecruiters.com",
];

function slugify(company: string): string {
  return company
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|gmbh|corp|co|technologies|technology|labs|software|systems|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function hostOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

export function domainCandidates(company: string, jobUrl: string): string[] {
  const out: string[] = [];
  const host = hostOf(jobUrl);
  if (host && !JOB_BOARD_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))) {
    out.push(host); // the job url is on the company's own site
  }
  const slug = slugify(company);
  if (slug) {
    for (const tld of ["com", "io", "ai", "co"]) {
      const d = `${slug}.${tld}`;
      if (!out.includes(d)) out.push(d);
    }
  }
  return out;
}

export function emailPatterns(personName: string, domain: string): string[] {
  const parts = personName.toLowerCase().trim().split(/\s+/).map((p) => p.replace(/[^a-z]/g, "")).filter(Boolean);
  if (parts.length === 0) return [];
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const out = [`${first}@${domain}`];
  if (last) {
    out.push(`${first}.${last}@${domain}`);
    out.push(`${first}${last}@${domain}`);
  }
  return out;
}

interface Extracted { personName: string | null; personTitle: string | null; emails: string[]; links: string[]; }

const PAGES = ["", "/about", "/team", "/careers", "/contact"];

async function gather(domain: string, fetchFn: (url: string) => Promise<string>): Promise<string> {
  const chunks: string[] = [];
  for (const path of PAGES) {
    try {
      const html = await fetchFn(`https://${domain}${path}`);
      if (html) chunks.push(stripHtml(html).slice(0, 2000));
    } catch {
      // fail soft — a missing page must not abort enrichment
    }
  }
  return chunks.join("\n\n").slice(0, 8000);
}

// Default network fetch with a short timeout. Injected in tests.
async function defaultFetch(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "job-radar" }, signal: ctrl.signal });
    if (!res.ok) return "";
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function enrichContact(
  db: Db,
  client: GeminiClient,
  jobId: string,
  fetchFn: (url: string) => Promise<string> = defaultFetch,
): Promise<Contact> {
  const job = db.getJob(jobId);
  if (!job) throw new Error("job not found");
  const domains = domainCandidates(job.company, job.url);
  const domain = domains[0] ?? null;

  let siteText = "";
  if (domain) siteText = await gather(domain, fetchFn);

  const prompt = [
    "From the company text and job post below, identify the single best person to contact about this job",
    "(prefer founder / hiring manager / recruiter). Extract any literal email addresses and LinkedIn/profile URLs present.",
    `COMPANY: ${job.company}`,
    `JOB: ${job.title}\n${job.description.slice(0, 1500)}`,
    `COMPANY SITE TEXT:\n${siteText || "(none retrieved)"}`,
    'Return ONLY JSON: {"personName": string|null, "personTitle": string|null, "emails": string[], "links": string[]}.',
  ].join("\n\n");

  let ex: Extracted = { personName: null, personTitle: null, emails: [], links: [] };
  try {
    ex = parseJson<Extracted>(await client.generateJSON(FLASH, prompt));
  } catch {
    // model/parse failure → empty extraction, still produce guessed patterns below
  }

  const foundEmails = (ex.emails ?? []).filter((e) => typeof e === "string" && e.includes("@"));
  const guessed = ex.personName && domain ? emailPatterns(ex.personName, domain) : [];
  const emails = foundEmails.length > 0 ? foundEmails : guessed;

  const confidence: Contact["confidence"] =
    foundEmails.length > 0 ? "found" : ex.personName ? "guessed" : "none";

  const contact: Contact = {
    jobId,
    company: job.company,
    personName: ex.personName ?? null,
    personTitle: ex.personTitle ?? null,
    emails,
    links: (ex.links ?? []).filter((l) => typeof l === "string"),
    source: domain ?? "heuristic",
    confidence,
  };
  db.saveContact(contact, FLASH);
  return contact;
}
