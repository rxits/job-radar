import { createDb } from "../src/lib/db";
import { runScrape } from "../src/lib/scrape";

const db = createDb();
const reports = await runScrape(db);
for (const r of reports) {
  console.log(r.ok ? `✓ ${r.source}: +${r.inserted} new (${r.fetched} fetched)` : `✗ ${r.source}: ${r.error}`);
}
console.log(`Total jobs in DB: ${db.listJobs({}).length}`);
