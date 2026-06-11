import { NextResponse } from "next/server";
import { db } from "@/lib/server-db";

export async function GET() {
  return NextResponse.json(
    db().getProfile() ?? { resumeText: "", coreSkills: "", location: "", timezone: "", preferences: "" }
  );
}
export async function POST(req: Request) {
  const { resumeText, coreSkills, location, timezone, preferences } = await req.json();
  db().saveProfile(
    String(resumeText ?? ""),
    String(coreSkills ?? ""),
    String(location ?? "") || null,
    String(timezone ?? "") || null,
    String(preferences ?? "") || null,
  );
  return NextResponse.json({ ok: true });
}
