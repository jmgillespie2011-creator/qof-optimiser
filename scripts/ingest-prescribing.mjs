import "./_env.mjs";
// Cache OpenPrescribing measures for each practice in the DB. Run on your machine.
// Usage: node scripts/ingest-prescribing.mjs [measureId]   (default: lpzomnibus - lipid-lowering)
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const measure = process.argv[2] || "lpzomnibus";
const { data: practices } = await supa.from("organisation").select("ods_code").eq("org_level", "practice");
for (const p of practices ?? []) {
  const res = await fetch(`https://openprescribing.net/api/1.0/measure_by_practice/?measure=${measure}&org=${p.ods_code}&format=json`);
  if (!res.ok) { console.warn("skip", p.ods_code, res.status); continue; }
  const json = await res.json();
  const rows = (json?.measures?.[0]?.data ?? []).slice(-1).map(d => ({
    ods_code: p.ods_code, org_level: "practice", measure_id: measure, month: d.date,
    numerator: d.numerator, denominator: d.denominator, rate: d.calc_value, percentile: d.percentile,
  }));
  if (rows.length) await supa.from("prescribing_measure").upsert(rows);
  console.log("prescribing", p.ods_code, rows.length ? "ok" : "no data");
}
console.log("Prescribing sync complete.");