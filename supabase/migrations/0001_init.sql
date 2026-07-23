-- QOF Optimiser schema + RLS  (safe to re-run)
-- Run in Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------- enums (guarded so re-running is safe) ----------
do $$ begin create type org_level     as enum ('practice','pcn','sub_icb','icb','region','national'); exception when duplicate_object then null; end $$;
do $$ begin create type org_status    as enum ('active','closed'); exception when duplicate_object then null; end $$;
do $$ begin create type ind_status    as enum ('retired','current','upcoming'); exception when duplicate_object then null; end $$;
do $$ begin create type user_role     as enum ('gp','practice_manager','nurse','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type user_plan     as enum ('free','paid'); exception when duplicate_object then null; end $$;
do $$ begin create type template_kind as enum ('florey_questionnaire','batch_sms','vba_script'); exception when duplicate_object then null; end $$;

-- ---------- organisation hierarchy ----------
create table if not exists organisation (
  ods_code       text primary key,
  org_level      org_level not null,
  name           text not null,
  postcode       text,
  parent_pcn     text references organisation(ods_code),
  parent_sub_icb text references organisation(ods_code),
  parent_icb     text references organisation(ods_code),
  parent_region  text references organisation(ods_code),
  status         org_status not null default 'active',
  list_size      int
);
create index if not exists organisation_level_idx on organisation (org_level);
create index if not exists organisation_icb_idx   on organisation (parent_icb);
create index if not exists organisation_pcn_idx   on organisation (parent_pcn);

-- ---------- QOF indicator library ----------
create table if not exists qof_indicator (
  indicator_code text primary key,
  domain         text not null,
  domain_label   text not null,
  title          text not null,
  description    text,
  numerator_definition   text,
  denominator_definition text
);
create index if not exists qof_indicator_domain_idx on qof_indicator (domain);

create table if not exists qof_indicator_year (
  indicator_code  text references qof_indicator(indicator_code),
  year            text not null,
  status          ind_status not null default 'current',
  points          int not null,
  lower_threshold numeric,
  upper_threshold numeric,
  pound_per_point numeric not null default 225.49,
  primary key (indicator_code, year)
);

-- ---------- achievement (all org levels) ----------
create table if not exists qof_achievement (
  ods_code        text references organisation(ods_code),
  org_level       org_level not null,
  indicator_code  text references qof_indicator(indicator_code),
  year            text not null,
  numerator       int,
  denominator     int,
  achievement_pct numeric,
  register_size   int,
  pca_exceptions  int,
  points_achieved numeric,
  points_available int,
  primary key (ods_code, indicator_code, year)
);
create index if not exists qof_achievement_lookup_idx on qof_achievement (indicator_code, year, org_level);

-- ---------- prescribing (OpenPrescribing cache) ----------
create table if not exists prescribing_measure (
  ods_code    text references organisation(ods_code),
  org_level   org_level not null,
  measure_id  text not null,
  month       date not null,
  numerator   numeric,
  denominator numeric,
  rate        numeric,
  percentile  numeric,
  primary key (ods_code, measure_id, month)
);

-- ---------- Accurx templates + QI suggestions ----------
create table if not exists accurx_template (
  id             text primary key,
  kind           template_kind not null,
  title          text not null,
  body_markdown  text not null,
  clinical_notes text
);

create table if not exists qi_suggestion (
  id              text primary key,
  indicator_code  text references qof_indicator(indicator_code),
  title           text not null,
  rationale       text,
  evidence_measure_id text,
  trigger_logic   jsonb,
  accurx_template_id text references accurx_template(id),
  priority_weight int not null default 10
);
create index if not exists qi_suggestion_ind_idx on qi_suggestion (indicator_code);

-- ---------- user profiles ----------
create table if not exists profile (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  full_name        text,
  role             user_role not null default 'gp',
  practice_ods_code text references organisation(ods_code),
  plan             user_plan not null default 'free',
  created_at       timestamptz not null default now()
);

create table if not exists practice_membership (
  practice_ods_code text references organisation(ods_code),
  user_id           uuid references auth.users(id) on delete cascade,
  role_at_practice  user_role not null default 'gp',
  primary key (practice_ods_code, user_id)
);

-- =========================================================
-- Row Level Security
-- =========================================================
alter table organisation        enable row level security;
alter table qof_indicator        enable row level security;
alter table qof_indicator_year   enable row level security;
alter table qof_achievement      enable row level security;
alter table prescribing_measure  enable row level security;
alter table accurx_template      enable row level security;
alter table qi_suggestion        enable row level security;
alter table profile             enable row level security;
alter table practice_membership enable row level security;

-- reference/benchmark data: readable by any signed-in user (public data)
drop policy if exists "read_ref_org"   on organisation;        create policy "read_ref_org"   on organisation       for select to authenticated using (true);
drop policy if exists "read_ref_ind"   on qof_indicator;       create policy "read_ref_ind"   on qof_indicator      for select to authenticated using (true);
drop policy if exists "read_ref_indy"  on qof_indicator_year;  create policy "read_ref_indy"  on qof_indicator_year for select to authenticated using (true);
drop policy if exists "read_ref_ach"   on qof_achievement;     create policy "read_ref_ach"   on qof_achievement    for select to authenticated using (true);
drop policy if exists "read_ref_presc" on prescribing_measure; create policy "read_ref_presc" on prescribing_measure for select to authenticated using (true);
drop policy if exists "read_ref_tmpl"  on accurx_template;     create policy "read_ref_tmpl"  on accurx_template    for select to authenticated using (true);
drop policy if exists "read_ref_qi"    on qi_suggestion;       create policy "read_ref_qi"    on qi_suggestion      for select to authenticated using (true);

-- personal data: only the owning user
drop policy if exists "own_profile_select" on profile; create policy "own_profile_select" on profile for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own_profile_upsert" on profile; create policy "own_profile_upsert" on profile for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "own_profile_update" on profile; create policy "own_profile_update" on profile for update to authenticated using (auth.uid() = user_id);

drop policy if exists "own_membership_select" on practice_membership; create policy "own_membership_select" on practice_membership for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own_membership_insert" on practice_membership; create policy "own_membership_insert" on practice_membership for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "own_membership_delete" on practice_membership; create policy "own_membership_delete" on practice_membership for delete to authenticated using (auth.uid() = user_id);

-- auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
