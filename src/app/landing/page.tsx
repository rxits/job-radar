"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Radar, ShieldCheck, Gauge, FileText, Users, KanbanSquare,
  Sparkles, ArrowRight, Check, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fadeInUp, staggerParent, staggerChild } from "@/lib/motion";

const STEPS = [
  { n: "01", title: "Connect", body: "Paste your resume and your own Gemini key. Your key is encrypted; your data never leaves your account.", icon: Lock },
  { n: "02", title: "Radar scans", body: "Nine boards, fetched and de-duplicated. Each role is filtered to what you're actually eligible for, then scored against your resume.", icon: Radar },
  { n: "03", title: "Apply in one click", body: "Hit Apply and get a tailored resume, cover letter, and a founder-addressed outreach email — ready to send.", icon: Sparkles },
];

const FEATURES = [
  { title: "Eligibility engine", body: "Two-stage geo filtering kills the roles you can't legally take before they ever reach you.", icon: ShieldCheck },
  { title: "AI match scores", body: "Every role scored 0–100 against your resume, with a one-line reason and an AI-friendliness read.", icon: Gauge },
  { title: "Application kits", body: "Resume + cover + outreach, generated per job. Never invents facts — mirrors what's real in your resume.", icon: FileText },
  { title: "Contact finder", body: "Surfaces the founder or recruiter and a best-guess email, wired into your outreach draft.", icon: Users },
  { title: "Pipeline tracker", body: "Kanban from To-Apply to Offer, with follow-up nudges when something's gone quiet.", icon: KanbanSquare },
  { title: "Daily digest", body: "A morning briefing of your top matches and the follow-ups that need a nudge.", icon: Sparkles },
];

export default function Landing() {
  return (
    <div className="relative -mx-5 -my-7 overflow-hidden">
      {/* ambient accent glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--accent-soft),transparent_70%)]" />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent-soft text-accent">
            <Radar size={16} strokeWidth={2.5} />
          </span>
          job-radar
        </div>
        <Link href="/login">
          <Button variant="ghost" size="md">Sign in</Button>
        </Link>
      </header>

      {/* Hero */}
      <motion.section
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto max-w-3xl px-5 pt-16 pb-10 text-center"
      >
        <motion.div variants={staggerChild} className="mb-5 flex justify-center">
          <Badge variant="accent" className="px-2.5 py-1">
            <Sparkles size={12} /> Bring your own Gemini key · your data stays yours
          </Badge>
        </motion.div>
        <motion.h1
          variants={staggerChild}
          className="text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
        >
          Find the remote jobs<br />you can <span className="text-accent">actually get</span>.
        </motion.h1>
        <motion.p
          variants={staggerChild}
          className="mx-auto mt-6 max-w-xl text-pretty text-lg text-ink-dim"
        >
          job-radar scrapes nine boards, filters to the roles you're eligible for,
          scores every match against your resume with AI, and writes the application
          for you — so you spend your time interviewing, not searching.
        </motion.p>
        <motion.div variants={staggerChild} className="mt-8 flex items-center justify-center gap-3">
          <Link href="/login">
            <Button variant="primary" size="md" className="gap-2">
              Get started — it's free <ArrowRight size={15} />
            </Button>
          </Link>
          <a href="#how">
            <Button variant="ghost" size="md">See how it works</Button>
          </a>
        </motion.div>
        <motion.div variants={staggerChild} className="mt-6 flex items-center justify-center gap-5 font-mono text-xs text-ink-faint">
          <span className="flex items-center gap-1.5"><Check size={12} className="text-accent" /> 9 free sources</span>
          <span className="flex items-center gap-1.5"><Check size={12} className="text-accent" /> $0 to run</span>
          <span className="flex items-center gap-1.5"><Check size={12} className="text-accent" /> keys encrypted</span>
        </motion.div>
      </motion.section>

      {/* Product preview */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto mt-6 max-w-3xl px-5"
      >
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-1.5 border-b border-hairline bg-surface-raised px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
            <span className="ml-3 font-mono text-[11px] text-ink-faint">job-radar · today</span>
          </div>
          <div className="space-y-3 p-5">
            {[
              { c: "Linear", t: "Senior AI Engineer", s: 92, tier: "bg-accent", w: "92%" },
              { c: "Vercel", t: "Full-Stack Engineer, AI", s: 78, tier: "bg-emerald-400", w: "78%" },
              { c: "Supabase", t: "Developer Experience Eng", s: 71, tier: "bg-emerald-400", w: "71%" },
            ].map((j) => (
              <div key={j.c} className="flex items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{j.c}</div>
                  <div className="text-xs text-ink-dim">{j.t}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-hairline">
                    <div className={`h-full rounded-full ${j.tier}`} style={{ width: j.w }} />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-ink-dim">{j.s}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* How it works */}
      <section id="how" className="relative z-10 mx-auto max-w-5xl px-5 py-24">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-ink-faint">How it works</h2>
        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-10 grid gap-4 sm:grid-cols-3"
        >
          {STEPS.map((s) => (
            <motion.div key={s.n} variants={staggerChild}>
              <Card className="h-full p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
                    <s.icon size={18} />
                  </span>
                  <span className="font-mono text-sm text-ink-faint">{s.n}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-ink-dim">{s.body}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-24">
        <h2 className="text-center text-3xl font-bold tracking-tight">Everything the hunt needs</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink-dim">
          One radar from first scrape to sent application — no spreadsheets, no tab chaos.
        </p>
        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <motion.div key={f.title} variants={staggerChild}>
              <Card className="h-full p-5 hover:border-hairline-strong">
                <f.icon size={18} className="text-accent" />
                <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-ink-dim">{f.body}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-5 pb-28">
        <Card className="relative overflow-hidden p-10 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_50%_0%,var(--accent-soft),transparent_60%)]" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight">Stop scrolling job boards.</h2>
            <p className="mx-auto mt-3 max-w-md text-ink-dim">
              Point the radar at your resume and let it surface — and write — the roles worth your time.
            </p>
            <Link href="/login">
              <Button variant="primary" size="md" className="mt-6 gap-2">
                Get started — it's free <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-hairline">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-ink-faint">
          <span>© job-radar</span>
          <span className="font-mono">built with Next.js · Supabase · Gemini</span>
        </div>
      </footer>
    </div>
  );
}
