import { NextResponse } from "next/server";
import { db } from "@/lib/server-db";

export async function GET() {
  return NextResponse.json(db().getProfile() ?? { resumeText: "", coreSkills: "" });
}
export async function POST(req: Request) {
  const { resumeText, coreSkills } = await req.json();
  db().saveProfile(String(resumeText ?? ""), String(coreSkills ?? ""));
  return NextResponse.json({ ok: true });
}
