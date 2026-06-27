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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { fadeInUp, staggerParent, staggerChild } from "@/lib/motion";

const STEPS = [
  { n: "01", title: "Tell us about you", body: "Add your resume and a few preferences. Connect an AI key — we'll walk you through it. Everything stays private to your account.", icon: Lock },
  { n: "02", title: "We find your matches", body: "job-radar checks the best job boards, keeps only the roles you're actually a fit for, and ranks them against your experience.", icon: Radar },
  { n: "03", title: "Apply in one click", body: "Get a tailored resume, a cover letter, and a friendly intro email — written for each role, ready for you to send.", icon: Sparkles },
];

const FEATURES = [
  { title: "Only jobs you can get", body: "We filter out the roles you're not eligible for, so you never waste time on a dead end.", icon: ShieldCheck },
  { title: "Know your best fits", body: "Every role gets a clear match score against your experience, with a plain-language reason why.", icon: Gauge },
  { title: "Applications, written for you", body: "A tailored resume and cover letter for each job — always honest, never inventing things you haven't done.", icon: FileText },
  { title: "Reach the right person", body: "We find the hiring manager or recruiter and draft a warm intro you can send in one tap.", icon: Users },
  { title: "Track every application", body: "A simple board from applied to offer, with gentle nudges when it's time to follow up.", icon: KanbanSquare },
  { title: "A daily heads-up", body: "A short morning note with your top new matches and anything that needs a follow-up.", icon: Sparkles },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ambient warm glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(70%_60%_at_50%_0%,var(--accent-soft),transparent_72%)]" />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-white">
            <Radar size={17} strokeWidth={2.5} />
          </span>
          job-radar
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="md">Sign in</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <motion.section
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto max-w-3xl px-5 pt-16 pb-10 text-center"
      >
        <motion.div variants={staggerChild} className="mb-5 flex justify-center">
          <Badge variant="accent" className="px-3 py-1">
            <Sparkles size={12} /> For every field, every career stage
          </Badge>
        </motion.div>
        <motion.h1
          variants={staggerChild}
          className="text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
        >
          The job hunt,<br />finally <span className="text-accent">on your side</span>.
        </motion.h1>
        <motion.p
          variants={staggerChild}
          className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-ink-dim"
        >
          job-radar finds the roles you're genuinely right for, ranks each one against
          your experience, and even writes your application for you — so you can put your
          energy into interviews instead of endless searching.
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
        <motion.div variants={staggerChild} className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-dim">
          <span className="flex items-center gap-1.5"><Check size={14} className="text-positive" /> Free to use</span>
          <span className="flex items-center gap-1.5"><Check size={14} className="text-positive" /> No spreadsheets</span>
          <span className="flex items-center gap-1.5"><Check size={14} className="text-positive" /> Your data stays private</span>
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
            <span className="ml-3 text-[11px] text-ink-faint">job-radar · your matches today</span>
          </div>
          <div className="space-y-3 p-5">
            {[
              { c: "Sunrise Health", t: "Registered Nurse — Pediatrics", s: 94, tier: "bg-accent", w: "94%" },
              { c: "Maple & Co.", t: "Marketing Manager", s: 81, tier: "bg-positive", w: "81%" },
              { c: "Brightpath Schools", t: "5th Grade Teacher", s: 74, tier: "bg-positive", w: "74%" },
            ].map((j) => (
              <div key={j.c} className="flex items-center justify-between rounded-xl border border-hairline bg-surface-raised px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{j.c}</div>
                  <div className="text-xs text-ink-dim">{j.t}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-hairline">
                    <div className={`h-full rounded-full ${j.tier}`} style={{ width: j.w }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-ink-dim">{j.s}</span>
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
          <span className="flex items-center gap-1.5">
            <Radar size={13} className="text-accent" /> job-radar
          </span>
          <span>Made to make the job hunt kinder.</span>
        </div>
      </footer>
    </div>
  );
}
