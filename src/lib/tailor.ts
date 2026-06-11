import type { Db } from "./db";
import type { GeminiClient } from "./types";
import { parseJson, PRO } from "./match";

const RULES = [
  "Rules — TRUTHFUL RE-EMPHASIS ONLY:",
  "- You may reorder sections, rewrite the professional summary, choose which projects/bullets to feature, and mirror the job description's terminology for skills the candidate genuinely has.",
  "- You may NOT invent employers, roles, dates, projects, skills, metrics, or credentials that are not in the base resume.",
  "- Keep the resume one page worth of content. Keep contact details exactly as-is.",
  "- Resume output: clean Markdown — # name, then sections (Summary, Core Skills, Experience, Projects, Education as applicable).",
  "- Cover letter: ≤250 words, specific to this company and role, no generic filler, signed with the candidate's name.",
  "- Outreach email: ≤120 words, written to a founder/recruiter, one concrete hook from the JD, one proof point from the resume, ends with a soft ask. Subject line on the first line as 'Subject: …'.",
].join("\n");

export interface KitDraft { resumeMd: string; coverMd: string; outreachMd: string; }

export async function generateKit(db: Db, client: GeminiClient, jobId: string): Promise<KitDraft> {
  const profile = db.getProfile();
  if (!profile || !profile.resumeText.trim()) throw new Error("no profile set — add your resume in /profile first");
  const job = db.getJob(jobId);
  if (!job) throw new Error("job not found");
  const prompt = [
    "Create a complete job-application kit for this candidate and job.",
    RULES,
    `BASE RESUME (single source of truth):\n${profile.resumeText}`,
    `CORE SKILLS: ${profile.coreSkills}`,
    `CANDIDATE PREFERENCES: ${profile.preferences ?? "none stated"}`,
    `TARGET JOB: ${job.title} at ${job.company}\n${job.description.slice(0, 3000)}`,
    'Return ONLY JSON: {"resumeMd": string, "coverMd": string, "outreachMd": string}.',
  ].join("\n\n");
  const raw = await client.generateJSON(PRO, prompt);
  const kit = parseJson<KitDraft>(raw);
  for (const k of ["resumeMd", "coverMd", "outreachMd"] as const) {
    if (!kit[k] || !kit[k].trim()) throw new Error(`empty ${k} in kit result`);
  }
  db.saveKit(jobId, kit, PRO);
  return kit;
}
