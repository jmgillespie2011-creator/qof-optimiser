import "./_env.mjs";
// Load per-practice demographics (from etl/build_demographics.py output) into Supabase.
// Usage: node scripts/ingest-demographics.mjs ./etl/out/demographics.csv ./etl/out/ethnicity.csv
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const [demoFile, ethFile] = process.argv.slice(2);
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const csv = (p) => { const [h, ...r] = fs.readFileSync(p, "utf8").trim().split(/\r?\n/); const cols = h.split(","); return r.map(l => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v]))); };
const num = (v) => v === "" || v == null ? null : Number(v);

// existing org names/levels so upsert satisfies NOT NULL columns
const existing = new Map();
{
  let from = 0;
  for (;;) {
    const { data, error } = await supa.from("organisation").select("ods_code,name,org_level").range(from, from + 999);
    if (error) { console.error(error); break; }
    for (const o of data ?? []) existing.set(o.ods_code, o);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
}

if (demoFile) {
  const rows = csv(demoFile).map(d => {
    const e = existing.get(d.gp_code);
    return {
      ods_code: d.gp_code, org_level: e?.org_level ?? "practice", name: e?.name ?? d.gp_code,
      imd_decile: num(d.imd_decile), imd_quintile: num(d.imd_quintile), pct_rural: num(d.pct_rural),
      pct_female: num(d.pct_female), pct_over_65: num(d.pct_over_65), lat: num(d.lat), lng: num(d.lng),
    };
  }).filter(d => d.ods_code);
  let done = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supa.from("organisation").upsert(rows.slice(i, i + 500), { onConflict: "ods_code" });
    if (error) { console.error(error); process.exit(1); }
    done += rows.slice(i, i + 500).length;
  }
  console.log(`demographics: ${done} practices updated`);
}
if (ethFile) {
  const rows = csv(ethFile).map(d => ({ ods_code: d.gp_code, category: d.category, pct: num(d.pct) }))
    .filter(d => d.ods_code && existing.has(d.ods_code));
  let done = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supa.from("practice_ethnicity").upsert(rows.slice(i, i + 500), { onConflict: "ods_code,category" });
    if (error) { console.error(error); process.exit(1); }
    done += rows.slice(i, i + 500).length;
  }
  console.log(`ethnicity: ${done} rows updated`);
}
