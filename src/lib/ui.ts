export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type Tier = "low" | "mid" | "high" | "elite";

export function scoreTier(score: number | null): Tier {
  if (score == null) return "low";
  if (score >= 85) return "elite";
  if (score >= 70) return "high";
  if (score >= 50) return "mid";
  return "low";
}

export function tierMeta(tier: Tier): { label: string; barClass: string; textClass: string } {
  switch (tier) {
    case "elite": return { label: "Elite match", barClass: "bg-accent", textClass: "text-accent" };
    case "high":  return { label: "Strong match", barClass: "bg-emerald-400", textClass: "text-emerald-300" };
    case "mid":   return { label: "Fair match", barClass: "bg-ink-dim", textClass: "text-ink-dim" };
    case "low":   return { label: "Weak match", barClass: "bg-ink-faint", textClass: "text-ink-faint" };
  }
}

const REGION_LABELS: Record<string, string> = {
  us: "US", eu: "EU", au: "AU", worldwide: "Worldwide",
};

export function regionLabel(region: string | null): string | null {
  if (!region) return null;
  return REGION_LABELS[region] ?? null;
}
