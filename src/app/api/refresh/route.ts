import { NextResponse } from "next/server";
import { db } from "@/lib/server-db";
import { runScrape } from "@/lib/scrape";
import { matchNew, geminiClient } from "@/lib/match";

export const maxDuration = 300;

export async function POST() {
  const scrape = await runScrape(db());
  let match: { scored: number; failedBatches: number; failedJobs: number } | { error: string };
  try {
    match = await matchNew(db(), geminiClient());
  } catch (e) {
    match = { error: e instanceof Error ? e.message : String(e) };
  }
  return NextResponse.json({ scrape, match });
}
