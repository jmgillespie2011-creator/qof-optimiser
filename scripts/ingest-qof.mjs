import "./_env.mjs";
// Ingest a year of NHS England QOF achievement data into Supabase, then roll up
// practice figures to PCN / ICB / national so benchmarks + the map populate.
//
// Handles BOTH real NHS layouts:
//  - LONG  : columns PRACTICE_CODE, INDICATOR_CODE, MEASURE, VALUE
//            (MEASURE rows like NUMERATOR / DENOMINATOR / ACHIEVEMENT ...)
//  - WIDE  : columns PRACTICE_CODE, INDICATOR_CODE, NUMERATOR, DENOMINATOR[, ACHIEVEMENT_PCT]
//
// Usage:  node scripts/ingest-qof.mjs ./ACHIEVEMENT_2324.csv 2023/24
// Env:    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const [file, year] = process.argv.slice(2);
if (!file || !year) { console.error("usage: node scripts/ingest-qof.mjs <csv> <year>"); process.exit(1); }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment/.env"); process.exit(1); }
const supa = createClient(url, key);

// tiny CSV parser (handles quoted fields)
function parseCSV(text) {
  const out = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); out.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); out.push(row); }
  return out;
}
const rows = parseCSV(fs.readFileSync(file, "utf8"));
const header = rows.shift().map(h => h.trim().toUpperCase());
const idx = (...names) => { for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; } return -1; };
const cPract = process.env.COL_PRACTICE ? header.indexOf(process.env.COL_PRACTICE.toUpperCase()) : idx("PRACTICE_CODE","PRACTICE","ORG_CODE","ODS_CODE");
const cInd   = process.env.COL_INDICATOR ? header.indexOf(process.env.COL_INDICATOR.toUpperCase()) : idx("INDICATOR_CODE","INDICATOR");
const cMeas  = idx("MEASURE","MEASURE_TYPE");
const cVal   = idx("VALUE","MEASURE_VALUE");
const cNum   = idx("NUMERATOR","NUMERATOR_VALUE");
const cDen   = idx("DENOMINATOR","DENOMINATOR_VALUE");
const cPct   = idx("ACHIEVEMENT_PCT","ACHIEVEMENT_PERCENT","PERCENTAGE","ACHIEVEMENT");
if (cPract < 0 || cInd < 0) { console.error("Missing practice/indicator columns. Header was:", header); process.exit(1); }

// build practice-level {ods, ind} -> {num, den, pct}
const map = new Map();
const keyf = (o, i) => `${o}${i}`;
function slot(o, i) { const k = keyf(o, i); let s = map.get(k); if (!s) { s = { ods: o, ind: i, num: null, den: null, pct: null }; map.set(k, s); } return s; }

if (cMeas >= 0 && cVal >= 0) {
  // LONG format
  for (const c of rows) {
    const o = c[cPract]?.trim(), i = c[cInd]?.trim(); if (!o || !i) continue;
    const m = (c[cMeas] || "").trim().toUpperCase(); const v = parseFloat(c[cVal]); if (Number.isNaN(v)) continue;
    const s = slot(o, i);
    if (m.startsWith("NUMER")) s.num = v;
    else if (m.startsWith("DENOM")) s.den = v;
    else if (m.startsWith("ACHIEV") || m.includes("PERCENT") || m === "PCT") s.pct = v;
  }
} else {
  // WIDE format
  for (const c of rows) {
    const o = c[cPract]?.trim(), i = c[cInd]?.trim(); if (!o || !i) continue;
    const s = slot(o, i);
    if (cNum >= 0) s.num = parseFloat(c[cNum]);
    if (cDen >= 0) s.den = parseFloat(c[cDen]);
    if (cPct >= 0) s.pct = parseFloat(c[cPct]);
  }
}

const practiceRows = [];
for (const s of map.values()) {
  let pct = s.pct;
  if ((pct == null || Number.isNaN(pct)) && s.num != null && s.den > 0) pct = Math.round((s.num / s.den) * 1000) / 10;
  if (pct == null || Number.isNaN(pct)) continue;
  practiceRows.push({ ods_code: s.ods, org_level: "practice", indicator_code: s.ind, year, numerator: s.num, denominator: s.den, achievement_pct: pct });
}
// ensure practice org rows exist (so ODS can fill parents + roll-ups can aggregate)
const practiceOrgs = [...new Set(practiceRows.map(r => r.ods_code))].map(code => ({ ods_code: code, org_level: "practice", name: code }));
for (let i = 0; i < practiceOrgs.length; i += 500) { await supa.from("organisation").upsert(practiceOrgs.slice(i, i + 500), { onConflict: "ods_code", ignoreDuplicates: true }); }

console.log(`Parsed ${practiceRows.length} practice/indicator rows (${cMeas>=0?"long":"wide"} format).`);
for (let i = 0; i < practiceRows.length; i += 500) {
  const { error } = await supa.from("qof_achievement").upsert(practiceRows.slice(i, i + 500));
  if (error) { console.error(error); process.exit(1); }
}

// roll up to PCN / ICB / national (list-size weighted)
const { data: orgs } = await supa.from("organisation").select("ods_code,parent_pcn,parent_icb,list_size");
const orgMap = new Map((orgs ?? []).map(o => [o.ods_code, o]));
const agg = new Map();
const add = (lvl, code, ind, pct, w) => { if (!code) return; const k = `${lvl}|${code}|${ind}`; const a = agg.get(k) ?? { s: 0, w: 0 }; a.s += pct * w; a.w += w; agg.set(k, a); };
for (const r of practiceRows) { const o = orgMap.get(r.ods_code); const w = o?.list_size || 1;
  add("pcn", o?.parent_pcn, r.indicator_code, r.achievement_pct, w);
  add("icb", o?.parent_icb, r.indicator_code, r.achievement_pct, w);
  add("national", "ENG", r.indicator_code, r.achievement_pct, w); }
const rollups = [...agg].map(([k, v]) => { const [lvl, code, ind] = k.split("|"); return { ods_code: code, org_level: lvl, indicator_code: ind, year, achievement_pct: Math.round((v.s / v.w) * 10) / 10 }; });
for (let i = 0; i < rollups.length; i += 500) {
  const { error } = await supa.from("qof_achievement").upsert(rollups.slice(i, i + 500));
  if (error) { console.error(error); process.exit(1); }
}
console.log(`Done: ${practiceRows.length} practice + ${rollups.length} roll-up rows for ${year}.`);