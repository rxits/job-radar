import type { Db } from "./db";
import type { GeminiClient } from "./types";
import { parseJson, PRO } from "./match";

const RULES = [
  "Rules — TRUTHFUL RE-EMPHASIS ONLY:",
  "- You may reorder sections, rewrite the professional summary, choose which projects/bullets to feature, and mirror the job description's terminology for skills the candidate genuinely has.",
  "- You may NOT invent employers, roles, dates, projects, skills, metrics, or credentials that are not in the base resume.",
  "- Keep it one page worth of content. Keep contact details exactly as-is.",
  "- Output clean Markdown: # name, then sections (Summary, Core Skills, Experience, Projects, Education as applicable).",
].join("\n");

export async function tailorResume(db: Db, client: GeminiClient, jobId: string): Promise<{ markdown: string }> {
  const profile = db.getProfile();
  if (!profile || !profile.resumeText.trim()) throw new Error("no profile set — add your resume in /profile first");
  const job = db.getJob(jobId);
  if (!job) throw new Error("job not found");
  const prompt = [
    "Tailor the candidate's resume for this specific job.",
    RULES,
    `BASE RESUME (single source of truth):\n${profile.resumeText}`,
    `CORE SKILLS: ${profile.coreSkills}`,
    `TARGET JOB: ${job.title} at ${job.company}\n${job.description.slice(0, 3000)}`,
    'Return ONLY JSON: {"markdown": string} — the complete tailored resume as Markdown.',
  ].join("\n\n");
  const raw = await client.generateJSON(PRO, prompt);
  const { markdown } = parseJson<{ markdown: string }>(raw);
  if (!markdown || !markdown.trim()) throw new Error("empty tailoring result");
  db.saveTailored(jobId, markdown, PRO);
  return { markdown };
}
