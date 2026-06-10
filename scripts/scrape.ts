import { createDb } from "../src/lib/db";
import { runScrape } from "../src/lib/scrape";

const db = createDb();
const reports = await runScrape(db);
for (const r of reports) {
  console.log(r.ok ? `✓ ${r.source}: +${r.inserted} new (${r.fetched} fetched)` : `✗ ${r.source}: ${r.error}`);
}
console.log(`Total jobs in DB: ${db.listJobs({}).length}`);

const nE = db.listJobs({ eligibility: ["eligible"] }).length;
const nI = db.listJobs({ eligibility: ["ineligible"] }).length;
const nU = db.listJobs({ eligibility: ["unknown"] }).length;
console.log(`Eligibility: ${nE} eligible / ${nI} ineligible / ${nU} unknown`);
