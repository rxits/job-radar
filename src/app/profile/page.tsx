"use client";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [resumeText, setResume] = useState("");
  const [coreSkills, setSkills] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetch("/api/profile").then((r) => r.json()).then((p) => { setResume(p.resumeText); setSkills(p.coreSkills); }); }, []);
  async function save() {
    await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resumeText, coreSkills }) });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  return (
    <div className="max-w-2xl space-y-3">
      <h1 className="text-lg font-semibold">Profile</h1>
      <p className="text-sm text-neutral-400">Used by Gemini to score jobs. Stored locally only.</p>
      <label className="block text-sm">Resume text
        <textarea value={resumeText} onChange={(e) => setResume(e.target.value)} rows={14} className="mt-1 w-full rounded bg-neutral-900 p-2 text-sm" />
      </label>
      <label className="block text-sm">Core skills (comma-separated)
        <input value={coreSkills} onChange={(e) => setSkills(e.target.value)} className="mt-1 w-full rounded bg-neutral-900 p-2 text-sm" />
      </label>
      <button onClick={save} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">{saved ? "Saved ✓" : "Save"}</button>
    </div>
  );
}
