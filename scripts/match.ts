import { createDb } from "../src/lib/db";
import { matchNew, geminiClient } from "../src/lib/match";

const db = createDb();
const res = await matchNew(db, geminiClient());
console.log(`Scored ${res.scored} new jobs.`);
if (res.failedBatches > 0) {
  console.warn(`Warning: ${res.failedBatches} batches (${res.failedJobs} jobs) failed after retries — run again later.`);
}
