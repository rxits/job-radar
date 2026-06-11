import { requireProfile } from "@/lib/guard";
import { db } from "@/lib/server-db";
import { Feed } from "./feed";

export const dynamic = "force-dynamic";

export default function Today() {
  requireProfile();
  const jobs = db().listJobs({ eligibility: ["eligible", "unknown"], status: "to_apply", unseenOnly: true });
  const followUps = db().needsFollowUp();
  return <Feed initialJobs={jobs} followUps={followUps} />;
}
