import { cn } from "@/lib/ui";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-xl border border-hairline bg-surface transition-colors duration-150 ease-deck",
        className,
      )}
    />
  );
}
