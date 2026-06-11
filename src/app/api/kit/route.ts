import { NextResponse } from "next/server";
import { db } from "@/lib/server-db";
import { generateKit } from "@/lib/tailor";
import { geminiClient } from "@/lib/match";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { jobId } = await req.json().catch(() => ({}));
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  try {
    const kit = await generateKit(db(), geminiClient(), jobId);
    return NextResponse.json(kit);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  const kit = db().getKit(jobId);
  if (!kit) return NextResponse.json({ error: "no kit yet" }, { status: 404 });
  return NextResponse.json(kit);
}
