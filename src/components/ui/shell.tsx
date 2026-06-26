"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, LayoutGrid, BarChart3, User } from "lucide-react";
import { cn } from "@/lib/ui";
import { Kbd } from "./kbd";

const LINKS = [
  { href: "/", label: "Today", icon: Radar },
  { href: "/pipeline", label: "Pipeline", icon: LayoutGrid },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-5 py-2.5">
          <Link href="/" className="mr-3 flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent-soft text-accent">
              <Radar size={14} strokeWidth={2.5} />
            </span>
            job-radar
          </Link>
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ease-deck",
                  active ? "bg-surface-raised text-ink" : "text-ink-faint hover:text-ink-dim",
                )}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-ink-faint">
            <span className="text-xs">Search</span>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-7">{children}</main>
    </>
  );
}
