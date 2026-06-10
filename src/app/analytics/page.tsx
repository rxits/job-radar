import { db } from "@/lib/server-db";
import { STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function Analytics() {
  const jobs = db().listJobs({});
  const byStatus = STATUSES.map((s) => ({ s, n: jobs.filter((j) => j.status === s).length }));
  const bySource = [...new Set(jobs.map((j) => j.source))].map((src) => ({ src, n: jobs.filter((j) => j.source === src).length }));
  const scored = jobs.filter((j) => j.score != null);
  const buckets = [0, 20, 40, 60, 80].map((lo) => ({ lo, n: scored.filter((j) => j.score! >= lo && (j.score! < lo + 20 || lo === 80)).length }));
  const total = jobs.length;

  const Bar = ({ label, n, max }: { label: string; n: number; max: number }) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 text-neutral-400">{label}</span>
      <div className="h-4 flex-1 rounded bg-neutral-800"><div className="h-4 rounded bg-indigo-600" style={{ width: `${max ? (n / max) * 100 : 0}%` }} /></div>
      <span className="w-8 text-right">{n}</span>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold">Analytics — {total} jobs</h1>
      <section><h2 className="mb-2 text-sm uppercase text-neutral-500">Pipeline</h2>
        {byStatus.map((b) => <Bar key={b.s} label={b.s} n={b.n} max={total} />)}</section>
      <section><h2 className="mb-2 text-sm uppercase text-neutral-500">By source</h2>
        {bySource.map((b) => <Bar key={b.src} label={b.src} n={b.n} max={total} />)}</section>
      <section><h2 className="mb-2 text-sm uppercase text-neutral-500">Match score ({scored.length} scored)</h2>
        {buckets.map((b) => <Bar key={b.lo} label={b.lo === 80 ? "80–100" : `${b.lo}–${b.lo + 19}`} n={b.n} max={scored.length} />)}</section>
    </div>
  );
}
