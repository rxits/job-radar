import { cn } from "@/lib/ui";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-black hover:bg-accent-hover font-semibold",
  ghost: "bg-surface-raised text-ink-dim hover:text-ink hover:bg-hairline border border-hairline",
  danger: "bg-transparent text-red-400 border border-red-900/60 hover:bg-red-950/40",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-1.5 text-sm",
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
        "inline-flex items-center justify-center gap-1.5 rounded-md transition-colors duration-150 ease-deck disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    />
  );
}
