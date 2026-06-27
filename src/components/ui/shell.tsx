"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, LayoutGrid, BarChart3, User } from "lucide-react";
import { cn } from "@/lib/ui";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/", label: "Today", icon: Radar },
  { href: "/pipeline", label: "Pipeline", icon: LayoutGrid },
  { href: "/analytics", label: "Insights", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // Public / full-bleed pages render without the app chrome.
  const bare = path === "/landing" || path === "/login" || path.startsWith("/auth");
  if (bare) return <>{children}</>;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/85 backdrop-blur-md">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-5 py-3">
          <Link href="/" className="mr-3 flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-accent text-white">
              <Radar size={15} strokeWidth={2.5} />
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
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors duration-150 ease-deck",
                  active ? "bg-accent-soft text-accent" : "text-ink-dim hover:text-ink hover:bg-surface-raised",
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </>
  );
}
