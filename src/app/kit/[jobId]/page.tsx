import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/guard";
import { db } from "@/lib/server-db";
import { KitView } from "./kit-view";

export const dynamic = "force-dynamic";

export default async function KitPage({ params }: { params: Promise<{ jobId: string }> }) {
  requireProfile();
  const { jobId } = await params;
  const job = db().getJob(jobId);
  if (!job) notFound();
  const kit = db().getKit(jobId);
  return <KitView job={job} kit={kit} />;
}
