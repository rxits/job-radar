import { NextResponse } from "next/server";
import { db } from "@/lib/server-db";
import { matchNew, geminiClient } from "@/lib/match";

export async function POST() {
  try {
    const res = await matchNew(db(), geminiClient());
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
