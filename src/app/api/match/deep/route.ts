import { NextResponse } from "next/server";
import { db } from "@/lib/server-db";
import { deepMatch, geminiClient } from "@/lib/match";

export async function POST(req: Request) {
  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  try {
    const dm = await deepMatch(db(), geminiClient(), jobId);
    return NextResponse.json(dm);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
