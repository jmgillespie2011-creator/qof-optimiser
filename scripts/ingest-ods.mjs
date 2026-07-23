import "./_env.mjs";
// Populate the organisation hierarchy (practice -> PCN -> ICB) from the NHS ODS
// ORD API for every practice already in the DB. Run on your machine (open API).
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "https://directory.spineservices.nhs.uk/ORD/2-0-0";

const { data: practices } = await supa.from("organisation").select("ods_code").eq("org_level", "practice");
for (const p of practices ?? []) {
  const res = await fetch(`${BASE}/organisations/${p.ods_code}`, { headers: { Accept: "application/json" } });
  if (!res.ok) { console.warn("skip", p.ods_code, res.status); continue; }
  const org = await res.json();
  const o = org?.Organisation;
  const postcode = o?.GeoLoc?.Location?.PostCode;
  let pcn = null, icb = null;
  for (const r of o?.Rels?.Rel ?? []) {
    const target = r?.Target?.OrgId?.extension;
    if (r?.id === "RE8") pcn = pcn ?? target;      // PCN membership
    if (r?.id === "RE6" || r?.id === "RE4") icb = icb ?? target; // commissioner
  }
  await supa.from("organisation").update({ postcode, parent_pcn: pcn, parent_icb: icb }).eq("ods_code", p.ods_code);
  console.log("updated", p.ods_code, "PCN", pcn, "ICB", icb);
}
console.log("ODS hierarchy sync complete.");