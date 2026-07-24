"""
OpenPrescribing -> QOF Optimiser prescribing ingest (Python / requests).

Uses the same plain-requests method as the working Pydroid script. Fetches the
8 app measures (adds DOACs), converts to mean monthly items per 1,000 patients,
rolls up practice -> PCN -> ICB -> England with a peer percentile, and upserts
into the app's rx_value table via the Supabase REST API.

Run from the qof-optimiser folder:
    python scripts/ingest_openprescribing.py            # full run
    python scripts/ingest_openprescribing.py --test     # connectivity test only
    python scripts/ingest_openprescribing.py --dry      # fetch + compute, don't write
    MONTHS=3 python scripts/ingest_openprescribing.py    # window length (default 3)

Needs: pip install requests   (pandas NOT required)
Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
"""
import os, sys, time, math, json
import requests

BASE = "https://openprescribing.net/api/1.0"
DRY = "--dry" in sys.argv
TEST_ONLY = "--test" in sys.argv
N_MONTHS = int(os.environ.get("MONTHS", "3"))
SLEEP = 0.25

session = requests.Session()
session.headers.update({"User-Agent": "GP-Prescribing-Analysis/1.0 (research)"})

# metric_key -> BNF chemical codes to sum (verified against openprescribing.net/bnf/)
MEASURES = {
    "rx_sglt2i": ["0601023AG", "0601023AN", "0601023AM", "0601023AX",
                  "0601023AL", "0601023AP", "0601023AR", "0601023AY", "0601023AV"],
    "rx_glp1_sema": ["0601023AW"],
    "rx_tirzepatide": ["0601023AZ"],
    "rx_ezetimibe": ["0212000L0"],
    "rx_inclisiran": ["0212000AM"],
    "rx_doac": ["0208020Z0", "0208020Y0", "0208020AA", "0208020X0"],  # apixaban, rivaroxaban, edoxaban, dabigatran
}
STATIN_CHEMS = ["0212000B0", "0212000AA", "0212000Y0", "0212000X0", "0212000M0"]  # ator, rosu, simva, prava, fluva
HI_STATINS = {"0212000B0": ["20mg", "40mg", "80mg"], "0212000AA": ["10mg", "20mg", "40mg"]}  # atorvastatin, rosuvastatin

# Ratio (%) measures: numerator items / denominator items * 100 (higher = better).
# rx_doac_anticoag: DOACs as a share of oral anticoagulants (DOAC vs warfarin).
DOAC_CODES = ["0208020Z0", "0208020Y0", "0208020AA", "0208020X0"]  # apixaban, rivaroxaban, edoxaban, dabigatran
WARFARIN_CODES = ["0208020V0"]  # warfarin sodium
# rx_metformin_mr: modified-release metformin as a share of all metformin.
METFORMIN_CHEM = "0601022B0"
MR_NAME_HINTS = ["m/r", "modified", " sr ", " sr", "prolonged", "xr", " mr "]  # MR presentation name markers


def api_get(path, params=None, retries=3):
    params = dict(params or {}); params["format"] = "json"
    last = None
    for attempt in range(retries):
        try:
            r = session.get(f"{BASE}{path}", params=params, timeout=120)
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}: {r.text[:120].strip()}"
        except requests.RequestException as e:
            last = f"{type(e).__name__}: {e}"
        time.sleep(2 ** attempt)
    raise RuntimeError(f"GET {path} failed — {last}")


def load_env():
    env = {}
    path = os.path.join(os.getcwd(), ".env.local")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def latest_month(code):
    rows = api_get("/spending/", {"code": code}) or []
    dates = [r.get("date") for r in rows if r.get("date")]
    return max(dates) if dates else None


def window_months(latest, n):
    y, m = int(latest[:4]), int(latest[5:7])
    out = []
    for i in range(n - 1, -1, -1):
        yy, mm = y, m - i
        while mm <= 0:
            mm += 12; yy -= 1
        out.append(f"{yy:04d}-{mm:02d}-01")
    return out


def mean_items_by_practice(code, months):
    """{practice_code: mean monthly items} for a BNF code, GP practices only."""
    totals, published = {}, 0
    for month in months:
        rows = api_get("/spending_by_org/", {"org_type": "practice", "code": code, "date": month}) or []
        if rows:
            published += 1
            for r in rows:
                if r.get("row_id") and (r.get("setting") in (4, None)):
                    totals[r["row_id"]] = totals.get(r["row_id"], 0) + (r.get("items") or 0)
        time.sleep(SLEEP)
    return {c: v / published for c, v in totals.items()} if published else {}


def hi_statin_presentation_codes():
    codes = []
    for chem, strengths in HI_STATINS.items():
        try:
            items = api_get("/bnf_code/", {"q": chem})
        except Exception:
            continue
        for it in items or []:
            bid, name = it.get("id", ""), (it.get("name") or "").lower()
            if len(bid) == 15 and bid.startswith(chem) and "/" not in name and any(s in name for s in strengths):
                codes.append(bid)
        time.sleep(SLEEP)
    return codes


def sb_get_all(url, key, table, select):
    out, offset = [], 0
    while True:
        r = requests.get(f"{url}/rest/v1/{table}", params={"select": select, "limit": 1000, "offset": offset},
                         headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=60)
        r.raise_for_status()
        chunk = r.json()
        out.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    return out


def sb_upsert(url, key, table, rows):
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        r = requests.post(f"{url}/rest/v1/{table}",
                          headers={"apikey": key, "Authorization": f"Bearer {key}",
                                   "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"},
                          data=json.dumps(chunk), timeout=120)
        if r.status_code >= 300:
            raise RuntimeError(f"upsert failed HTTP {r.status_code}: {r.text[:200]}")


def percentiles(rate):
    vals = sorted(v for v in rate.values() if v is not None)
    n = len(vals)
    out = {}
    for c, v in rate.items():
        if v is None:
            out[c] = None; continue
        below = sum(1 for x in vals if x < v)
        out[c] = round(below / (n - 1) * 100) if n > 1 else 50
    return out


def main():
    # ---- 0. connectivity test ----
    print("Testing OpenPrescribing reachability...")
    try:
        latest = latest_month("0212000B0")
        print(f"  OK — reachable. Latest published month: {latest}")
    except Exception as e:
        print(f"  BLOCKED — {e}\n\nThis network can't reach OpenPrescribing (same Cloudflare wall as before).")
        print("Try another network, or run the fetch where it works and import the CSV instead.")
        sys.exit(1)
    if TEST_ONLY:
        print("\n--test: connectivity confirmed, stopping here.")
        return

    months = window_months(latest, N_MONTHS)
    period = f"{months[0][:7]}..{months[-1][:7]} (OpenPrescribing, mean monthly)"
    print(f"Window: {period}\n")

    env = load_env()
    url, key = env.get("NEXT_PUBLIC_SUPABASE_URL"), env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"); sys.exit(1)

    # ---- 1. org hierarchy + list sizes (from the app DB) ----
    orgs = sb_get_all(url, key, "organisation", "ods_code,org_level,parent_pcn,parent_icb,list_size")
    practices = [o for o in orgs if o["org_level"] == "practice"]
    list_by = {o["ods_code"]: (o.get("list_size") or 0) for o in orgs}
    pcn_of = {o["ods_code"]: o.get("parent_pcn") for o in practices}
    icb_of = {o["ods_code"]: o.get("parent_icb") for o in practices}
    prac_codes = {o["ods_code"] for o in practices}
    print(f"  {len(practices)} practices in DB\n")

    # ---- 2. fetch mean monthly items per practice, per measure ----
    raw = {}  # metric_key -> {practice: mean items}
    for key_m, codes in MEASURES.items():
        agg = {}
        for c in codes:
            for p, items in mean_items_by_practice(c, months).items():
                agg[p] = agg.get(p, 0) + items
        raw[key_m] = agg
        print(f"  {key_m:<16} {len(agg)} practices with items")

    # statin total + high-intensity share
    statin = {}
    for c in STATIN_CHEMS:
        for p, items in mean_items_by_practice(c, months).items():
            statin[p] = statin.get(p, 0) + items
    print(f"  rx_statin        {len(statin)} practices with items")
    hi = {}
    for c in hi_statin_presentation_codes():
        for p, items in mean_items_by_practice(c, months).items():
            hi[p] = hi.get(p, 0) + items
    print(f"  rx_statin_hi     {len(hi)} practices (high-intensity presentations)\n")

    # ratio (%) measures: numerator group vs a denominator group
    warfarin = {}
    for c in WARFARIN_CODES:
        for p, items in mean_items_by_practice(c, months).items():
            warfarin[p] = warfarin.get(p, 0) + items
    metformin_all = mean_items_by_practice(METFORMIN_CHEM, months)
    mr_codes = [it["id"] for it in (api_get("/bnf_code/", {"q": METFORMIN_CHEM}) or [])
                if len(it.get("id", "")) == 15 and it["id"].startswith(METFORMIN_CHEM)
                and any(h in (" " + (it.get("name", "").lower()) + " ") for h in MR_NAME_HINTS)]
    metformin_mr = {}
    for c in mr_codes:
        for p, items in mean_items_by_practice(c, months).items():
            metformin_mr[p] = metformin_mr.get(p, 0) + items
    print(f"  rx_doac_anticoag warfarin from {len(warfarin)} practices")
    print(f"  rx_metformin_mr  {len(mr_codes)} MR presentations, {len(metformin_mr)} practices\n")

    # ---- 3. build rows (practice + rollups + percentile + derived decile) ----
    rows = []

    def add_ratio(metric_key, num_by, den_by):
        """A % measure = numerator items / denominator items * 100 (higher = better)."""
        def rate_for(codes_num, codes_den):  # helper on aggregated dicts
            pass
        # practice
        prate, praw = {}, {}
        for p in practices:
            c = p["ods_code"]; d = den_by.get(c, 0)
            praw[c] = num_by.get(c, 0)
            prate[c] = round(num_by.get(c, 0) / d * 1000) / 10 if d > 0 else None
        pc = percentiles(prate)
        for p in practices:
            c = p["ods_code"]
            if prate[c] is None:
                continue
            rows.append({"ods_code": c, "org_level": "practice", "metric_key": metric_key, "period": period,
                         "raw_items": praw[c], "items_per_1000": prate[c],
                         "percentile": pc[c], "decile": min(10, max(1, pc[c] // 10 + 1))})
        # rollups + england (list-weighted by summing num/den items)
        for level, parent in (("pcn", pcn_of), ("icb", icb_of)):
            num, den = {}, {}
            for p in practices:
                c = p["ods_code"]; par = parent.get(c)
                if not par:
                    continue
                num[par] = num.get(par, 0) + num_by.get(c, 0)
                den[par] = den.get(par, 0) + den_by.get(c, 0)
            rate = {par: (round(num[par] / den[par] * 1000) / 10 if den[par] > 0 else None) for par in num}
            lp = percentiles(rate)
            for par, rv in rate.items():
                if rv is None:
                    continue
                rows.append({"ods_code": par, "org_level": level, "metric_key": metric_key, "period": period,
                             "raw_items": num[par], "items_per_1000": rv,
                             "percentile": lp[par], "decile": min(10, max(1, lp[par] // 10 + 1))})
        tn = sum(num_by.get(p["ods_code"], 0) for p in practices)
        td = sum(den_by.get(p["ods_code"], 0) for p in practices)
        if td > 0:
            rows.append({"ods_code": "ENG", "org_level": "national", "metric_key": metric_key, "period": period,
                         "raw_items": tn, "items_per_1000": round(tn / td * 1000) / 10, "percentile": 50, "decile": 5})

    def add_level(metric_key, is_share, prate, praw):
        pct = percentiles(prate)
        for p in practices:
            code = p["ods_code"]
            if prate.get(code) is None:
                continue
            pc = pct[code]
            rows.append({"ods_code": code, "org_level": "practice", "metric_key": metric_key, "period": period,
                         "raw_items": praw.get(code), "items_per_1000": prate[code],
                         "percentile": pc, "decile": min(10, max(1, pc // 10 + 1))})
        # rollups
        for level, parent in (("pcn", pcn_of), ("icb", icb_of)):
            num, den, hinum, stnum = {}, {}, {}, {}
            for p in practices:
                code = p["ods_code"]; par = parent.get(code)
                if not par:
                    continue
                if is_share:
                    hinum[par] = hinum.get(par, 0) + hi.get(code, 0)
                    stnum[par] = stnum.get(par, 0) + statin.get(code, 0)
                elif praw.get(code) is not None:
                    num[par] = num.get(par, 0) + praw[code]
                    den[par] = den.get(par, 0) + list_by.get(code, 0)
            rate = {}
            for par in (stnum if is_share else num):
                if is_share:
                    rate[par] = round(hinum[par] / stnum[par] * 1000) / 10 if stnum[par] > 0 else None
                else:
                    rate[par] = round(num[par] / den[par] * 1000, 2) if den[par] > 0 else None
            lp = percentiles(rate)
            for par, rv in rate.items():
                if rv is None or par not in prac_codes and par not in list_by:
                    pass
                if rv is None:
                    continue
                pc = lp[par]
                rows.append({"ods_code": par, "org_level": level, "metric_key": metric_key, "period": period,
                             "raw_items": (hinum if is_share else num).get(par), "items_per_1000": rv,
                             "percentile": pc, "decile": min(10, max(1, pc // 10 + 1))})
        # England
        if is_share:
            hs = sum(hi.get(p["ods_code"], 0) for p in practices)
            ss = sum(statin.get(p["ods_code"], 0) for p in practices)
            eng = round(hs / ss * 1000) / 10 if ss > 0 else None
            eraw = hs
        else:
            ns = sum(praw.get(p["ods_code"], 0) or 0 for p in practices)
            ls = sum(list_by.get(p["ods_code"], 0) for p in practices if praw.get(p["ods_code"]) is not None)
            eng = round(ns / ls * 1000, 2) if ls > 0 else None
            eraw = ns
        if eng is not None:
            rows.append({"ods_code": "ENG", "org_level": "national", "metric_key": metric_key, "period": period,
                         "raw_items": eraw, "items_per_1000": eng, "percentile": 50, "decile": 5})

    for key_m in MEASURES:
        prate = {p["ods_code"]: (round(raw[key_m].get(p["ods_code"], 0) / list_by[p["ods_code"]] * 1000, 2)
                                 if list_by.get(p["ods_code"]) and raw[key_m].get(p["ods_code"]) is not None else None)
                 for p in practices}
        add_level(key_m, False, prate, raw[key_m])
    # statin volume
    prate = {p["ods_code"]: (round(statin.get(p["ods_code"], 0) / list_by[p["ods_code"]] * 1000, 2)
                             if list_by.get(p["ods_code"]) and p["ods_code"] in statin else None) for p in practices}
    add_level("rx_statin", False, prate, statin)
    # HI statin share
    srate = {p["ods_code"]: (round(hi.get(p["ods_code"], 0) / statin[p["ods_code"]] * 1000) / 10
                             if statin.get(p["ods_code"]) else None) for p in practices}
    add_level("rx_statin_hi", True, srate, hi)

    # ratio (%) measures — higher is better
    doac_total = raw["rx_doac"]  # already summed DOAC items
    add_ratio("rx_doac_anticoag", doac_total, {p["ods_code"]: doac_total.get(p["ods_code"], 0) + warfarin.get(p["ods_code"], 0) for p in practices})
    add_ratio("rx_metformin_mr", metformin_mr, metformin_all)

    print(f"Built {len(rows)} rows.")
    if DRY:
        eng = {r["metric_key"]: r["items_per_1000"] for r in rows if r["org_level"] == "national"}
        print("England rates:", eng)
        print("--dry: nothing written.")
        return
    print("Writing to rx_value...")
    sb_upsert(url, key, "rx_value", rows)
    print(f"Done — {len(rows)} rows for {period}.")


if __name__ == "__main__":
    main()
