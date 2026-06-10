import { createDb } from "../src/lib/db";
import { matchNew, geminiClient } from "../src/lib/match";

const db = createDb();
const res = await matchNew(db, geminiClient());
console.log(`Scored ${res.scored} new jobs.`);
