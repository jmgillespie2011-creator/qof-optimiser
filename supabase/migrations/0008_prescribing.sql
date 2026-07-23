-- OpenPrescribing atlas-style prescribing measures (items per 1,000 patients),
-- benchmarked practice -> PCN -> ICB -> England, mirroring the CVD & Diabetes atlases.
-- Safe to re-run.

-- ---------- metric definitions ----------
create table if not exists rx_metric (
  metric_key       text primary key,
  domain           text not null,                 -- 'diabetes' | 'lipids' | 'af'
  domain_label     text not null,
  name             text not null,
  short            text not null,
  unit             text not null default 'items/1000',
  higher_is_better boolean not null default true,
  qof_link         text,                          -- plain-English "supports which QOF"
  sort             int not null default 100
);

-- ---------- per-organisation values ----------
create table if not exists rx_value (
  ods_code        text not null references organisation(ods_code),
  org_level       org_level not null,
  metric_key      text not null references rx_metric(metric_key),
  period          text not null,                  -- e.g. '2024-12..2025-11 (mean monthly)'
  raw_items       numeric,                        -- mean monthly items (used for roll-ups)
  items_per_1000  numeric,                        -- rate: raw_items / list * 1000 (or % for shares)
  percentile      numeric,                        -- 0-100 within the org_level distribution
  primary key (ods_code, metric_key, period)
);
create index if not exists rx_value_lookup_idx on rx_value (metric_key, org_level, period);
create index if not exists rx_value_org_idx    on rx_value (ods_code, period);

-- ---------- seed metric definitions ----------
insert into rx_metric (metric_key, domain, domain_label, name, short, unit, higher_is_better, qof_link, sort) values
  ('rx_sglt2i',    'diabetes', 'Diabetes', 'SGLT2 inhibitors (dapagliflozin, empagliflozin, etc. incl. combinations)', 'SGLT2i', 'items/1000', true,  'Supports DM, CKD and HF registers (NICE NG28 / NG203 / NG106)', 10),
  ('rx_glp1_sema', 'diabetes', 'Diabetes', 'GLP-1 receptor agonist — semaglutide', 'Semaglutide', 'items/1000', true, 'Diabetes glycaemic control (DM indicators)', 20),
  ('rx_tirzepatide','diabetes','Diabetes', 'Tirzepatide', 'Tirzepatide', 'items/1000', true, 'Diabetes glycaemic control (DM indicators)', 30),
  ('rx_statin',    'lipids',   'Lipids & CVD', 'Statin volume (whole lipid-regulating section)', 'Statins', 'items/1000', true, 'Supports CHOL001–003 and CVD secondary prevention', 40),
  ('rx_statin_hi', 'lipids',   'Lipids & CVD', 'High-intensity statin share (atorvastatin 20/40/80, rosuvastatin 10/20/40)', 'High-intensity share', '%', true, 'Quality signal for CHOL002/003 lipid optimisation', 50),
  ('rx_ezetimibe', 'lipids',   'Lipids & CVD', 'Ezetimibe', 'Ezetimibe', 'items/1000', true, 'Add-on lipid lowering where statin alone insufficient (CHOL002/003)', 60),
  ('rx_inclisiran','lipids',   'Lipids & CVD', 'Inclisiran (primary care)', 'Inclisiran', 'items/1000', true, 'Lipid lowering in established CVD (CHOL002/003)', 70),
  ('rx_doac',      'af',       'Atrial fibrillation', 'DOAC anticoagulants (apixaban, rivaroxaban, edoxaban, dabigatran)', 'DOACs', 'items/1000', true, 'Supports AF anticoagulation indicators (AF006/007)', 80)
on conflict (metric_key) do update set
  domain=excluded.domain, domain_label=excluded.domain_label, name=excluded.name,
  short=excluded.short, unit=excluded.unit, higher_is_better=excluded.higher_is_better,
  qof_link=excluded.qof_link, sort=excluded.sort;

-- ---------- RLS: public reference data, readable by any signed-in user ----------
alter table rx_metric enable row level security;
alter table rx_value  enable row level security;
drop policy if exists "read_ref_rxm" on rx_metric; create policy "read_ref_rxm" on rx_metric for select to authenticated using (true);
drop policy if exists "read_ref_rxv" on rx_value;  create policy "read_ref_rxv" on rx_value  for select to authenticated using (true);
