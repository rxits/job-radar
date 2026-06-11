import { redirect } from "next/navigation";
import { db } from "./server-db";

export function requireProfile() {
  const p = db().getProfile();
  if (!p || !p.resumeText.trim()) redirect("/setup");
  return p;
}
