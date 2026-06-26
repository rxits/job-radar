import { cn } from "@/lib/ui";

type Variant = "neutral" | "accent" | "success" | "danger" | "muted";

const VARIANTS: Record<Variant, string> = {
  neutral: "border-hairline-strong text-ink-dim",
  accent: "border-accent/40 text-accent bg-accent-soft",
  success: "border-emerald-700/50 text-emerald-300",
  danger: "border-red-800/50 text-red-300",
  muted: "border-transparent text-ink-faint",
};

export function Badge({
  variant = "neutral",
  className,
  title,
  children,
}: {
  variant?: Variant;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
