import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createDb } from "../src/lib/db";

// Seed the job-radar profile from the real master resume so matching + kit
// generation tailor against genuine experience (not placeholder text).
// Usage: pnpm import-resume [path]   (path → RESUME_PATH env → default)

const DEFAULT = resolve(homedir(), "studio/resumes/general/RESUME.md");
const path = process.argv[2] || process.env.RESUME_PATH || DEFAULT;

const resumeText = readFileSync(path, "utf8").trim();
if (!resumeText) {
  console.error(`empty resume at ${path}`);
  process.exit(1);
}

// Derive a one-line core-skills string from the "## Skills" section if present.
function deriveCoreSkills(md: string): string {
  const m = md.match(/##\s*Skills\s*\n([\s\S]*?)(?:\n##\s|\n#\s|$)/i);
  if (!m) return "";
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .join("; ")
    .slice(0, 1000);
}

const coreSkills = deriveCoreSkills(resumeText) || "See resume.";

const db = createDb();
db.saveProfile(
  resumeText,
  coreSkills,
  "Bangalore, India",
  "IST (UTC+5:30)",
  "Remote roles paying in USD/EUR/AUD; open to worldwide/India-eligible positions; full-stack & AI engineering; internships considered.",
);

console.log(`✓ imported resume from ${path}`);
console.log(`  resume: ${resumeText.length} chars`);
console.log(`  core skills: ${coreSkills.slice(0, 80)}…`);
console.log(`  location: Bangalore, India · IST`);
