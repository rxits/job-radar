import { db } from "@/lib/server-db";
import { Board } from "./board";

export const dynamic = "force-dynamic";

export default function Home() {
  const jobs = db().listJobs({});
  const sources = [...new Set(jobs.map((j) => j.source))];
  return <Board initialJobs={jobs} sources={sources} />;
}
