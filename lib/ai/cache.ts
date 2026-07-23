import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Cache key: {feature}:{entity_type}:{entity_id}:{qof_year}:{data_version_hash}
// (§0.2). New QOF data changes the hash, so stale entries fall out naturally.
export type Feature = "qi_plan" | "comparison" | "yoy" | "pcn_rollup" | "contract_summary";
export type EntityType = "practice" | "pcn" | "icb" | "comparison_set";

// Short hash of the underlying dataset that fed this artefact. Pass in the exact
// numbers the model saw, so any change to the input invalidates the cache.
export function dataVersionHash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 12);
}

export function cacheKey(args: {
  feature: Feature;
  entityType: EntityType;
  entityId: string;
  qofYear: string;
  dataVersionHash: string;
}): string {
  return `${args.feature}:${args.entityType}:${args.entityId}:${args.qofYear}:${args.dataVersionHash}`;
}

export type CachedArtifact = {
  cache_key: string;
  content: unknown;
  model_used: string;
  generated_at: string;
};

export async function getArtifact(key: string): Promise<CachedArtifact | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_artifact")
    .select("cache_key,content,model_used,generated_at")
    .eq("cache_key", key)
    .maybeSingle();
  return (data as CachedArtifact) ?? null;
}

export async function putArtifact(args: {
  key: string;
  feature: Feature;
  entityType: EntityType;
  entityId: string;
  qofYear: string;
  content: unknown;
  modelUsed: string;
  promptTokens: number; // persisted for cost monitoring + model comparison (§0.2)
  completionTokens: number;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("ai_artifact").upsert({
    cache_key: args.key,
    feature: args.feature,
    entity_type: args.entityType,
    entity_id: args.entityId,
    qof_year: args.qofYear,
    content: args.content,
    model_used: args.modelUsed,
    prompt_tokens: args.promptTokens,
    completion_tokens: args.completionTokens,
    generated_at: new Date().toISOString(),
  });
}
