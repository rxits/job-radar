"use client";
import { useState } from "react";
import type { Contact, JobRow, Kit } from "@/lib/types";
import { Markdown } from "@/lib/markdown";

type Tab = "resume" | "cover" | "outreach";

export function KitView({ job, kit: initialKit, contact: initialContact }: { job: JobRow; kit: Kit | null; contact: Contact | null }) {
  const [kit, setKit] = useState<Kit | null>(initialKit);
  const [tab, setTab] = useState<Tab>("resume");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact | null>(initialContact);
  const [findingContact, setFindingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  async function findContact() {
    setFindingContact(true);
    setContactError(null);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "lookup failed");
      setContact(data);
    } catch (e) {
      setContactError(e instanceof Error ? e.message : String(e));
    } finally {
      setFindingContact(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      const r = await fetch("/api/kit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "generation failed");
      setKit({ ...data, createdAt: new Date().toISOString(), model: "gemini-2.5-pro" });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate() {
    if (!confirm("Overwrite the current kit?")) return;
    await generate();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <>
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl space-y-4">
        <div className="no-print flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{job.company}</h1>
            <p className="text-neutral-400 text-sm">{job.title}</p>
          </div>
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-emerald-400 hover:underline shrink-0"
          >
            View posting ↗
          </a>
        </div>

        {/* Contact panel */}
        <div className="no-print rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-300">Who to contact</h2>
            <button
              onClick={findContact}
              disabled={findingContact}
              className="rounded bg-sky-800 px-3 py-1 text-xs font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {findingContact ? "Searching…" : contact ? "Re-find" : "Find contact"}
            </button>
          </div>
          {contactError && <p className="text-xs text-red-400">{contactError}</p>}
          {!contact && !contactError && (
            <p className="text-xs text-neutral-500">No contact looked up yet — find the founder/recruiter and a best-guess email.</p>
          )}
          {contact && (
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-neutral-200">{contact.personName ?? "Unknown person"}</span>
                {contact.personTitle && <span className="text-neutral-500">· {contact.personTitle}</span>}
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    contact.confidence === "found"
                      ? "bg-emerald-900 text-emerald-200"
                      : contact.confidence === "guessed"
                        ? "bg-amber-900 text-amber-200"
                        : "bg-neutral-800 text-neutral-400"
                  }`}
                  title="email confidence"
                >
                  {contact.confidence}
                </span>
              </div>
              {contact.emails.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {contact.emails.map((e) => (
                    <button
                      key={e}
                      onClick={() => copy(e)}
                      className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200 hover:bg-neutral-700"
                      title="copy email"
                    >
                      {e} ⧉
                    </button>
                  ))}
                </div>
              )}
              {contact.links.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {contact.links.map((l) => (
                    <a key={l} href={l} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                      {l.replace(/^https?:\/\//, "").slice(0, 40)} ↗
                    </a>
                  ))}
                </div>
              )}
              <p className="text-xs text-neutral-600">source: {contact.source}</p>
            </div>
          )}
        </div>

        {!kit ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 space-y-4 no-print">
            <p className="text-neutral-300">
              Generate a tailored application kit for this role — a resume, cover letter, and outreach email,
              all produced in one call by <span className="text-emerald-400">gemini-2.5-pro</span> under
              truthful re-emphasis rules. No data is invented; your resume is the single source of truth.
            </p>
            {genError && <p className="text-red-400 text-sm">{genError}</p>}
            <button
              onClick={generate}
              disabled={generating}
              className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
            >
              {generating ? "Writing your application with gemini-2.5-pro… ~30s" : "Generate kit"}
            </button>
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="no-print flex gap-1 border-b border-neutral-800">
              {(["resume", "cover", "outreach"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-sm font-medium capitalize rounded-t transition-colors ${
                    tab === t
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {t === "cover" ? "Cover letter" : t === "outreach" ? "Outreach email" : "Resume"}
                </button>
              ))}
            </div>

            {/* Resume tab */}
            {tab === "resume" && (
              <div className="space-y-3">
                <div
                  className="bg-white text-neutral-900 rounded-lg p-8 print:p-0 print:rounded-none
                    [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold
                    [&_h2]:mt-4 [&_h2]:border-b [&_h2]:border-neutral-300 [&_h2]:pb-0.5
                    [&_li]:text-sm [&_p]:text-sm leading-snug [&_ul]:list-disc [&_ul]:pl-5
                    [&_ul]:space-y-0.5 [&_strong]:font-semibold"
                >
                  <Markdown md={kit.resumeMd} />
                </div>
                <div className="no-print flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="rounded bg-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-600"
                  >
                    Print / Save PDF
                  </button>
                  <button
                    onClick={() => copy(kit.resumeMd)}
                    className="rounded bg-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-600"
                  >
                    Copy Markdown
                  </button>
                </div>
              </div>
            )}

            {/* Cover letter tab */}
            {tab === "cover" && (
              <div className="space-y-3">
                <pre className="whitespace-pre-wrap rounded bg-neutral-900 p-4 text-sm text-neutral-200">
                  {kit.coverMd}
                </pre>
                <div className="no-print">
                  <button
                    onClick={() => copy(kit.coverMd)}
                    className="rounded bg-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-600"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Outreach email tab */}
            {tab === "outreach" && (
              <div className="space-y-3">
                <pre className="whitespace-pre-wrap rounded bg-neutral-900 p-4 text-sm text-neutral-200">
                  {kit.outreachMd}
                </pre>
                <div className="no-print">
                  <button
                    onClick={() => copy(kit.outreachMd)}
                    className="rounded bg-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-600"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Regenerate */}
            <div className="no-print pt-2">
              <button
                onClick={regenerate}
                disabled={generating}
                className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
              >
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
              {genError && <span className="ml-3 text-xs text-red-400">{genError}</span>}
              {kit.createdAt && (
                <span className="ml-3 text-xs text-neutral-600">
                  Generated {new Date(kit.createdAt).toLocaleDateString()} · {kit.model}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
