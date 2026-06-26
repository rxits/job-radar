import { cn, scoreTier, tierMeta } from "@/lib/ui";

export function Meter({ score }: { score: number | null }) {
  const tier = scoreTier(score);
  const meta = tierMeta(tier);
  const pct = score == null ? 0 : Math.max(4, Math.min(100, score));
  return (
    <div className="flex items-center gap-2" title={`${meta.label}${score != null ? ` · ${score}/100` : ""}`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-hairline">
        <div className={cn("h-full rounded-full transition-all duration-300 ease-deck", meta.barClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("font-mono text-xs tabular-nums", meta.textClass)}>
        {score ?? "—"}
      </span>
    </div>
  );
}
