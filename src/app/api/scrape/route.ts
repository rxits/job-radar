import { NextResponse } from "next/server";
import { db } from "@/lib/server-db";
import { runScrape } from "@/lib/scrape";

export async function POST() {
  const reports = await runScrape(db());
  return NextResponse.json({ reports });
}
