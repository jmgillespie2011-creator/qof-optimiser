// QOF points / money calculators. Pure functions - unit-testable.
export type IndicatorYear = {
  points: number;
  lower_threshold: number | null;
  upper_threshold: number | null;
  pound_per_point: number;
};

// Linear payment scale: 0 below lower threshold, full points at/above upper.
export function pointsEarned(achievementPct: number, iy: IndicatorYear): number {
  const lo = iy.lower_threshold ?? 0;
  const hi = iy.upper_threshold ?? 100;
  if (hi <= lo) return achievementPct >= hi ? iy.points : 0;
  if (achievementPct <= lo) return 0;
  if (achievementPct >= hi) return iy.points;
  const frac = (achievementPct - lo) / (hi - lo);
  return Math.round(frac * iy.points * 100) / 100;
}

export function pointsShortfall(achievementPct: number, iy: IndicatorYear): number {
  return Math.round((iy.points - pointsEarned(achievementPct, iy)) * 100) / 100;
}

// Money left on the table if the indicator moved from current to the upper threshold.
export function moneyAtRisk(achievementPct: number, iy: IndicatorYear): number {
  return Math.round(pointsShortfall(achievementPct, iy) * iy.pound_per_point);
}

export function gbp(n: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

// RAG (red/amber/green) status vs payment thresholds.
export type Rag = "green" | "lime" | "amber" | "red" | "none";
export function rag(pct: number | null | undefined, lower: number | null, upper: number | null): Rag {
  if (pct == null || lower == null || upper == null) return "none";
  if (pct >= upper) return "green";
  if (pct >= (lower + upper) / 2) return "lime";
  if (pct >= lower) return "amber";
  return "red";
}
export const RAG_HEX: Record<string, string> = { green: "#007F3B", lime: "#78BE20", amber: "#FFB81C", red: "#DA291C", none: "#94a3b8" };
export const RAG_TEXT: Record<string, string> = {
  green: "text-nhs-green", lime: "text-lime-600", amber: "text-amber-600", red: "text-nhs-red", none: "text-slate-500",
};
export const RAG_BADGE: Record<string, string> = {
  green: "bg-nhs-green/10 text-nhs-green", lime: "bg-lime-100 text-lime-700",
  amber: "bg-amber-100 text-amber-700", red: "bg-red-100 text-nhs-red", none: "bg-slate-100 text-slate-500",
};

// Real-data pricing: money at risk from actual achieved points (no thresholds needed).
export function moneyFromPoints(available: number | null, achieved: number | null, ppp: number): number {
  if (available == null || achieved == null) return 0;
  return Math.round(Math.max(0, available - achieved) * ppp);
}
export function ragFromPoints(available: number | null, achieved: number | null): Rag {
  if (available == null || achieved == null || available <= 0) return "none";
  const r = achieved / available;
  if (r >= 0.95) return "green"; if (r >= 0.8) return "lime"; if (r >= 0.5) return "amber"; return "red";
}
