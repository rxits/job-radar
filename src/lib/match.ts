import { GoogleGenAI } from "@google/genai";
import type { Db } from "./db";
import type { DeepMatch, GeminiClient, JobRow, MatchResult } from "./types";

export const FLASH = "gemini-2.5-flash";
export const PRO = "gemini-2.5-pro";
const BATCH = 15;

export function geminiClient(apiKey = process.env.GEMINI_API_KEY): GeminiClient {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generateJSON(model, prompt) {
      const res = await ai.models.generateContent({
        model, contents: prompt, config: { responseMimeType: "application/json" },
      });
      return res.text ?? "";
    },
  };
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned) as T;
}

function batchPrompt(profile: { resumeText: string; coreSkills: string }, jobs: JobRow[]): string {
  const list = jobs.map((j) => ({ id: j.id, title: j.title, company: j.company, description: j.description.slice(0, 1200) }));
  return [
    "You are a job-matching assistant. Score how well each job fits the candidate.",
    `CANDIDATE RESUME:\n${profile.resumeText}`,
    `CORE SKILLS: ${profile.coreSkills}`,
    `JOBS (JSON): ${JSON.stringify(list)}`,
    'Return ONLY a JSON array: [{"id": string, "score": number 0-100, "reason": string (max 15 words)}]. One object per job id.',
  ].join("\n\n");
}

export interface MatchNewResult { scored: number; failedBatches: number; failedJobs: number; }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function matchNew(
  db: Db,
  client: GeminiClient,
  opts?: { retries?: number; backoffMs?: number },
): Promise<MatchNewResult> {
  const profile = db.getProfile();
  if (!profile || !profile.resumeText.trim()) return { scored: 0, failedBatches: 0, failedJobs: 0 };
  const jobs = db.unscoredJobs();
  const retries = opts?.retries ?? 2;
  const backoffMs = opts?.backoffMs ?? 2000;
  let scored = 0;
  let failedBatches = 0;
  let failedJobs = 0;
  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    const batchIds = new Set(batch.map((b) => b.id));
    let batchScored = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(backoffMs * attempt);
      try {
        const raw = await client.generateJSON(FLASH, batchPrompt(profile, batch));
        const results = parseJson<MatchResult[]>(raw);
        for (const r of results) {
          if (!r || typeof r.id !== "string") continue;
          if (!batchIds.has(r.id)) continue;
          const score = Math.max(0, Math.min(100, Math.round(r.score)));
          db.saveMatch(r.id, score, String(r.reason ?? "").slice(0, 200), FLASH);
          scored++;
        }
        batchScored = true;
        break;
      } catch {
        // retry on next iteration if attempts remain
      }
    }
    if (!batchScored) {
      failedBatches++;
      failedJobs += batch.length;
    }
  }
  return { scored, failedBatches, failedJobs };
}

export async function deepMatch(db: Db, client: GeminiClient, jobId: string): Promise<DeepMatch> {
  const profile = db.getProfile();
  if (!profile) throw new Error("no profile set");
  const job = db.listJobs({}).find((j) => j.id === jobId);
  if (!job) throw new Error("job not found");
  const prompt = [
    "Deeply assess this job against the candidate. Be specific and honest.",
    `CANDIDATE RESUME:\n${profile.resumeText}`,
    `CORE SKILLS: ${profile.coreSkills}`,
    `JOB: ${job.title} at ${job.company}\n${job.description.slice(0, 3000)}`,
    'Return ONLY JSON: {"score": number 0-100, "summary": string, "gaps": string[], "tailoring": string[]}.',
  ].join("\n\n");
  const raw = await client.generateJSON(PRO, prompt);
  const dm = parseJson<DeepMatch>(raw);
  db.saveMatch(jobId, Math.max(0, Math.min(100, Math.round(dm.score))), dm.summary.slice(0, 200), PRO);
  return dm;
}
