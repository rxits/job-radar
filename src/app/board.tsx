"use client";
import { useState } from "react";
import type { JobRow, Status } from "@/lib/types";
import { STATUSES } from "@/lib/types";

const LABEL: Record<Status, string> = {
  to_apply: "To Apply", applied: "Applied", interviewing: "Interviewing",
  offer: "Offer", rejected: "Rejected", archived: "Archived",
};

export function Board({ initialJobs, sources }: { initialJobs: JobRow[]; sources: string[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [busy, setBusy] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [query, setQuery] = useState("");

  async function refresh() {
    const r = await fetch("/api/jobs").then((r) => r.json());
    setJobs(r.jobs);
  }
  async function scrape() { setBusy("scrape"); try { await fetch("/api/scrape", { method: "POST" }); await refresh(); } finally { setBusy(null); } }
  async function match() {
    setBusy("match");
    try {
      const r = await fetch("/api/match", { method: "POST" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error ?? "match failed"); }
      await refresh();
    } finally { setBusy(null); }
  }
  async function move(id: string, status: Status) {
    await fetch("/api/jobs", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, status } : j)));
  }

  const visible = jobs.filter((j) =>
    (!source || j.source === source) && (!remoteOnly || j.remote) &&
    (minScore === 0 || (j.score ?? -1) >= minScore) &&
    (!query || (j.company + " " + j.title + " " + j.description).toLowerCase().includes(query.toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={scrape} disabled={!!busy} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">
          {busy === "scrape" ? "Scraping…" : "Scrape now"}
        </button>
        <button onClick={match} disabled={!!busy} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50">
          {busy === "match" ? "Matching…" : "Match (Gemini)"}
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
                    {j.score != null && <span className="shrink-0 rounded bg-indigo-900 px-1 text-indigo-200">{j.score}</span>}
                  </div>
                  <div className="text-neutral-300">{j.title}</div>
                  {j.reason && <div className="mt-1 italic text-neutral-500">{j.reason}</div>}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-neutral-600">{j.source}</span>
                    <select value={j.status} onChange={(e) => move(j.id, e.target.value as Status)} className="rounded bg-neutral-800 px-1 py-0.5 text-[10px]">
                      {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
