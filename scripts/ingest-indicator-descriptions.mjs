import "./_env.mjs";
/*
  Load the official NHS QOF indicator DEFINITIONS (what each code actually
  measures) into qof_indicator.description, from the publication's
  MAPPING_INDICATORS_*.csv. Powers the hover tooltips and indicator pages.

  Usage: node scripts/ingest-indicator-descriptions.mjs ["./Raw/qof/QOF_2024-25/MAPPING_INDICATORS_2425.csv"]
  Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
*/
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FILE = process.argv[2] || "./Raw/qof/QOF_2024-25/MAPPING_INDICATORS_2425.csv";

// Robust CSV parse (handles quoted, multi-line fields) — same as ingest-nhs-qof.
function parseCSV(text) {
  const out = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); out.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c; }
  if (f.length || row.length) { row.push(f); out.push(row); }
  return out;
}

const rows = parseCSV(fs.readFileSync(FILE, "utf8"));
const header = rows.shift().map((h) => h.trim().toUpperCase());
const iCode = header.indexOf("INDICATOR_CODE");
const iDesc = header.indexOf("INDICATOR_DESCRIPTION");
if (iCode < 0 || iDesc < 0) { console.error("Could not find INDICATOR_CODE / INDICATOR_DESCRIPTION columns."); process.exit(1); }

let updated = 0, missing = 0;
for (const r of rows) {
  const code = (r[iCode] || "").trim();
  const desc = (r[iDesc] || "").trim().replace(/\s+/g, " ");
  if (!code || !desc) continue;
  const { error, count } = await supa.from("qof_indicator").update({ description: desc }, { count: "exact" }).eq("indicator_code", code);
  if (error) { console.error(code, error.message); continue; }
  if (count) updated++; else missing++;
}
console.log(`Indicator descriptions loaded: ${updated} updated${missing ? `, ${missing} codes not in DB (skipped)` : ""}.`);
