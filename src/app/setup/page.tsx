"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ScrapeReport } from "@/lib/scrape";

type Step = 1 | 2 | 3;

interface RefreshResult {
  scrape?: ScrapeReport[];
  match?: { scored?: number; failedBatches?: number; failedJobs?: number } | { error: string };
}

const STEPS: { label: string }[] = [
  { label: "Resume" },
  { label: "Location" },
  { label: "Start" },
];

function Stepper({ step }: { step: Step }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-3">
      {STEPS.map((s, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <div key={n} className="flex items-center gap-3">
            {i > 0 && <div className="h-px w-8 bg-neutral-700" />}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  active
                    ? "bg-emerald-600 text-white"
                    : done
                    ? "bg-emerald-900 text-emerald-300"
                    : "bg-neutral-800 text-neutral-500"
                }`}
              >
                {done ? "✓" : n}
              </div>
              <span
                className={`text-xs ${active ? "text-emerald-400" : done ? "text-emerald-600" : "text-neutral-500"}`}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [editMode, setEditMode] = useState(false);

  // Step 1
  const [resumeText, setResumeText] = useState("");
  const [coreSkills, setCoreSkills] = useState("");

  // Step 2
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("");
  const [preferences, setPreferences] = useState("");

  // Step 3
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);

  // On mount: prefill if profile exists
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        if (p.resumeText?.trim()) {
          setEditMode(true);
          setResumeText(p.resumeText ?? "");
          setCoreSkills(p.coreSkills ?? "");
          setLocation(p.location ?? "");
          setTimezone(p.timezone ?? "");
          setPreferences(p.preferences ?? "");
        }
      })
      .catch(() => {});
  }, []);

  async function saveProfile() {
    await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resumeText, coreSkills, location, timezone, preferences }),
    });
  }

  async function startRadar() {
    setScanning(true);
    setResult(null);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const data: RefreshResult = await r.json().catch(() => ({}));
      setResult(data);
    } finally {
      setScanning(false);
    }
  }

  const totalInserted = Array.isArray(result?.scrape)
    ? (result.scrape as ScrapeReport[]).reduce((sum, r) => sum + (r.inserted ?? 0), 0)
    : 0;
  const matchResult = result?.match;
  const matchError = matchResult && "error" in matchResult ? matchResult.error : null;
  const scored = matchResult && "scored" in matchResult ? matchResult.scored : null;

  return (
    <div className="mx-auto max-w-xl py-12">
      <h1 className="mb-2 text-center text-2xl font-bold">
        {editMode ? "Settings" : "Set up your radar"}
      </h1>
      <p className="mb-8 text-center text-sm text-neutral-400">
        {editMode
          ? "Update your profile — changes take effect on the next refresh."
          : "Answer three quick questions to personalise your job feed."}
      </p>

      <Stepper step={step} />

      {step === 1 && (
        <div className="rounded-lg bg-neutral-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Your resume</h2>
          <p className="text-sm text-neutral-400">
            Paste your resume text (or a summary). Gemini will use it to score job fit.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-300">Resume text</label>
            <textarea
              rows={14}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume here…"
              className="w-full rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-300">Core skills (comma-separated)</label>
            <input
              type="text"
              value={coreSkills}
              onChange={(e) => setCoreSkills(e.target.value)}
              placeholder="TypeScript, React, Node.js, Python…"
              className="w-full rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!resumeText.trim()}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-lg bg-neutral-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Where you are</h2>
          <p className="text-sm text-neutral-400">
            Used to check eligibility rules (visa sponsorship, location requirements).
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-300">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country — e.g. Berlin, Germany"
              className="w-full rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-300">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="CET (UTC+1) — optional"
              className="w-full rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-300">Preferences</label>
            <textarea
              rows={3}
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="Roles you want, constraints, what kind of companies…"
              className="w-full rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700"
            >
              ← Back
            </button>
            <button
              onClick={async () => { await saveProfile(); setStep(3); }}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-lg bg-neutral-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Start the radar</h2>
          {!result ? (
            <>
              <p className="text-sm text-neutral-400">
                Scrapes 7 job boards, checks every job against your location, and scores fit with
                Gemini — takes a few minutes.
              </p>
              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="rounded bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700"
                  disabled={scanning}
                >
                  ← Back
                </button>
                <button
                  onClick={startRadar}
                  disabled={scanning}
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                >
                  {scanning
                    ? "Scanning the boards and scoring matches — this can take a few minutes…"
                    : "Start"}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded bg-neutral-800 px-4 py-3 text-sm">
                <p className="font-medium text-neutral-200">Scan complete</p>
                <p className="text-neutral-400">
                  {totalInserted} new job{totalInserted !== 1 ? "s" : ""} found
                  {scored !== null ? `, ${scored} scored` : ""}
                </p>
                {matchError && (
                  <p className="mt-1 text-amber-400">Scoring note: {matchError}</p>
                )}
                {Array.isArray(result?.scrape) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(result.scrape as ScrapeReport[]).map((r) => (
                      <span
                        key={r.source}
                        className={`text-xs ${r.ok ? "text-neutral-500" : "text-red-400"}`}
                      >
                        {r.ok
                          ? `✓ ${r.source} +${r.inserted}`
                          : `✗ ${r.source}: ${r.error}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => router.push("/")}
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
                >
                  Open Today feed →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
