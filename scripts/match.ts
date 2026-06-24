import { createDb } from "../src/lib/db";
import { matchNew, geminiClient } from "../src/lib/match";
import { generateKit } from "../src/lib/tailor";
import { enrichContact } from "../src/lib/enrich";

const db = createDb();
const client = geminiClient();
const res = await matchNew(db, client);
console.log(`Scored ${res.scored} new jobs.`);
if (res.failedBatches > 0) {
  console.warn(`Warning: ${res.failedBatches} batches (${res.failedJobs} jobs) failed after retries — run again later.`);
}

// Auto-tailor: build a full kit (resume + cover + contact-aware outreach) for the
// top-N eligible, highest-scored jobs that don't have one yet.
const AUTO_KIT_N = Number(process.env.AUTO_KIT_N ?? 5);
if (AUTO_KIT_N > 0 && db.getProfile()?.resumeText.trim()) {
  const top = db
    .listJobs({ eligibility: ["eligible"], status: "to_apply" })
    .filter((j) => !j.hasKit && j.score != null)
    .slice(0, AUTO_KIT_N);
  if (top.length > 0) console.log(`\nAuto-tailoring top ${top.length} matches…`);
  for (const j of top) {
    try {
      const contact = await enrichContact(db, client, j.id);
      await generateKit(db, client, j.id, contact);
      console.log(`  ✓ kit + contact for ${j.company} — ${j.title} (score ${j.score}${contact.personName ? `, → ${contact.personName}` : ""})`);
    } catch (e) {
      console.warn(`  ✗ ${j.company}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
