-- Prevalence (comorbidity burden per practice) + deprivation columns for weighting. Re-runnable.
create table if not exists prevalence (
  ods_code   text references organisation(ods_code),
  group_code text not null,          -- AF, DM, HYP, ...
  list_type  text not null,          -- TOTAL, 18OV, 17OV ...
  register   numeric,                -- patients on the register
  list_size  numeric,                -- relevant list size
  primary key (ods_code, group_code, list_type)
);
alter table prevalence enable row level security;
drop policy if exists "read_prev" on prevalence;
create policy "read_prev" on prevalence for select to authenticated using (true);

-- deprivation / demographic weighting columns (populated by a future loader)
alter table organisation add column if not exists imd_score   numeric;   -- practice IMD 2019 score
alter table organisation add column if not exists imd_decile  int;       -- 1 (most deprived) .. 10
alter table organisation add column if not exists pct_over_65 numeric;   -- % registered pop aged 65+
alter table organisation add column if not exists pct_female  numeric;
