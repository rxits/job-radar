"use client";
import { useState } from "react";
import type { JobRow, Status, DeepMatch } from "@/lib/types";
import { STATUSES } from "@/lib/types";

const LABEL: Record<Status, string> = {
  to_apply: "To Apply", applied: "Applied", interviewing: "Interviewing",
  offer: "Offer", rejected: "Rejected", archived: "Archived",
};

export function Board({ initialJobs, sources }: { initialJobs: JobRow[]; sources: string[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [source, setSource] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [query, setQuery] = useState("");
  const [eligFilter, setEligFilter] = useState("");
  const [deep, setDeep] = useState<{ jobId: string; loading: boolean; data?: DeepMatch; error?: string } | null>(null);

  async function refresh() {
    const r = await fetch("/api/jobs?actioned=true").then((r) => r.json());
    setJobs(r.jobs);
  }
  async function move(id: string, status: Status) {
    await fetch("/api/jobs", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, status } : j)));
  }
  async function toggleStar(id: string, current: boolean) {
    const next = !current;
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, starred: next } : j)));
    await fetch("/api/jobs", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, starred: next }) });
  }
  async function deepMatch(jobId: string) {
    setDeep({ jobId, loading: true });
    try {
      const r = await fetch("/api/match/deep", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId }) });
      const body = await r.json().catch(() => ({}));
      if (r.ok) {
        const data = body as DeepMatch;
        setDeep({ jobId, loading: false, data });
        setJobs((js) => js.map((j) => j.id === jobId ? { ...j, score: data.score, reason: data.summary } : j));
      } else {
        setDeep({ jobId, loading: false, error: body.error ?? "deep match failed" });
      }
    } catch {
      setDeep({ jobId, loading: false, error: "deep match failed" });
    }
  }

  const visible = jobs.filter((j) =>
    (!source || j.source === source) && (!remoteOnly || j.remote) &&
    (minScore === 0 || (j.score ?? -1) >= minScore) &&
    (!query || (j.company + " " + j.title + " " + j.description).toLowerCase().includes(query.toLowerCase())) &&
    (!eligFilter || eligFilter.split(",").includes(j.eligibility)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={refresh} className="rounded bg-neutral-700 px-3 py-1.5 text-sm font-medium hover:bg-neutral-600">
          Refresh
        </button>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded bg-neutral-800 px-2 py-1.5 text-sm">
          <option value="">All sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />Remote</label>
        <label className="flex items-center gap-1 text-sm">Min score
          <input type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} /> {minScore}
        </label>
        <input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="rounded bg-neutral-800 px-2 py-1.5 text-sm" />
        <select value={eligFilter} onChange={(e) => setEligFilter(e.target.value)} className="rounded bg-neutral-800 px-2 py-1.5 text-sm">
          <option value="">All</option>
          <option value="eligible,unknown">Eligible + Unknown</option>
          <option value="eligible">Eligible only</option>
          <option value="ineligible">Ineligible</option>
        </select>
        <span className="text-sm text-neutral-400">{visible.length} jobs</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((st) => (
          <div key={st} className="rounded-lg bg-neutral-900 p-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{LABEL[st]} ({visible.filter((j) => j.status === st).length})</h3>
            <div className="max-h-[75vh] space-y-2 overflow-y-auto">
              {visible.filter((j) => j.status === st).slice(0, 200).map((j) => (
                <div key={j.id} className="rounded border border-neutral-800 bg-neutral-950 p-2 text-xs">
                  <div className="flex items-start justify-between gap-1">
                    <a href={j.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{j.company}</a>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => toggleStar(j.id, j.starred)}
                        title={j.starred ? "Unstar" : "Star"}
                        className={`text-sm leading-none ${j.starred ? "text-amber-400" : "text-neutral-500 hover:text-amber-400"}`}
                      >
                        {j.starred ? "★" : "☆"}
                      </button>
                      {j.score != null && <span className="rounded bg-indigo-900 px-1 text-indigo-200">{j.score}</span>}
                      {j.eligibility === "eligible" && (
                        <span className="shrink-0 rounded bg-emerald-900 px-1 text-emerald-200" title={j.eligibilityReason ?? "eligible"}>✓</span>
                      )}
                      {j.eligibility === "ineligible" && (
                        <span className="shrink-0 rounded bg-red-900 px-1 text-red-200" title={j.eligibilityReason ?? "ineligible"}>✗</span>
                      )}
                      {j.eligibility === "unknown" && (
                        <span className="shrink-0 rounded bg-neutral-800 px-1 text-neutral-400" title="eligibility unknown">?</span>
                      )}
                      {j.aiFriendly != null && j.aiFriendly >= 60 && (
                        <span className="shrink-0 rounded bg-sky-900 px-1 text-sky-200" title="AI-friendly company signal">AI {j.aiFriendly}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-neutral-300">{j.title}</div>
                  {j.reason && <div className="mt-1 italic text-neutral-500">{j.reason}</div>}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-neutral-600">{j.source}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deepMatch(j.id)}
                        disabled={!!deep?.loading}
                        title="Deep match with gemini-2.5-pro"
                        className="text-[10px] rounded bg-purple-900 hover:bg-purple-800 px-1 py-0.5 disabled:opacity-50"
                      >
                        {deep?.loading && deep.jobId === j.id ? "…" : "Deep"}
                      </button>
                      <select value={j.status} onChange={(e) => move(j.id, e.target.value as Status)} className="rounded bg-neutral-800 px-1 py-0.5 text-[10px]">
                        {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {deep !== null && (
        <div className="fixed bottom-4 right-4 max-w-md max-h-[70vh] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-sm shadow-xl z-50">
          {deep.loading ? (
            <p className="text-neutral-400">Asking gemini-2.5-pro…</p>
          ) : (
            <>
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-semibold text-white">
                  Deep match — {jobs.find((j) => j.id === deep.jobId)?.company ?? deep.jobId}
                  {deep.data && <span className="ml-1 text-indigo-300">({deep.data.score}/100)</span>}
                </h2>
                <button onClick={() => setDeep(null)} className="shrink-0 text-neutral-400 hover:text-white" aria-label="Close">✕</button>
              </div>
              {deep.error && <p className="text-red-400">{deep.error}</p>}
              {deep.data && (
                <>
                  <p className="mb-3 text-neutral-300">{deep.data.summary}</p>
                  {deep.data.gaps.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1 font-medium text-neutral-200">Gaps</p>
                      <ul className="list-disc pl-4 space-y-1 text-neutral-400">
                        {deep.data.gaps.map((g, i) => <li key={i}>{g}</li>)}
                      </ul>
                    </div>
                  )}
                  {deep.data.tailoring.length > 0 && (
                    <div>
                      <p className="mb-1 font-medium text-neutral-200">How to tailor</p>
                      <ul className="list-disc pl-4 space-y-1 text-neutral-400">
                        {deep.data.tailoring.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
