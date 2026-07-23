import { createAdminClient } from "@/lib/supabase/admin";
import { RATE_GLOBAL_DAY, RATE_PER_SESSION_HOUR } from "./model";

export type RateResult = { ok: true } | { ok: false; reason: string };

// §0.4: per-session 20/hr, global daily ceiling. Counts jobs actually enqueued
// (cache hits don't count — they never reach here).
export async function checkRateLimit(userId: string | null): Promise<RateResult> {
  const supabase = createAdminClient();
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  if (userId) {
    const { count } = await supabase
      .from("ai_job")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= RATE_PER_SESSION_HOUR) {
      return { ok: false, reason: `Hourly limit reached (${RATE_PER_SESSION_HOUR}/hour). Try again shortly.` };
    }
  }

  const { count: globalCount } = await supabase
    .from("ai_job")
    .select("id", { count: "exact", head: true })
    .gte("created_at", dayAgo);
  if ((globalCount ?? 0) >= RATE_GLOBAL_DAY) {
    return { ok: false, reason: "The service is busy today. Please try again later." };
  }

  return { ok: true };
}
