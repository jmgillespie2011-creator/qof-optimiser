import "./_env.mjs";
/*
  Import atlas-style prescribing straight from the CVD & Diabetes Atlas data
  files (public/data/<period>/practices.json + areas.json). Those are LIVE
  builds (real OpenPrescribing figures, already case-mix adjusted with deciles),
  so this needs NO network — instant, and sidesteps OpenPrescribing's Cloudflare
  wall entirely.

  Usage (defaults point at the packages in your Downloads):
    node scripts/import-atlas-prescribing.mjs [cvdDataDir] [dmDataDir]

  Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
*/
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CVD_DIR = process.argv[2] || "C:/Users/jmgil/Downloads/cvd-prevention-atlas/cvd-atlas-pkg/public/data/2025-26";
const DM_DIR  = process.argv[3] || "C:/Users/jmgil/Downloads/diabetes-atlas/diabetes-atlas-pkg/public/data/2025-26";
const PERIOD  = "2024-12..2025-12 (atlas, case-mix adjusted)";

// atlas metric key -> our rx_metric key
const MAP = {
  n_sglt2: "rx_sglt2i", n_sema: "rx_glp1_sema", n_tirz: "rx_tirzepatide",
  n_statin: "rx_statin", n_statin_hi: "rx_statin_hi", n_ezet: "rx_ezetimibe",
  n_incl: "rx_inclisiran", n_doac: "rx_doac",
};

const read = (dir, file) => JSON.parse(readFileSync(join(dir, file), "utf8"));

async function existingOrgCodes() {
  const codes = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa.from("organisation").select("ods_code").order("ods_code").range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const o of data) codes.add(o.ods_code);
    if (data.length < 1000) break;
  }
  return codes;
}

function rowsFrom(entity, ods_code, org_level, out) {
  const m = entity.m || {};
  for (const [atlasKey, ourKey] of Object.entries(MAP)) {
    const v = m[atlasKey];
    if (!v || v.crude == null) continue;
    out.push({
      ods_code, org_level, metric_key: ourKey, period: PERIOD,
      raw_items: null,
      items_per_1000: v.crude,
      adj: v.adj ?? null,
      decile: v.dec ?? null,
      percentile: v.dec != null ? v.dec * 10 - 5 : null, // decile -> approx percentile for the bar
    });
  }
}

async function main() {
  const valid = await existingOrgCodes();
  console.log(`  ${valid.size} org codes in DB to match against`);
  const rows = [];

  for (const [dir, label] of [[CVD_DIR, "CVD"], [DM_DIR, "Diabetes"]]) {
    let practices, areas;
    try {
      practices = read(dir, "practices.json");
      areas = read(dir, "areas.json");
    } catch (e) {
      console.error(`  ! could not read ${label} atlas at ${dir}: ${e.message}`);
      continue;
    }
    let n = 0;
    for (const p of practices) if (valid.has(p.code)) { rowsFrom(p, p.code, "practice", rows); n++; }
    for (const a of Object.values(areas.pcn || {})) if (valid.has(a.code)) rowsFrom(a, a.code, "pcn", rows);
    for (const a of Object.values(areas.icb || {})) if (valid.has(a.code)) rowsFrom(a, a.code, "icb", rows);
    if (areas.england && valid.has("ENG")) rowsFrom(areas.england, "ENG", "national", rows);
    console.log(`  ${label}: ${n} practices + areas`);
  }

  console.log(`  built ${rows.length} rows`);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supa.from("rx_value").upsert(rows.slice(i, i + 500));
    if (error) { console.error("upsert error:", error.message); process.exit(1); }
  }
  console.log(`Atlas prescribing import complete — ${rows.length} rows for ${PERIOD}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
