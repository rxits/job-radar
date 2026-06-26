import type { Contact, JobRow } from "./types";

export interface DigestInput {
  matches: JobRow[]; // already ranked (listJobs order), to-apply, scored
  contacts: Record<string, Contact | null>;
  followUps: JobRow[];
  generatedAt: string; // ISO
}

const REGION_LABEL: Record<string, string> = {
  us: "US", eu: "EU", au: "AU", worldwide: "Worldwide", other: "Other",
};

function tagsFor(j: JobRow): string[] {
  const t: string[] = [];
  if (j.region) t.push(REGION_LABEL[j.region] ?? j.region);
  if (j.payTier === "high") t.push("high-pay");
  else if (j.payTier === "low") t.push("low-pay");
  if (j.isInternship) t.push("internship");
  if (j.aiFriendly != null && j.aiFriendly >= 70) t.push(`AI-friendly ${j.aiFriendly}`);
  if (j.hasKit) t.push("kit ready");
  return t;
}

function contactLine(c: Contact | null | undefined): string | null {
  if (!c) return null;
  if (c.confidence === "none" && !c.personName && c.emails.length === 0) return null;
  const who = c.personName
    ? `${c.personName}${c.personTitle ? `, ${c.personTitle}` : ""}`
    : null;
  const email = c.emails[0] ?? null;
  const parts = [who, email].filter(Boolean);
  if (parts.length === 0) return null;
  return `Contact: ${parts.join(" · ")} (${c.confidence})`;
}

function entry(j: JobRow, i: number, contacts: DigestInput["contacts"]): string {
  const score = j.score != null ? `${j.score}/100` : "unscored";
  const lines = [`${i + 1}. ${j.company} — ${j.title}  [${score}]`];
  const tags = tagsFor(j);
  if (tags.length) lines.push(`   ${tags.join(" · ")}`);
  if (j.reason) lines.push(`   "${j.reason.trim()}"`);
  const cl = contactLine(contacts[j.id]);
  if (cl) lines.push(`   ${cl}`);
  lines.push(`   ${j.url}`);
  return lines.join("\n");
}

/**
 * Render a plain-text daily briefing of the top job matches. Pure: no DB, no
 * network, no clock — caller supplies `generatedAt`. Output reads cleanly both
 * in a terminal and saved as a `.md` file.
 */
export function renderDigest(input: DigestInput): string {
  const { matches, contacts, followUps, generatedAt } = input;
  const date = generatedAt.slice(0, 10);
  const out: string[] = [`# job-radar digest — ${date}`, ""];

  if (matches.length === 0) {
    out.push("No eligible, scored, to-apply matches right now.");
    out.push("Run `pnpm scrape && pnpm match` to refresh the radar.");
  } else {
    const withKit = matches.filter((j) => j.hasKit).length;
    out.push(`${matches.length} top matches ready to apply (${withKit} with a kit already generated).`);
    out.push("");
    out.push(matches.map((j, i) => entry(j, i, contacts)).join("\n\n"));
  }

  if (followUps.length > 0) {
    out.push("");
    out.push(`## Follow-ups (${followUps.length})`);
    out.push("Applied 7+ days ago with no movement — nudge them:");
    out.push("");
    out.push(
      followUps
        .map((j) => `- ${j.company} — ${j.title}  ${j.url}`)
        .join("\n"),
    );
  }

  out.push("");
  return out.join("\n");
}
