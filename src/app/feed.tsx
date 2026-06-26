"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, MapPin, Building2 } from "lucide-react";
import type { JobRow } from "@/lib/types";
import type { ScrapeReport } from "@/lib/scrape";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { cn, regionLabel } from "@/lib/ui";
import { staggerParent, staggerChild } from "@/lib/motion";

interface RefreshResult {
  scrape?: ScrapeReport[];
  match?: { scored?: number; failedBatches?: number; failedJobs?: number } | { error: string };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function EligBadge({ j }: { j: JobRow }) {
  if (j.eligibility === "eligible")
    return <Badge variant="success" title={j.eligibilityReason ?? "eligible"}>eligible</Badge>;
  if (j.eligibility === "ineligible")
    return <Badge variant="danger" title={j.eligibilityReason ?? "ineligible"}>ineligible</Badge>;
  return <Badge variant="muted" title={j.eligibilityReason ?? "eligibility unknown"}>unknown</Badge>;
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
  const region = regionLabel(j.region);
  const meta = [j.salary, j.location, j.source].filter(Boolean) as string[];

  return (
    <Card className="group p-4 hover:border-hairline-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={j.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink hover:text-accent"
          >
            <Building2 size={14} className="text-ink-faint" />
            {j.company}
            <ExternalLink size={12} className="opacity-0 transition-opacity group-hover:opacity-60" />
          </a>
          <div className="truncate text-sm text-ink-dim">{j.title}</div>
        </div>
        <div className="shrink-0">{j.score != null && <Meter score={j.score} />}</div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <EligBadge j={j} />
        {j.payTier === "high" && <Badge variant="accent" title="High pay band">high&nbsp;pay</Badge>}
        {region && <Badge title="Region">{region}</Badge>}
        {j.isInternship && <Badge title="Internship">intern</Badge>}
        {j.aiFriendly != null && j.aiFriendly >= 60 && (
          <Badge title="AI-friendly company signal">AI&nbsp;{j.aiFriendly}</Badge>
        )}
      </div>

      {meta.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-ink-faint">
          {meta.map((bit, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i === 1 && j.location && <MapPin size={10} />}
              {bit}
              {i < meta.length - 1 && <span className="text-hairline-strong">·</span>}
            </span>
          ))}
        </div>
      )}

      {j.reason && <p className="mt-2 text-xs italic text-ink-dim">{j.reason}</p>}
      {excerpt && <p className="mt-1 line-clamp-2 text-xs text-ink-faint">{excerpt}</p>}

      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" onClick={onApply}>Apply</Button>
        <Button variant="ghost" onClick={onSkip}>Skip</Button>
        {saved ? (
          <Badge variant="accent" className="px-2.5 py-1">Saved ✓</Badge>
        ) : (
          <Button variant="ghost" onClick={onSave}>☆ Save</Button>
        )}
      </div>
    </Card>
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

  const regions = [
    { v: "", label: "All" },
    { v: "us", label: "US" },
    { v: "eu", label: "EU" },
    { v: "au", label: "AU" },
    { v: "worldwide", label: "WW" },
  ];

  const toggleClass = (active: boolean) =>
    cn(
      "rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 ease-deck",
      active ? "bg-accent-soft text-accent" : "bg-surface-raised text-ink-faint hover:text-ink-dim",
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-xl font-bold tracking-tight">
          Today <span className="font-mono text-ink-faint">· {jobs.length} new</span>
        </h1>
        <Button variant="primary" size="md" onClick={handleRefresh} disabled={busy}>
          {busy ? "Scanning…" : "Refresh radar"}
        </Button>
        <Button variant="ghost" size="md" onClick={toggleShowSeen}>
          {showSeen ? "Hide seen" : "Show seen"}
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-faint">Region</span>
        {regions.map((r) => (
          <button
            key={r.v || "all"}
            onClick={() => { setRegion(r.v); applyFilters({ region: r.v }); }}
            className={toggleClass(region === r.v)}
          >
            {r.label}
          </button>
        ))}
        <span className="mx-1 text-hairline-strong">|</span>
        <button
          onClick={() => { const n = !highPayOnly; setHighPayOnly(n); applyFilters({ highPayOnly: n }); }}
          className={toggleClass(highPayOnly)}
        >
          High-pay
        </button>
        <button
          onClick={() => { const n = !internOnly; setInternOnly(n); applyFilters({ internOnly: n }); }}
          className={toggleClass(internOnly)}
        >
          Internships
        </button>
      </div>

      {/* Follow-up strip */}
      {followUpJobs.length > 0 && (
        <Card className="border-accent/30 bg-accent-soft px-4 py-3">
          <p className="text-sm font-medium text-accent">
            Needs follow-up — applied 7+ days ago, no movement:
          </p>
          <ul className="mt-2 space-y-1.5">
            {followUpJobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-dim">
                  {j.company} —{" "}
                  <a href={j.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {j.title}
                  </a>
                </span>
                <Button variant="ghost" onClick={() => handleFollowUpStatus(j, "interviewing")}>
                  Mark interviewing
                </Button>
                <Button variant="danger" onClick={() => handleFollowUpStatus(j, "rejected")}>
                  Mark rejected
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Refresh summary (shown briefly before reload) */}
      {refreshResult && (
        <div className="rounded-md border border-hairline bg-surface px-4 py-2 font-mono text-[11px] text-ink-faint">
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
            <span className="ml-2 text-emerald-300">{refreshResult.match.scored} scored</span>
          )}
          {refreshResult.match && "error" in refreshResult.match && (
            <span className="ml-2 text-accent">{refreshResult.match.error}</span>
          )}
        </div>
      )}

      {/* Job cards */}
      {jobs.length === 0 ? (
        <Card className="p-10 text-center text-ink-dim">
          <p className="text-base">No new matches.</p>
          <p className="mt-1 text-sm text-ink-faint">
            Hit <span className="text-accent">Refresh radar</span>, or lower your filters in Pipeline.
          </p>
        </Card>
      ) : (
        <motion.div className="space-y-3" variants={staggerParent} initial="hidden" animate="show">
          {jobs.map((j) => (
            <motion.div key={j.id} variants={staggerChild}>
              <JobCard
                j={j}
                onApply={() => handleApply(j)}
                onSkip={() => handleSkip(j)}
                onSave={() => handleSave(j)}
                saved={savedIds.has(j.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
