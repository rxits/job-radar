"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const [resumeText, setResume] = useState("");
  const [coreSkills, setSkills] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("");
  const [preferences, setPreferences] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((p) => {
      setResume(p.resumeText);
      setSkills(p.coreSkills);
      setLocation(p.location ?? "");
      setTimezone(p.timezone ?? "");
      setPreferences(p.preferences ?? "");
    });
  }, []);

  async function save() {
    await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resumeText, coreSkills, location, timezone, preferences }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="max-w-2xl space-y-3">
      <h1 className="text-lg font-semibold">Profile</h1>
      <p className="text-sm text-neutral-400">Used by Gemini to score jobs. Stored locally only.</p>
      <p className="text-sm text-neutral-500">Full setup wizard: <Link href="/setup" className="text-emerald-400 hover:underline">/setup</Link></p>
      <label className="block text-sm">Resume text
        <textarea value={resumeText} onChange={(e) => setResume(e.target.value)} rows={14} className="mt-1 w-full rounded bg-neutral-900 p-2 text-sm" />
      </label>
      <label className="block text-sm">Core skills (comma-separated)
        <input value={coreSkills} onChange={(e) => setSkills(e.target.value)} className="mt-1 w-full rounded bg-neutral-900 p-2 text-sm" />
      </label>
      <label className="block text-sm">Location
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, Country — e.g. Berlin, Germany"
          className="mt-1 w-full rounded bg-neutral-900 p-2 text-sm"
        />
      </label>
      <label className="block text-sm">Timezone
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="CET (UTC+1) — optional"
          className="mt-1 w-full rounded bg-neutral-900 p-2 text-sm"
        />
      </label>
      <label className="block text-sm">Preferences
        <textarea
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          rows={3}
          placeholder="Roles you want, constraints, what kind of companies…"
          className="mt-1 w-full rounded bg-neutral-900 p-2 text-sm"
        />
      </label>
      <button onClick={save} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">{saved ? "Saved ✓" : "Save"}</button>
    </div>
  );
}
