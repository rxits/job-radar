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
    actioned: u.searchParams.get("actioned") === "true" || undefined,
    unseenOnly: u.searchParams.get("unseen") === "true" || undefined,
    region: u.searchParams.get("region") || undefined,
    payTier: u.searchParams.get("payTier") || undefined,
    internship: u.searchParams.has("internship") ? u.searchParams.get("internship") === "true" : undefined,
  };
  return NextResponse.json({ jobs: db().listJobs(f) });
}

export async function PATCH(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const { id, status, seen, starred } = body ?? {};
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
    db().setStatus(id, status as Status);
  }
  if (seen === true) db().markSeen(id);
  if (starred !== undefined) db().setStarred(id, !!starred);
  if (status === undefined && seen === undefined && starred === undefined)
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
