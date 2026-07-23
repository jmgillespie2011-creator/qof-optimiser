-- QOF payment weighting (CPI × APDF) + demographics. Re-runnable.
alter table qof_indicator add column if not exists group_code text;   -- AF, DM, HYP, ... (disease register)

create table if not exists qof_meta (
  year text primary key,
  national_avg_list_size numeric,
  pound_per_point numeric
);
alter table qof_meta enable row level security;
drop policy if exists "read_meta" on qof_meta; create policy "read_meta" on qof_meta for select to authenticated using (true);

-- practice ethnicity breakdown (population-weighted, from census by LSOA)
create table if not exists practice_ethnicity (
  ods_code  text references organisation(ods_code),
  category  text not null,   -- White, Asian, Black, Mixed, Other
  pct       numeric,
  primary key (ods_code, category)
);
alter table practice_ethnicity enable row level security;
drop policy if exists "read_eth" on practice_ethnicity; create policy "read_eth" on practice_ethnicity for select to authenticated using (true);

-- demographic columns (population-weighted where noted)
alter table organisation add column if not exists imd_score    numeric;  -- mean IMD rank (lower = more deprived)
alter table organisation add column if not exists imd_decile   int;      -- 1 most deprived .. 10 least
alter table organisation add column if not exists imd_quintile int;      -- 1 most deprived .. 5 least
alter table organisation add column if not exists pct_rural    numeric;  -- % patients in rural LSOAs
alter table organisation add column if not exists pct_female   numeric;
alter table organisation add column if not exists lat          numeric;
alter table organisation add column if not exists lng          numeric;

-- equity benchmarking: average achievement of practices in the same IMD quintile
create or replace function similar_achievement(p_quintile int, p_year text)
returns table(indicator_code text, achievement_pct numeric)
language sql stable as $$
  select a.indicator_code, round(avg(a.achievement_pct), 1)
  from qof_achievement a join organisation o on o.ods_code = a.ods_code
  where a.org_level = 'practice' and a.year = p_year and o.imd_quintile = p_quintile
  group by a.indicator_code;
$$;
