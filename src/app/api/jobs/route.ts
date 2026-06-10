import { NextResponse } from "next/server";
import { db } from "@/lib/server-db";
import type { Eligibility, Status } from "@/lib/types";
import { STATUSES } from "@/lib/types";

const VALID_ELIGIBILITY: Eligibility[] = ["eligible", "ineligible", "unknown"];

export async function GET(req: Request) {
  const u = new URL(req.url);
  const minScoreRaw = u.searchParams.get("minScore");
  const minScore = minScoreRaw !== null && !Number.isNaN(Number(minScoreRaw)) ? Number(minScoreRaw) : undefined;

  const eligRaw = u.searchParams.get("eligibility");
  const eligTokens = eligRaw
    ? (eligRaw.split(",").map((s) => s.trim()).filter((s) => VALID_ELIGIBILITY.includes(s as Eligibility)) as Eligibility[])
    : undefined;
  const eligibility = eligTokens && eligTokens.length > 0 ? eligTokens : undefined;

  const f = {
    source: u.searchParams.get("source") || undefined,
    remote: u.searchParams.has("remote") ? u.searchParams.get("remote") === "true" : undefined,
    minScore,
    query: u.searchParams.get("query") || undefined,
    status: (u.searchParams.get("status") as Status) || undefined,
    eligibility,
  };
  return NextResponse.json({ jobs: db().listJobs(f) });
}

export async function PATCH(req: Request) {
  const { id, status } = await req.json();
  if (!id || !status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "id and a valid status required" }, { status: 400 });
  }
  db().setStatus(id, status as Status);
  return NextResponse.json({ ok: true });
}
