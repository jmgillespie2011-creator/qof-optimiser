import "./_env.mjs";
// Load an EXTRACTED NHS England QOF publication folder into Supabase:
//   - MAPPING_NHS_GEOGRAPHIES_*  -> organisation hierarchy (practice/PCN/sub-ICB/ICB/region/national) with ONS codes
//   - MAPPING_INDICATORS_*       -> qof_indicator + qof_indicator_year (points)
//   - ACHIEVEMENT_*_*            -> qof_achievement (numerator/denominator/PCAs/achieved points/register) + roll-ups
//   - PREVALENCE_*              -> prevalence (register counts + list size per condition per practice)
//
// Usage:  node scripts/ingest-nhs-qof.mjs "./Raw/QOF2425" 2024/25
//   (first EXTRACT the .zip so you pass the FOLDER containing the CSVs)
//   Add DRY=1 to parse + print a summary without touching the database.
// Env:   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (not needed for DRY)
import fs from "node:fs";
import path from "node:path";

const [dir, year] = process.argv.slice(2);
if (!dir || !year) { console.error('usage: node scripts/ingest-nhs-qof.mjs <extracted-folder> <year e.g. 2024/25>'); process.exit(1); }
const DRY = process.env.DRY === "1";
const POUND = { "2022/23": 207.56, "2023/24": 213.10, "2024/25": 220.62, "2025/26": 225.49 }[year] || Number(process.env.PPP) || 225.49;

// GROUP_CODE -> app domain slug + label
const DOMAIN = {
  AF:["cvd","Cardiovascular"], CHD:["cvd","Cardiovascular"], CHOL:["cvd","Cardiovascular"], HYP:["cvd","Cardiovascular"],
  STIA:["cvd","Cardiovascular"], PAD:["cvd","Cardiovascular"], HF:["cvd","Cardiovascular"], CKD:["cvd","Cardiovascular"],
  DM:["diabetes","Diabetes"], NDH:["diabetes","Diabetes"],
  AST:["respiratory","Respiratory"], COPD:["respiratory","Respiratory"],
  MH:["mental_health","Mental Health"], DEM:["mental_health","Mental Health"], DEP:["mental_health","Mental Health"],
  CAN:["other_clinical","Other clinical"], PC:["other_clinical","Other clinical"], EP:["other_clinical","Other clinical"],
  LD:["other_clinical","Other clinical"], OST:["other_clinical","Other clinical"], RA:["other_clinical","Other clinical"], OB:["other_clinical","Other clinical"],
  BP:["public_health","Public Health"], CS:["public_health","Public Health"], SMOK:["public_health","Public Health"], VI:["public_health","Public Health"],
};

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
const read = (name) => {
  const hit = fs.readdirSync(dir).find(fn => fn.toUpperCase().startsWith(name));
  if (!hit) return null;
  const rows = parseCSV(fs.readFileSync(path.join(dir, hit), "utf8"));
  const header = rows.shift().map(h => h.trim().toUpperCase());
  return { header, rows, idx: (...n) => { for (const x of n) { const i = header.indexOf(x); if (i>=0) return i; } return -1; } };
};

// ---------- geography ----------
const geo = read("MAPPING_NHS_GEOGRAPHIES");
const orgs = new Map(); // ods_code -> row
function put(code, level, name, ons, parents) { if (!code) return; if (!orgs.has(code)) orgs.set(code, { ods_code: code, org_level: level, name: name||code, ons_code: ons||null, ...parents }); }
if (geo) { const g = geo;
  const c = { nat:g.idx("NAT_CODE"), natons:g.idx("NAT_ONS_CODE"), reg:g.idx("REGION_ODS_CODE"), regons:g.idx("REGION_ONS_CODE"), regnm:g.idx("REGION_NAME"),
    icb:g.idx("ICB_ODS_CODE"), icbons:g.idx("ICB_ONS_CODE"), icbnm:g.idx("ICB_NAME"), sicb:g.idx("SUB_ICB_ODS_CODE"), sicbons:g.idx("SUB_ICB_ONS_CODE"), sicbnm:g.idx("SUB_ICB_NAME"),
    pcn:g.idx("PCN_ODS_CODE"), pcnnm:g.idx("PCN_NAME"), pr:g.idx("PRACTICE_CODE"), prnm:g.idx("PRACTICE_NAME") };
  for (const r of g.rows) { if (!r[c.pr]) continue;
    put("ENG","national","England","E92000001",{});
    put(r[c.reg],"region",r[c.regnm],r[c.regons],{});
    put(r[c.icb],"icb",r[c.icbnm],r[c.icbons],{ parent_region:r[c.reg] });
    put(r[c.sicb],"sub_icb",r[c.sicbnm],r[c.sicbons],{ parent_icb:r[c.icb], parent_region:r[c.reg] });
    put(r[c.pcn],"pcn",r[c.pcnnm],null,{ parent_sub_icb:r[c.sicb], parent_icb:r[c.icb], parent_region:r[c.reg] });
    put(r[c.pr],"practice",r[c.prnm],null,{ parent_pcn:r[c.pcn], parent_sub_icb:r[c.sicb], parent_icb:r[c.icb], parent_region:r[c.reg] });
  }
}

// ---------- indicators + points ----------
const mi = read("MAPPING_INDICATORS");
const indicators = new Map(), indYear = [];
if (mi) { const c = { code:mi.idx("INDICATOR_CODE"), desc:mi.idx("INDICATOR_DESCRIPTION"), pts:mi.idx("INDICATOR_POINT_VALUE"), grp:mi.idx("GROUP_CODE"), grpd:mi.idx("GROUP_DESCRIPTION") };
  for (const r of mi.rows) { const code=r[c.code]?.trim(); if (!code) continue; const grp=(r[c.grp]||"").trim();
    const dom = DOMAIN[grp]; if (!dom) continue; // skip QI groups
    indicators.set(code, { indicator_code:code, group_code:grp, domain:dom[0], domain_label:dom[1], title:(r[c.grpd]||code).trim().slice(0,120), description:(r[c.desc]||"").trim().slice(0,400) });
    indYear.push({ indicator_code:code, year, status:"current", points:Math.round(Number(r[c.pts])||0), lower_threshold:null, upper_threshold:null, pound_per_point:POUND });
  }
}

// ---------- achievement ----------
const achFiles = fs.readdirSync(dir).filter(f => f.toUpperCase().startsWith("ACHIEVEMENT"));
const acc = new Map(); // practice|indicator -> measures
for (const fn of achFiles) { const rows = parseCSV(fs.readFileSync(path.join(dir, fn), "utf8")); const h = rows.shift().map(x=>x.trim().toUpperCase());
  const iP=h.indexOf("PRACTICE_CODE"), iI=h.indexOf("INDICATOR_CODE"), iM=h.indexOf("MEASURE"), iV=h.indexOf("VALUE");
  for (const r of rows) { const p=r[iP], i=r[iI]; if (!p||!i) continue; const m=(r[iM]||"").toUpperCase(), v=parseFloat(r[iV]); if (Number.isNaN(v)) continue;
    const k=p+"|"+i; let s=acc.get(k); if(!s){s={p,i,num:null,den:null,pcas:null,pts:null,reg:null};acc.set(k,s);}
    if (m==="NUMERATOR") s.num=v; else if (m==="DENOMINATOR") s.den=v; else if (m==="PCAS") s.pcas=v; else if (m==="ACHIEVED_POINTS") s.pts=v; else if (m==="REGISTER") s.reg=v; }
}
const maxPts = new Map(indYear.map(y => [y.indicator_code, y.points]));
const achRows = [];
for (const s of acc.values()) { if (!indicators.has(s.i)) continue; const den=(s.den||0)-(s.pcas||0);
  let pct = den>0 ? Math.min(100, Math.round((s.num/den)*1000)/10) : null;
  achRows.push({ ods_code:s.p, org_level:"practice", indicator_code:s.i, year, numerator:s.num, denominator:s.den, pca_exceptions:s.pcas, achievement_pct:pct, register_size:s.reg, points_achieved:s.pts, points_available:maxPts.get(s.i) ?? null });
}

// ---------- prevalence ----------
const pv = read("PREVALENCE");
const prevRows = [], listSize = new Map();
if (pv) { const c={p:pv.idx("PRACTICE_CODE"),g:pv.idx("GROUP_CODE"),reg:pv.idx("REGISTER"),lt:pv.idx("PATIENT_LIST_TYPE"),ls:pv.idx("PRACTICE_LIST_SIZE")};
  for (const r of pv.rows) { const p=r[c.p]; if(!p) continue; const lt=r[c.lt];
    prevRows.push({ ods_code:p, group_code:r[c.g], register:Number(r[c.reg])||0, list_type:lt, list_size:Number(r[c.ls])||null });
    if (lt==="TOTAL") listSize.set(p, Number(r[c.ls])||null); }
}
for (const [code,ls] of listSize) { const o=orgs.get(code); if (o) o.list_size=ls; }

// national prevalence per disease group + national average list size (for CPI / APDF)
const natPrev = new Map(); // group -> {reg, list}
for (const r of prevRows) { const g=r.group_code; if(!g) continue; const a=natPrev.get(g)??{reg:0,list:0}; a.reg+=r.register||0; a.list+=r.list_size||0; natPrev.set(g,a); }
const engPrevRows = [...natPrev].map(([g,v])=>({ ods_code:"ENG", group_code:g, list_type:"TOTAL", register:v.reg, list_size:v.list }));
const listVals = [...listSize.values()].filter(v=>v>0);
const nationalAvgList = listVals.length ? Math.round(listVals.reduce((a,b)=>a+b,0)/listVals.length) : null;
console.log(`National avg list size: ${nationalAvgList}; disease groups: ${natPrev.size}`);


console.log(`Parsed: ${orgs.size} orgs, ${indicators.size} indicators, ${achRows.length} achievement rows, ${prevRows.length} prevalence rows. £/point=${POUND}`);
console.log(`ICBs with ONS code: ${[...orgs.values()].filter(o=>o.org_level==="icb"&&o.ons_code).length}`);

if (DRY) { console.log("DRY run - nothing written."); process.exit(0); }

const { createClient } = await import("@supabase/supabase-js");
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const chunk = async (table, rows, opts) => { for (let i=0;i<rows.length;i+=500){ const {error}=await supa.from(table).upsert(rows.slice(i,i+500),opts); if(error){console.error(table,error);process.exit(1);} } };

await chunk("organisation", [...orgs.values()], { onConflict:"ods_code" });
await chunk("qof_indicator", [...indicators.values()], { onConflict:"indicator_code" });
await chunk("qof_indicator_year", indYear, { onConflict:"indicator_code,year" });
await chunk("qof_achievement", achRows, { onConflict:"ods_code,indicator_code,year" });
await chunk("prevalence", prevRows, { onConflict:"ods_code,group_code,list_type" });
await chunk("prevalence", engPrevRows, { onConflict:"ods_code,group_code,list_type" });
await supa.from("qof_meta").upsert({ year, national_avg_list_size:nationalAvgList, pound_per_point:POUND }, { onConflict:"year" });

// roll up achievement + points to PCN/sub-ICB/ICB/region/national (list-size weighted)
const agg = new Map();
const add=(lvl,code,ind,pct,pa,pv2,w)=>{ if(!code)return; const k=`${lvl}|${code}|${ind}`; const a=agg.get(k)??{s:0,w:0,pa:0,pv:0}; if(pct!=null){a.s+=pct*w;a.w+=w;} a.pa+=pa||0; a.pv+=pv2||0; agg.set(k,a); };
for (const r of achRows){ const o=orgs.get(r.ods_code); const w=o?.list_size||1;
  for (const [lvl,code] of [["pcn",o?.parent_pcn],["sub_icb",o?.parent_sub_icb],["icb",o?.parent_icb],["region",o?.parent_region],["national","ENG"]])
    add(lvl,code,r.indicator_code,r.achievement_pct,r.points_achieved,r.points_available,w); }
const roll=[...agg].map(([k,v])=>{ const [lvl,code,ind]=k.split("|"); return { ods_code:code, org_level:lvl, indicator_code:ind, year, achievement_pct:v.w?Math.round((v.s/v.w)*10)/10:null, points_achieved:Math.round(v.pa*10)/10, points_available:v.pv }; });
await chunk("qof_achievement", roll, { onConflict:"ods_code,indicator_code,year" });
console.log(`Done: wrote ${achRows.length} practice + ${roll.length} roll-up achievement rows for ${year}.`);