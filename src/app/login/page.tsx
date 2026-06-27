"use client";
// VISUAL PREVIEW — Task 3 (S0) replaces the inert handlers with real Supabase auth
// (createBrowserClient + signInWithPassword / signUp / signInWithOAuth). Rendered
// without env so it can be previewed before the Supabase project exists.
import { useState } from "react";
import Link from "next/link";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const notWired = () => setMsg("Auth wiring lands in S0 · Task 3 (Supabase) — preview only.");

  return (
    <div className="relative -mx-5 -my-7 min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(55%_55%_at_50%_0%,var(--accent-soft),transparent_70%)]" />
      <div className="relative z-10 mx-auto flex max-w-sm flex-col items-center px-5 pt-24">
        <Link href="/landing" className="mb-6 flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent-soft text-accent">
            <Radar size={16} strokeWidth={2.5} />
          </span>
          job-radar
        </Link>
        <Card className="w-full space-y-3 p-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Sign in</h1>
            <p className="text-sm text-ink-dim">Welcome back — let's check the radar.</p>
          </div>
          <input
            className="w-full rounded-md border border-hairline bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-ink-faint"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-hairline bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-ink-faint"
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={notWired}>Sign in</Button>
            <Button variant="ghost" className="flex-1" onClick={notWired}>Sign up</Button>
          </div>
          <div className="flex items-center gap-3 py-1 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-hairline" /> or <span className="h-px flex-1 bg-hairline" />
          </div>
          <Button variant="ghost" className="w-full" onClick={notWired}>Continue with Google</Button>
          {msg && <p className="text-center text-xs text-accent">{msg}</p>}
        </Card>
        <p className="mt-4 text-xs text-ink-faint">
          New here?{" "}
          <Link href="/landing" className="text-accent hover:underline">See what job-radar does</Link>
        </p>
      </div>
    </div>
  );
}
