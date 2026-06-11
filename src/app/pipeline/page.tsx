import { requireProfile } from "@/lib/guard";
import { db } from "@/lib/server-db";
import { Board } from "../board";

export const dynamic = "force-dynamic";

export default function Pipeline() {
  requireProfile();
  const jobs = db().listJobs({ actioned: true });
  const sources = [...new Set(jobs.map((j) => j.source))];
  return <Board initialJobs={jobs} sources={sources} />;
}
