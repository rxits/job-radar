"use client";
import { useState } from "react";
import type { JobRow } from "@/lib/types";
import type { ScrapeReport } from "@/lib/scrape";

interface RefreshResult {
  scrape?: ScrapeReport[];
  match?: { scored?: number; failedBatches?: number; failedJobs?: number } | { error: string };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function EligBadge({ j }: { j: JobRow }) {
  if (j.eligibility === "eligible")
    return (
      <span
        className="rounded bg-emerald-900 px-1.5 py-0.5 text-xs text-emerald-200"
        title={j.eligibilityReason ?? "eligible"}
      >
        ✓
      </span>
    );
  if (j.eligibility === "ineligible")
    return (
      <span
        className="rounded bg-red-900 px-1.5 py-0.5 text-xs text-red-300"
        title={j.eligibilityReason ?? "ineligible"}
      >
        ✗
      </span>
    );
  return (
    <span
      className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400"
      title={j.eligibilityReason ?? "eligibility unknown"}
    >
      ?
    </span>
  );
}

function JobCard({
  j,
  onApply,
  onSkip,
  onSave,
  saved,
}: {
  j: JobRow;
  onApply: () => void;
  onSkip: () => void;
  onSave: () => void;
  saved: boolean;
}) {
  const excerpt = stripHtml(j.description ?? "");

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <a
            href={j.url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-base hover:underline"
          >
            {j.company}
          </a>
          <div className="text-neutral-300 text-sm">{j.title}</div>
        </div>
        {/* Badges */}
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {j.score != null && (
            <span className="rounded bg-indigo-900 px-1.5 py-0.5 text-xs text-indigo-200">
              {j.score}
            </span>
          )}
          <EligBadge j={j} />
          {j.payTier === "high" && (
            <span className="rounded bg-green-900 px-1.5 py-0.5 text-xs text-green-200" title="High pay band">
              💰 high
            </span>
          )}
          {j.region && j.region !== "unknown" && j.region !== "other" && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs uppercase text-neutral-300" title="Region">
              {j.region}
            </span>
          )}
          {j.isInternship && (
            <span className="rounded bg-purple-900 px-1.5 py-0.5 text-xs text-purple-200" title="Internship">
              intern
            </span>
          )}
          {j.aiFriendly != null && j.aiFriendly >= 60 && (
            <span
              className="rounded bg-sky-900 px-1.5 py-0.5 text-xs text-sky-200"
              title="AI-friendly company signal"
            >
              AI {j.aiFriendly}
            </span>
          )}
        </div>
      </div>

      {/* Meta line */}
      <div className="text-xs text-neutral-500">
        {[j.salary, j.location, j.source].filter(Boolean).join(" · ")}
      </div>

      {/* Reason */}
      {j.reason && (
        <div className="text-xs italic text-neutral-400">{j.reason}</div>
      )}

      {/* Description excerpt */}
      {excerpt && (
        <p className="line-clamp-3 text-xs text-neutral-400">{excerpt}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onApply}
          className="rounded bg-emerald-700 px-3 py-1 text-xs font-medium hover:bg-emerald-600"
        >
          Apply
        </button>
        <button
          onClick={onSkip}
          className="rounded bg-neutral-800 px-3 py-1 text-xs font-medium hover:bg-neutral-700"
        >
          Skip
        </button>
        {saved ? (
          <span className="rounded border border-amber-700 px-3 py-1 text-xs text-amber-400">
            Saved ✓
          </span>
        ) : (
          <button
            onClick={onSave}
            className="rounded border border-amber-700 px-3 py-1 text-xs font-medium text-amber-400 hover:border-amber-500 hover:text-amber-300"
          >
            ☆ Save
          </button>
        )}
      </div>
    </div>
  );
}

async function patchJob(id: string, patch: Record<string, unknown>) {
  await fetch("/api/jobs", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
}

export function Feed({
  initialJobs,
  followUps,
}: {
  initialJobs: JobRow[];
  followUps: JobRow[];
}) {
  const [jobs, setJobs] = useState<JobRow[]>(initialJobs);
  const [followUpJobs, setFollowUpJobs] = useState<JobRow[]>(followUps);
  const [showSeen, setShowSeen] = useState(false);
  const [region, setRegion] = useState<string>("");
  const [highPayOnly, setHighPayOnly] = useState(false);
  const [internOnly, setInternOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  function buildQuery(over: { showSeen?: boolean; region?: string; highPayOnly?: boolean; internOnly?: boolean } = {}) {
    const seen = over.showSeen ?? showSeen;
    const rg = over.region ?? region;
    const hp = over.highPayOnly ?? highPayOnly;
    const io = over.internOnly ?? internOnly;
    const p = new URLSearchParams({ status: "to_apply", eligibility: "eligible,unknown" });
    if (!seen) p.set("unseen", "true");
    if (rg) p.set("region", rg);
    if (hp) p.set("payTier", "high");
    if (io) p.set("internship", "true");
    return `/api/jobs?${p}`;
  }

  async function applyFilters(over: { showSeen?: boolean; region?: string; highPayOnly?: boolean; internOnly?: boolean } = {}) {
    const r = await fetch(buildQuery(over));
    const data = await r.json().catch(() => ({ jobs: [] }));
    setJobs(data.jobs ?? []);
  }

  async function handleRefresh() {
    setBusy(true);
    setRefreshResult(null);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const data: RefreshResult = await r.json().catch(() => ({}));
      setRefreshResult(data);
    } catch {
      setRefreshResult({ match: { error: "refresh failed — try again" } });
    } finally {
      // let the summary strip paint, then re-render server-side with new jobs
      setTimeout(() => window.location.reload(), 1800);
    }
  }

  async function toggleShowSeen() {
    const next = !showSeen;
    setShowSeen(next);
    await applyFilters({ showSeen: next });
  }

  async function handleApply(j: JobRow) {
    // must run synchronously with the click — popup blockers kill it after an await
    window.open(j.url, "_blank");
    await patchJob(j.id, { status: "applied", seen: true });
    setJobs((prev) => prev.filter((x) => x.id !== j.id));
    // fire-and-forget kit generation — do not await; visible later in Pipeline
    fetch("/api/kit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: j.id }),
    }).catch(() => {});
  }

  async function handleSkip(j: JobRow) {
    await patchJob(j.id, { status: "archived", seen: true });
    setJobs((prev) => prev.filter((x) => x.id !== j.id));
  }

  async function handleSave(j: JobRow) {
    await patchJob(j.id, { starred: true, seen: true });
    setSavedIds((prev) => new Set(prev).add(j.id));
    // brief flash then remove card
    setTimeout(() => {
      setJobs((prev) => prev.filter((x) => x.id !== j.id));
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(j.id);
        return next;
      });
    }, 1200);
  }

  async function handleFollowUpStatus(j: JobRow, status: "interviewing" | "rejected") {
    await patchJob(j.id, { status });
    setFollowUpJobs((prev) => prev.filter((x) => x.id !== j.id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold flex-1">
          Today — {jobs.length} new match{jobs.length !== 1 ? "es" : ""}
        </h1>
        <button
          onClick={handleRefresh}
          disabled={busy}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Scanning…" : "Refresh radar"}
        </button>
        <button
          onClick={toggleShowSeen}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            showSeen
              ? "bg-neutral-700 hover:bg-neutral-600"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
        >
          {showSeen ? "Hide seen" : "Show seen"}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-neutral-500">Region:</span>
        {[
          { v: "", label: "All" },
          { v: "us", label: "US" },
          { v: "eu", label: "EU" },
          { v: "au", label: "AU" },
          { v: "worldwide", label: "WW" },
        ].map((r) => (
          <button
            key={r.v || "all"}
            onClick={() => { setRegion(r.v); applyFilters({ region: r.v }); }}
            className={`rounded px-2 py-1 font-medium ${region === r.v ? "bg-indigo-700 text-indigo-100" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}
          >
            {r.label}
          </button>
        ))}
        <span className="mx-1 text-neutral-700">|</span>
        <button
          onClick={() => { const n = !highPayOnly; setHighPayOnly(n); applyFilters({ highPayOnly: n }); }}
          className={`rounded px-2 py-1 font-medium ${highPayOnly ? "bg-green-800 text-green-100" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}
        >
          💰 High-pay
        </button>
        <button
          onClick={() => { const n = !internOnly; setInternOnly(n); applyFilters({ internOnly: n }); }}
          className={`rounded px-2 py-1 font-medium ${internOnly ? "bg-purple-800 text-purple-100" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}
        >
          Internships
        </button>
      </div>

      {/* Follow-up strip */}
      {followUpJobs.length > 0 && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-amber-300">
            Needs follow-up — applied 7+ days ago, no movement:
          </p>
          <ul className="space-y-1">
            {followUpJobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-neutral-300">
                  {j.company} —{" "}
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline"
                  >
                    {j.title}
                  </a>
                </span>
                <button
                  onClick={() => handleFollowUpStatus(j, "interviewing")}
                  className="rounded bg-emerald-900 px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-800"
                >
                  Mark interviewing
                </button>
                <button
                  onClick={() => handleFollowUpStatus(j, "rejected")}
                  className="rounded bg-red-900/50 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900"
                >
                  Mark rejected
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Refresh summary (shown briefly before reload) */}
      {refreshResult && (
        <div className="rounded bg-neutral-800 px-4 py-2 text-xs text-neutral-400">
          {Array.isArray(refreshResult.scrape) && (
            <span>
              {(refreshResult.scrape as ScrapeReport[]).map((r) => (
                <span key={r.source} className={r.ok ? "mr-3" : "mr-3 text-red-400"}>
                  {r.ok ? `✓ ${r.source} +${r.inserted}` : `✗ ${r.source}: ${r.error}`}
                </span>
              ))}
            </span>
          )}
          {refreshResult.match && "scored" in refreshResult.match && (
            <span className="ml-2">{refreshResult.match.scored} scored</span>
          )}
          {refreshResult.match && "error" in refreshResult.match && (
            <span className="ml-2 text-amber-400">{refreshResult.match.error}</span>
          )}
        </div>
      )}

      {/* Job cards */}
      {jobs.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-400">
          <p className="text-base">No new matches.</p>
          <p className="mt-1 text-sm">
            Hit <span className="text-emerald-400">Refresh radar</span>, or lower your filters in
            Pipeline.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => (
            <JobCard
              key={j.id}
              j={j}
              onApply={() => handleApply(j)}
              onSkip={() => handleSkip(j)}
              onSave={() => handleSave(j)}
              saved={savedIds.has(j.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
