import { NextResponse } from "next/server";
import { db } from "@/lib/server-db";
import { tailorResume } from "@/lib/tailor";
import { geminiClient } from "@/lib/match";

export async function POST(req: Request) {
  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  try {
    const res = await tailorResume(db(), geminiClient(), jobId);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  const t = db().getTailored(jobId);
  if (!t) return NextResponse.json({ error: "not tailored yet" }, { status: 404 });
  return NextResponse.json(t);
}
