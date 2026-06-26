import { mkdirSync, writeFileSync } from "node:fs";
import { createDb } from "../src/lib/db";
import { renderDigest, type DigestInput } from "../src/lib/digest";

// `pnpm digest [limit]` — print a daily briefing of the top eligible, scored,
// to-apply matches plus stale follow-ups, and save it to data/digests/<date>.md
// (data/ is gitignored, so the briefing stays local).
const limit = Number(process.argv[2] ?? process.env.DIGEST_LIMIT ?? 15);

const db = createDb();
const matches = db
  .listJobs({ eligibility: ["eligible"], status: "to_apply" })
  .filter((j) => j.score != null)
  .slice(0, limit);

const contacts: DigestInput["contacts"] = {};
for (const j of matches) contacts[j.id] = db.getContact(j.id);

const generatedAt = new Date().toISOString();
const text = renderDigest({
  matches,
  contacts,
  followUps: db.needsFollowUp(),
  generatedAt,
});

console.log(text);

const dir = "data/digests";
mkdirSync(dir, { recursive: true });
const file = `${dir}/${generatedAt.slice(0, 10)}.md`;
writeFileSync(file, text);
console.error(`\nSaved → ${file}`);
