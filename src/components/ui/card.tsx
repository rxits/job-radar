import { cn } from "@/lib/ui";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border border-hairline bg-surface shadow-soft-sm transition-all duration-150 ease-deck",
        className,
      )}
    />
  );
}
