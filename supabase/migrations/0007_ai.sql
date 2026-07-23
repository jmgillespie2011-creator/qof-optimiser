-- AI features: generated-artefact cache + async job queue. Re-runnable.
-- All access is via the server-only service-role key. RLS is enabled with no
-- policies, so the anon/authenticated clients cannot read or write these tables;
-- the service role bypasses RLS.

do $$ begin create type ai_job_status as enum ('queued','running','done','error'); exception when duplicate_object then null; end $$;

-- ---------- generated-artefact cache (§0.2) ----------
-- cache_key = {feature}:{entity_type}:{entity_id}:{qof_year}:{data_version_hash}
create table if not exists ai_artifact (
  cache_key         text primary key,
  feature           text not null,          -- qi_plan | comparison | yoy | pcn_rollup | contract_summary
  entity_type       text not null,          -- practice | pcn | icb | comparison_set
  entity_id         text not null,
  qof_year          text not null,
  content           jsonb not null,
  model_used        text not null,
  prompt_tokens     int,
  completion_tokens int,
  generated_at      timestamptz not null default now(),
  pdf_blob          bytea                    -- nullable; filled by PDF export later (§1.6)
);
create index if not exists ai_artifact_entity_idx on ai_artifact (feature, entity_type, entity_id);

-- ---------- async generation jobs (§0.3) ----------
create table if not exists ai_job (
  id           uuid primary key default gen_random_uuid(),
  cache_key    text not null,
  feature      text not null,
  entity_id    text not null,
  user_id      uuid,                          -- session owner, for per-session rate limiting (§0.4)
  status       ai_job_status not null default 'queued',
  error        text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists ai_job_cache_key_idx on ai_job (cache_key);
create index if not exists ai_job_rate_idx      on ai_job (user_id, created_at);
create index if not exists ai_job_global_idx    on ai_job (created_at);

alter table ai_artifact enable row level security;
alter table ai_job      enable row level security;
-- No policies: locked to the service-role key used by server-side AI code.
