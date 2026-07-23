# QOF Optimiser

A SaaS web app that helps English GP practices maximise QOF achievement across **every clinical and public-health domain**. Benchmark against England / ICB / PCN / peers, see the £ at risk per indicator, and get up to 3 improvement actions with ready-to-send Accurx questionnaires.

Built with **Next.js 14 (App Router) + Supabase + Tailwind**, deployable on **Vercel**. Uses **public NHS data only** — no patient-identifiable data.

## Stack
- Next.js 14, TypeScript, Tailwind, Recharts
- Supabase (Postgres, Auth, Row Level Security)
- Data: NHS England QOF (annual CSV), OpenPrescribing API, NHS ODS ORD API

## Local setup
```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev
```

## Supabase setup
1. Create a project (choose a **UK/EU region**).
2. In the SQL editor, run in order: `supabase/migrations/0001_init.sql`, `supabase/migrations/0005_prevalence.sql`, then the seeds `supabase/seed/0002_seed.sql`, `0003_seed_full.sql`, `0004_seed_icb.sql`. (Seeds give you a working demo; the real NHS loader below replaces them with published data.)
3. Project Settings → API: copy the URL + anon (publishable) key into `.env.local`. Keep the service-role key server-only.
4. Auth → turn on Email provider (and, before paid launch, enable MFA/TOTP).

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import into Vercel; add env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
3. Deploy. Add your custom domain when ready.

## Loading the real NHS QOF publication (recommended — you already have the files)

You downloaded the full publication ZIPs into `Raw/`. This one command loads everything — real geography (incl. all 42 ICBs with ONS codes so the whole map colours), real points, achievement priced on **actual achieved points**, and prevalence per condition per practice.

1. In Supabase SQL Editor, also run `supabase/migrations/0005_prevalence.sql`.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Supabase → Project Settings → API → service_role).
3. **Extract** each ZIP in `Raw/` (right-click → Extract All) so you have folders of CSVs.
4. Extract each `Raw/qof/QOF_*.zip` into a folder of the same name, then load (latest first):
```bash
node scripts/ingest-nhs-qof.mjs "./Raw/qof/QOF_2024-25" 2024/25
node scripts/ingest-nhs-qof.mjs "./Raw/qof/QOF_2023-24" 2023/24
node scripts/ingest-nhs-qof.mjs "./Raw/qof/QOF_2022-23" 2022/23
```
(Add `DRY=1` before the command to preview counts without writing.)
5. Set the display year: in `.env.local` set `NEXT_PUBLIC_QOF_YEAR=2024/25`, restart `npm run dev`.

The app then shows real published figures; £-at-risk is `(max points − achieved points) × that year's £/point`. Delete `<SampleBanner />` styling isn't needed — the banner auto-switches to "published NHS QOF 2024/25".

## Weighting: list-size, prevalence, deprivation, ethnicity, rurality

**Money is now priced the QOF way.** £-at-risk = (max − achieved points) × £/point × **CPI** × **APDF**:
- **CPI** (Contractor Population Index) = your list size ÷ national average list size.
- **APDF** (Adjusted Practice Disease Factor) = your register prevalence ÷ national prevalence (clinical indicators only).
Both come straight from the QOF publication you loaded — the indicator page shows the full calculation.

**Demographic profiles (IMD / rurality / ethnicity)** are population-weighted by your patients-per-LSOA (the same method as the CVD/DM atlases). To load them:

1. Run `supabase/migrations/0006_weighting.sql`.
2. Build a `lsoa_imd.csv` from ONSPD (one pass; use the copy in your diabetes atlas):
   ```
   awk -F, "NR>1{gsub(/\"/,\"\"); if($51!=\"\" && !s[$51]++) print $51\",\"$47}" ONSPD.csv > etl/out/lsoa_imd.csv
   ```
3. Build per-practice demographics (points the script at your atlas folder + the age/sex pair for your display year):
   ```
   python etl/build_demographics.py --atlas "<path>/diabetes-atlas-pkg/etl" --imd etl/out/lsoa_imd.csv \
     --female Raw/registration/reg-female_2024-25.csv --male Raw/registration/reg-male_2024-25.csv --out etl/out
   ```
   (`--female`/`--male` give %female and whole-list %over-65; omit them for IMD/rurality/ethnicity only.)
4. Load them:
   ```
   node scripts/ingest-demographics.mjs ./etl/out/demographics.csv ./etl/out/ethnicity.csv
   ```

The dashboard then shows a practice profile (list size, CPI, deprivation quintile, % rural, ethnicity), and the domain "Compare vs" toggle gains **Similar (IMD)** — benchmarking against practices in your deprivation quintile (equity view). *Not yet included: age and %female (need NHS "Patients Registered by single year of age / sex" — drop those files in and I'll wire them the same way).*

## Alternative: loading via the generic CSV loader / open APIs

These scripts need the **service-role key** in `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`), from Supabase → Project Settings → API.

**1. QOF achievement (per year).** Download the achievement CSV from NHS England Digital's QOF publication:
`https://digital.nhs.uk/data-and-information/publications/statistical/quality-and-outcomes-framework-achievement-prevalence-and-exceptions-data/` → pick a year → download the achievement file. Then:
```bash
node scripts/ingest-qof.mjs ./ACHIEVEMENT_2024-25.csv 2024/25
```
The script auto-detects the practice/indicator/numerator/denominator columns, upserts practice rows, then **rolls up to PCN / ICB / England** (list-size weighted) so all benchmarks and the map populate. Load 3 years for the trend charts. (If a year's column names differ, set `COL_PRACTICE` / `COL_INDICATOR` env vars.)

**2. Organisation hierarchy (ODS).** Fills each practice's PCN/ICB parents + postcode from the open NHS ODS API:
```bash
node scripts/ingest-ods.mjs
```

**3. Prescribing (OpenPrescribing).** Caches a measure (default lipid-lowering) per practice for the QI evidence layer:
```bash
node scripts/ingest-prescribing.mjs           # or: node scripts/ingest-prescribing.mjs ezetimibe
```

Once real data is loaded, remove the sample banner by deleting `<SampleBanner />` from `app/(app)/layout.tsx`.

## What's built (this scaffold)
- Secure auth: register (with **NHS ODS practice auto-load**), login, session middleware, my-account
- Dashboard: whole-practice £-at-risk across all domains, ranked opportunities, per-domain tiles
- Reusable **domain template** (`/domains/[domain]`) + indicator detail with benchmark chart
- QI engine: up to 3 suggestions per indicator → QI action pages with copy-ready Accurx templates
- Full schema + RLS + seed (CVD/lipids with real 2025/26 figures, plus diabetes/respiratory/MH/public-health samples)

## Roadmap
See `QOF-Optimiser-Architecture-Plan.md`. Next: real multi-year ingestion + roll-ups, OpenPrescribing wiring into QI triggers, remaining domains, Stripe paid tier, DCB0129 hazard log.

## Compliance note
This is clinical decision-support. Before selling into the NHS, complete a DPIA, NHS DSP Toolkit, DTAC self-assessment, and a DCB0129 clinical safety case with a named Clinical Safety Officer.
