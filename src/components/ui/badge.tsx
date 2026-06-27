import { cn } from "@/lib/ui";

type Variant = "neutral" | "accent" | "success" | "danger" | "muted";

const VARIANTS: Record<Variant, string> = {
  neutral: "bg-surface-raised border border-hairline text-ink-dim",
  accent: "bg-accent-soft text-accent",
  success: "bg-positive-soft text-positive",
  danger: "bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-300",
  muted: "text-ink-faint",
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
