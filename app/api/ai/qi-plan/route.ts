import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getUserPractice } from "@/lib/qof/data";
import { assembleQiPlanInput } from "@/lib/ai/qiPlan/input";
import { runQiPlanGeneration } from "@/lib/ai/qiPlan/generate";
import { cacheKey, dataVersionHash, getArtifact } from "@/lib/ai/cache";
import { checkRateLimit } from "@/lib/ai/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A job still "queued"/"running" past this is treated as dead (e.g. the server
// was restarted mid-generation) so it can't wedge a practice permanently.
const STALE_MS = 3 * 60 * 1000;

async function resolve(practiceCode: string) {
  const input = await assembleQiPlanInput(practiceCode);
  const key = cacheKey({
    feature: "qi_plan",
    entityType: "practice",
    entityId: practiceCode,
    qofYear: input.qof_year,
    dataVersionHash: dataVersionHash(input),
  });
  return { input, key };
}

// GET → poll: return the cached plan if ready, else the latest job status.
export async function GET() {
  const { user, practiceCode } = await getUserPractice();
  if (!user || !practiceCode) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { key } = await resolve(practiceCode);
  const hit = await getArtifact(key);
  if (hit) return NextResponse.json({ status: "done", content: hit.content, generated_at: hit.generated_at });

  const supabase = createAdminClient();
  const { data: job } = await supabase
    .from("ai_job")
    .select("status,error,created_at")
    .eq("cache_key", key)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!job) return NextResponse.json({ status: "none" });
  const j = job as any;
  // A queued/running job that's gone stale never completed — report it failed
  // so the UI stops polling instead of spinning forever.
  if ((j.status === "queued" || j.status === "running") && Date.now() - new Date(j.created_at).getTime() > STALE_MS) {
    return NextResponse.json({ status: "error", error: "Generation timed out (the server may have restarted). Please try again." });
  }
  return NextResponse.json({ status: j.status, error: j.error ?? null });
}

// POST → trigger: cache lookup → rate limit → enqueue async generation.
export async function POST(_req: NextRequest) {
  const { user, practiceCode } = await getUserPractice();
  if (!user || !practiceCode) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server." }, { status: 500 });
  }

  let input, key: string;
  try {
    ({ input, key } = await resolve(practiceCode));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not read practice data." }, { status: 500 });
  }

  const hit = await getArtifact(key);
  if (hit) return NextResponse.json({ status: "done", content: hit.content, generated_at: hit.generated_at });

  if (!input.priority_indicators.length) {
    return NextResponse.json({ error: "No indicator gaps found for this practice — nothing to generate." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Reuse a *fresh* in-flight job for the same inputs rather than piling up
  // (§0.4). Stale jobs (dead after a restart) are ignored so they can't wedge.
  const freshCutoff = new Date(Date.now() - STALE_MS).toISOString();
  const { data: existing } = await supabase
    .from("ai_job")
    .select("id,status")
    .eq("cache_key", key)
    .in("status", ["queued", "running"])
    .gte("created_at", freshCutoff)
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ status: "queued", jobId: (existing as any).id });

  const rate = await checkRateLimit(user.id);
  if (!rate.ok) return NextResponse.json({ error: rate.reason }, { status: 429 });

  const { data: created, error } = await supabase
    .from("ai_job")
    .insert({ cache_key: key, feature: "qi_plan", entity_id: practiceCode, user_id: user.id, status: "queued" })
    .select("id")
    .single();
  if (error || !created) {
    return NextResponse.json({ error: "Could not queue generation." }, { status: 500 });
  }
  const jobId = (created as any).id as string;

  // Generate after the response is sent — never synchronously in the handler (§0.3).
  after(async () => {
    await runQiPlanGeneration({ input, cacheKey: key, entityId: practiceCode, qofYear: input.qof_year, jobId });
  });

  return NextResponse.json({ status: "queued", jobId });
}
