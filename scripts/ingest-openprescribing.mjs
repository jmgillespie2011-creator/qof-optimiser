import "./_env.mjs";
/*
  Atlas-style OpenPrescribing ingest for the QOF Optimiser.

  Pulls mean-monthly prescribing ITEMS per BNF drug group from OpenPrescribing's
  spending_by_org endpoint (one call per group per month — NOT per practice),
  converts to items per 1,000 registered patients, rolls up practice -> PCN ->
  ICB -> England (list-weighted), computes a percentile within each level, and
  writes rx_value. Mirrors the CVD & Diabetes atlas ETL.

  Run on your machine (needs internet + service-role key):
      node scripts/ingest-openprescribing.mjs
  Options:
      MONTHS=12   how many recent months to average over (default 12)
      DRY=1       fetch + compute, print a summary, but don't write

  Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
*/
import { createClient } from "@supabase/supabase-js";

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "https://openprescribing.net/api/1.0";
const MONTHS = Number(process.env.MONTHS || 12);
const DRY = process.env.DRY === "1";

// ---- metric -> BNF chemical codes (fallbacks). Single-substance drugs are also
//      re-resolved by NAME at runtime because BNF codes drift over time. ----
const GROUPS = {
  rx_sglt2i: {
    codes: ["0601023AG", "0601023AN", "0601023AM", "0601023AX",
            "0601023AL", "0601023AP", "0601023AR", "0601023AY", "0601023AV"],
    names: ["dapagliflozin", "empagliflozin", "canagliflozin", "ertugliflozin"],
  },
  rx_glp1_sema:  { codes: ["0601023AW"], names: ["semaglutide"] },
  rx_tirzepatide:{ codes: ["0601023AZ"], names: ["tirzepatide"] },
  rx_statin:     { codes: ["0212000"],   names: [] },              // whole lipid-regulating section
  rx_ezetimibe:  { codes: ["0212000L0"], names: ["ezetimibe"] },
  rx_inclisiran: { codes: ["0212000AM"], names: ["inclisiran"] },
  rx_doac:       { codes: ["0208020Z0", "0208020Y0", "0208020AA", "0208020X0"],
                   names: ["apixaban", "rivaroxaban", "edoxaban", "dabigatran"] },
};
// high-intensity statin presentations: atorvastatin 20/40/80, rosuvastatin 10/20/40
const HI_STATIN = { atorvastatin: [20, 40, 80], rosuvastatin: [10, 20, 40] };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// OpenPrescribing gates its API behind a Cloudflare JS challenge that plain HTTP
// clients (fetch/requests) cannot pass, but a real browser engine solves it
// automatically. So we drive a headless Chromium via Playwright and read the JSON
// straight off the page. One shared page carries the cf_clearance cookie across
// all calls, so only the first request pays the challenge cost.
let _page = null;
let _browser = null;

async function initFetcher() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("\nThis ingest needs Playwright (a headless browser) to get past OpenPrescribing's Cloudflare check.\nInstall it once, then re-run:\n\n    npm install -D playwright\n    npx playwright install chromium\n    node scripts/ingest-openprescribing.mjs\n");
    process.exit(1);
  }
  _browser = await chromium.launch({ headless: true });
  const ctx = await _browser.newContext({ userAgent: UA });
  _page = await ctx.newPage();
}

async function closeFetcher() {
  try { await _browser?.close(); } catch { /* ignore */ }
}

async function api(path, params) {
  const qs = new URLSearchParams({ ...params, format: "json" }).toString();
  const url = `${BASE}${path}?${qs}`;
  let lastReason = "unknown";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await _page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
      // Cloudflare may briefly show an interstitial; poll until the body is JSON.
      for (let i = 0; i < 20; i++) {
        const text = await _page.evaluate(() => document.body?.innerText || "");
        const t = text.trim();
        if (t.startsWith("[") || t.startsWith("{")) {
          try { return JSON.parse(t); } catch { /* still rendering */ }
        }
        lastReason = `non-JSON body: ${t.slice(0, 80).replace(/\s+/g, " ")}`;
        await sleep(1500);
      }
    } catch (e) {
      lastReason = `${e.name}: ${e.message}`;
    }
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`GET ${url}\n  reason: ${lastReason}`);
}

function windowMonths(latest, n) {
  // n YYYY-MM-01 strings ending at `latest` (inclusive).
  const [y, m] = [Number(latest.slice(0, 4)), Number(latest.slice(5, 7))];
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    let yy = y, mm = m - i;
    while (mm <= 0) { mm += 12; yy -= 1; }
    out.push(`${yy}-${String(mm).padStart(2, "0")}-01`);
  }
  return out;
}

async function latestMonth(code) {
  const rows = await api("/spending/", { code });
  const dates = (rows || []).map((r) => r.date).filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null;
}

// {practice_code: mean monthly items} for a single BNF code across the window.
async function meanItemsByPractice(code, months) {
  const totals = {};
  let published = 0;
  for (const date of months) {
    let rows;
    try { rows = await api("/spending_by_org/", { org_type: "practice", code, date }); }
    catch { rows = null; }
    if (rows && rows.length) {
      published++;
      for (const r of rows) if (r.row_id) totals[r.row_id] = (totals[r.row_id] || 0) + (r.items || 0);
    }
    await sleep(120);
  }
  if (!published) return {};
  const out = {};
  for (const [c, v] of Object.entries(totals)) out[c] = v / published;
  return out;
}

// Resolve single-substance drug names to current BNF chemical codes (drift-proof).
async function resolveNames(names) {
  const out = [];
  for (const name of names) {
    try {
      const rows = await api("/bnf_code/", { q: name });
      const chem = (rows || []).filter((r) => String(r.type || "").toLowerCase() === "chemical");
      const nl = name.toLowerCase();
      const pick = chem.find((r) => String(r.name || "").toLowerCase() === nl)
        || chem.find((r) => String(r.name || "").toLowerCase().includes(nl) && !String(r.name || "").includes("/"))
        || chem[0];
      if (pick?.id) out.push(pick.id);
    } catch { /* skip */ }
  }
  return out;
}

// Presentation codes for the high-intensity statin strengths, resolved by name.
async function hiStatinCodes() {
  const codes = [];
  for (const [drug, strengths] of Object.entries(HI_STATIN)) {
    let rows;
    try { rows = await api("/bnf_code/", { q: drug }); } catch { rows = []; }
    for (const r of rows || []) {
      if (String(r.type || "").toLowerCase() !== "presentation") continue;
      const nm = String(r.name || "").toLowerCase();
      if (nm.includes("/")) continue; // exclude combinations
      if (strengths.some((s) => nm.includes(`${s}mg`)) && r.id) codes.push(r.id);
    }
  }
  return codes;
}

function percentiles(rateByCode) {
  // 0-100 percentile of each value within the set (ties share the lower rank).
  const vals = Object.values(rateByCode).filter((v) => v != null).sort((a, b) => a - b);
  const n = vals.length;
  const out = {};
  for (const [code, v] of Object.entries(rateByCode)) {
    if (v == null) { out[code] = null; continue; }
    let below = 0; while (below < n && vals[below] < v) below++;
    out[code] = n > 1 ? Math.round((below / (n - 1)) * 100) : 50;
  }
  return out;
}

async function main() {
  console.log(`OpenPrescribing ingest — ${MONTHS}-month mean${DRY ? " (DRY RUN)" : ""}`);
  await initFetcher();
  console.log("  headless browser ready (getting past Cloudflare)…");

  // organisation hierarchy + list sizes (paged past the 1000-row cap)
  const orgs = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa.from("organisation")
      .select("ods_code,org_level,parent_pcn,parent_icb,list_size").order("ods_code").range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    orgs.push(...data);
    if (data.length < 1000) break;
  }
  const practices = orgs.filter((o) => o.org_level === "practice");
  const listByCode = Object.fromEntries(orgs.map((o) => [o.ods_code, o.list_size || 0]));
  const parentPcn = Object.fromEntries(practices.map((p) => [p.ods_code, p.parent_pcn]));
  const parentIcb = Object.fromEntries(practices.map((p) => [p.ods_code, p.parent_icb]));
  console.log(`  ${practices.length} practices, ${orgs.length} orgs`);

  // period anchor: latest published month for a common code
  const latest = (await latestMonth("0212000")) || (await latestMonth("0601023AG"));
  if (!latest) throw new Error("Could not determine latest OpenPrescribing month.");
  const months = windowMonths(latest, MONTHS);
  const period = `${months[0].slice(0, 7)}..${months.at(-1).slice(0, 7)} (mean monthly)`;
  console.log(`  window: ${period}`);

  // resolve high-intensity statin presentations once
  const hiCodes = await hiStatinCodes();
  console.log(`  high-intensity statin presentations resolved: ${hiCodes.length}`);

  // raw mean-monthly items per practice, per metric
  const rawItems = {}; // metric_key -> {practice: items}
  for (const [key, grp] of Object.entries(GROUPS)) {
    let codes = grp.codes;
    if (grp.names.length) {
      const resolved = await resolveNames(grp.names);
      if (resolved.length) codes = resolved;
    }
    const agg = {};
    for (const c of codes) {
      const m = await meanItemsByPractice(c, months);
      for (const [pc, items] of Object.entries(m)) agg[pc] = (agg[pc] || 0) + items;
      await sleep(150);
    }
    rawItems[key] = agg;
    console.log(`  ${key}: ${Object.keys(agg).length} practices with items`);
  }

  // high-intensity statin items (numerator for the share)
  const hiItems = {};
  for (const c of hiCodes) {
    const m = await meanItemsByPractice(c, months);
    for (const [pc, items] of Object.entries(m)) hiItems[pc] = (hiItems[pc] || 0) + items;
    await sleep(120);
  }

  // ---- build rows: practice rates, roll-ups, percentiles ----
  const rows = [];
  const metricKeys = [...Object.keys(GROUPS), "rx_statin_hi"];

  for (const key of metricKeys) {
    const isShare = key === "rx_statin_hi";
    // practice-level rate
    const practiceRate = {}; const practiceRaw = {};
    for (const p of practices) {
      const code = p.ods_code, list = listByCode[code] || 0;
      if (isShare) {
        const denom = rawItems.rx_statin[code] || 0;
        practiceRaw[code] = hiItems[code] || 0;
        practiceRate[code] = denom > 0 ? Math.round((hiItems[code] || 0) / denom * 1000) / 10 : null;
      } else {
        const items = rawItems[key][code];
        practiceRaw[code] = items ?? null;
        practiceRate[code] = items != null && list > 0 ? Math.round((items / list * 1000) * 100) / 100 : (items != null ? 0 : null);
      }
    }
    const pPct = percentiles(practiceRate);
    for (const p of practices) {
      if (practiceRate[p.ods_code] == null) continue;
      rows.push({ ods_code: p.ods_code, org_level: "practice", metric_key: key, period,
        raw_items: practiceRaw[p.ods_code], items_per_1000: practiceRate[p.ods_code], percentile: pPct[p.ods_code] });
    }

    // roll up to PCN / ICB / England (list-weighted). Shares use hi/statin item sums.
    for (const [level, parentOf] of [["pcn", parentPcn], ["icb", parentIcb]]) {
      const num = {}, den = {}, hi = {}, stat = {};
      for (const p of practices) {
        const parent = parentOf[p.ods_code]; if (!parent) continue;
        if (isShare) {
          hi[parent] = (hi[parent] || 0) + (hiItems[p.ods_code] || 0);
          stat[parent] = (stat[parent] || 0) + (rawItems.rx_statin[p.ods_code] || 0);
        } else if (rawItems[key][p.ods_code] != null) {
          num[parent] = (num[parent] || 0) + rawItems[key][p.ods_code];
          den[parent] = (den[parent] || 0) + (listByCode[p.ods_code] || 0);
        }
      }
      const rate = {};
      const codes = isShare ? Object.keys(stat) : Object.keys(num);
      for (const c of codes) {
        rate[c] = isShare
          ? (stat[c] > 0 ? Math.round(hi[c] / stat[c] * 1000) / 10 : null)
          : (den[c] > 0 ? Math.round((num[c] / den[c] * 1000) * 100) / 100 : null);
      }
      const pct = percentiles(rate);
      for (const c of codes) {
        if (rate[c] == null) continue;
        rows.push({ ods_code: c, org_level: level, metric_key: key, period,
          raw_items: isShare ? hi[c] : num[c], items_per_1000: rate[c], percentile: pct[c] });
      }
    }

    // England
    let engRate, engRaw;
    if (isShare) {
      const hiSum = practices.reduce((s, p) => s + (hiItems[p.ods_code] || 0), 0);
      const statSum = practices.reduce((s, p) => s + (rawItems.rx_statin[p.ods_code] || 0), 0);
      engRaw = hiSum; engRate = statSum > 0 ? Math.round(hiSum / statSum * 1000) / 10 : null;
    } else {
      const numSum = practices.reduce((s, p) => s + (rawItems[key][p.ods_code] || 0), 0);
      const listSum = practices.reduce((s, p) => s + (rawItems[key][p.ods_code] != null ? (listByCode[p.ods_code] || 0) : 0), 0);
      engRaw = numSum; engRate = listSum > 0 ? Math.round((numSum / listSum * 1000) * 100) / 100 : null;
    }
    if (engRate != null) rows.push({ ods_code: "ENG", org_level: "national", metric_key: key, period, raw_items: engRaw, items_per_1000: engRate, percentile: 50 });
  }

  console.log(`  built ${rows.length} rows`);
  if (DRY) {
    const eng = rows.filter((r) => r.org_level === "national");
    console.log("  England rates:", Object.fromEntries(eng.map((r) => [r.metric_key, r.items_per_1000])));
    console.log("DRY RUN — nothing written.");
    return;
  }

  // write in chunks
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supa.from("rx_value").upsert(chunk);
    if (error) { console.error("upsert error", error.message); process.exit(1); }
  }
  console.log(`Prescribing ingest complete — ${rows.length} rows for ${period}.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(closeFetcher);
