import { cn } from "@/lib/ui";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover font-semibold shadow-soft-sm",
  ghost: "bg-surface text-ink-dim hover:text-ink hover:bg-surface-raised border border-hairline",
  danger: "bg-transparent text-red-500 border border-red-200 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "ghost",
  size = "sm",
  className,
  ...props
}: { variant?: Variant; size?: Size } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full transition-all duration-150 ease-deck disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    />
  );
}
