import { NextResponse } from "next/server";
import { db } from "@/lib/server-db";
import type { Status } from "@/lib/types";
import { STATUSES } from "@/lib/types";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const f = {
    source: u.searchParams.get("source") || undefined,
    remote: u.searchParams.has("remote") ? u.searchParams.get("remote") === "true" : undefined,
    minScore: u.searchParams.has("minScore") ? Number(u.searchParams.get("minScore")) : undefined,
    query: u.searchParams.get("query") || undefined,
    status: (u.searchParams.get("status") as Status) || undefined,
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
