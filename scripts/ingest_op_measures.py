"""
OpenPrescribing VALIDATED measures -> rx_value (per-practice).

Some quality measures (SABA:ICS reliance, inhaler carbon footprint, high-dose
opioids/OME) depend on OpenPrescribing's dm+d enrichment (form_route, dose
equivalence) that the public spending API doesn't expose — so they can't be
computed accurately from BNF codes. This pulls OpenPrescribing's OWN computed
per-practice values instead.

Cost: one API call per practice per measure (~6,400 x 3). It's a slow, one-off
overnight run — but RESUMABLE (skips practices already loaded for this period).

    python scripts/ingest_op_measures.py --limit 20 --dry   # quick verify (20 practices, no write)
    python scripts/ingest_op_measures.py                     # full run (resumable)

Needs: pip install requests. Reads Supabase keys from .env.local.
"""
import os, sys, time, json
import requests

BASE = "https://openprescribing.net/api/1.0"
DRY = "--dry" in sys.argv
LIMIT = None
if "--limit" in sys.argv:
    LIMIT = int(sys.argv[sys.argv.index("--limit") + 1])

PERIOD = "OpenPrescribing measures (latest month)"
# our metric_key -> OpenPrescribing measure id (all are "lower is better")
OP_MEASURES = {
    "rx_saba_ics": ("saba", True),                    # (measure id, is_percentage)
    "rx_env_inhalers": ("environmental_inhalers", True),
    "rx_opioid_highdose": ("opioidper1000", False),
}

session = requests.Session()
session.headers.update({"User-Agent": "GP-Prescribing-Analysis/1.0 (research)"})


def load_env():
    env = {}
    p = os.path.join(os.getcwd(), ".env.local")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env


def api(path, params, retries=3):
    params = dict(params); params["format"] = "json"
    last = None
    for a in range(retries):
        try:
            r = session.get(f"{BASE}{path}", params=params, timeout=90)
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            last = str(e)
        time.sleep(1.5 * (a + 1))
    raise RuntimeError(last)


def sb_get_all(url, key, table, select, extra=""):
    out, off = [], 0
    while True:
        r = requests.get(f"{url}/rest/v1/{table}", params={"select": select, "limit": 1000, "offset": off},
                         headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=60)
        r.raise_for_status(); chunk = r.json(); out += chunk
        if len(chunk) < 1000:
            break
        off += 1000
    return out


def sb_upsert(url, key, rows):
    for i in range(0, len(rows), 500):
        r = requests.post(f"{url}/rest/v1/rx_value",
                          headers={"apikey": key, "Authorization": f"Bearer {key}",
                                   "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"},
                          data=json.dumps(rows[i:i + 500]), timeout=120)
        if r.status_code >= 300:
            raise RuntimeError(f"upsert HTTP {r.status_code}: {r.text[:200]}")


def latest_point(measure, org):
    """Latest month's {calc_value, numerator, denominator, percentile} for one practice."""
    d = api("/measure_by_practice/", {"measure": measure, "org": org})
    ms = d.get("measures", [])
    data = [x for x in (ms[0].get("data", []) if ms else []) if x.get("date")]
    if not data:
        return None
    latest = max(x["date"] for x in data)
    for x in data:
        if x["date"] == latest and x.get("calc_value") is not None:
            return x
    return None


def to_quality_decile(percentile):
    """OP percentile is 0-100 (higher = prescribes more). All these measures are
    lower-is-better, so invert: low prescribing -> high quality decile (10=best)."""
    if percentile is None:
        return None
    raw = min(10, max(1, int(percentile) // 10 + 1))
    return 11 - raw


def main():
    env = load_env()
    url, key = env.get("NEXT_PUBLIC_SUPABASE_URL"), env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing Supabase keys in .env.local"); sys.exit(1)

    orgs = sb_get_all(url, key, "organisation", "ods_code,org_level,parent_pcn,parent_icb")
    practices = [o for o in orgs if o["org_level"] == "practice"]
    pcn_of = {o["ods_code"]: o.get("parent_pcn") for o in practices}
    icb_of = {o["ods_code"]: o.get("parent_icb") for o in practices}
    if LIMIT:
        practices = practices[:LIMIT]
    print(f"{len(practices)} practices to process, {len(OP_MEASURES)} measures\n")

    # resume: skip practices already loaded for this period
    done = set()
    if not DRY and not LIMIT:
        existing = sb_get_all(url, key, "rx_value", "ods_code,metric_key", )
        for r in existing:
            if r["metric_key"] in OP_MEASURES:
                done.add((r["ods_code"], r["metric_key"]))

    # aggregation accumulators for rollups
    agg = {mk: {"pcn": {}, "icb": {}, "eng_n": 0.0, "eng_d": 0.0} for mk in OP_MEASURES}
    buffer, n = [], 0
    for idx, p in enumerate(practices):
        code = p["ods_code"]
        for mk, (measure, is_pct) in OP_MEASURES.items():
            if (code, mk) in done:
                continue
            try:
                pt = latest_point(measure, code)
            except Exception:
                pt = None
            time.sleep(0.12)
            if not pt:
                continue
            val = pt["calc_value"] * (100 if is_pct and pt["calc_value"] <= 1 else 1)
            num, den = pt.get("numerator"), pt.get("denominator")
            buffer.append({"ods_code": code, "org_level": "practice", "metric_key": mk, "period": PERIOD,
                           "raw_items": num, "items_per_1000": round(val, 2),
                           "percentile": round(100 - pt["percentile"], 1) if pt.get("percentile") is not None else None,
                           "decile": to_quality_decile(pt.get("percentile"))})
            n += 1
            # accumulate for rollups (by summing numerator/denominator)
            if num is not None and den:
                for lvl, parent in (("pcn", pcn_of.get(code)), ("icb", icb_of.get(code))):
                    if parent:
                        a = agg[mk][lvl].setdefault(parent, [0.0, 0.0]); a[0] += num; a[1] += den
                agg[mk]["eng_n"] += num; agg[mk]["eng_d"] += den
        if (idx + 1) % 50 == 0:
            print(f"  {idx + 1}/{len(practices)} practices  ({n} values)")
            if buffer and not DRY:
                sb_upsert(url, key, buffer); buffer = []

    # rollups (crude % / rate from summed numerator/denominator; no percentile at area level)
    roll = []
    for mk, (measure, is_pct) in OP_MEASURES.items():
        for lvl in ("pcn", "icb"):
            for org, (nn, dd) in agg[mk][lvl].items():
                if dd > 0:
                    v = nn / dd * (100 if is_pct else 1)
                    roll.append({"ods_code": org, "org_level": lvl, "metric_key": mk, "period": PERIOD,
                                 "raw_items": nn, "items_per_1000": round(v, 2), "percentile": None, "decile": None})
        if agg[mk]["eng_d"] > 0:
            v = agg[mk]["eng_n"] / agg[mk]["eng_d"] * (100 if is_pct else 1)
            roll.append({"ods_code": "ENG", "org_level": "national", "metric_key": mk, "period": PERIOD,
                         "raw_items": agg[mk]["eng_n"], "items_per_1000": round(v, 2), "percentile": 50, "decile": 5})

    print(f"\nPractice values: {n} | rollup rows: {len(roll)}")
    if DRY:
        # show a sample + England
        for r in buffer[:6]:
            print("  ", {k: r[k] for k in ("ods_code", "metric_key", "items_per_1000", "decile")})
        print("  England:", {r["metric_key"]: r["items_per_1000"] for r in roll if r["org_level"] == "national"})
        print("--dry: nothing written.")
        return
    if buffer:
        sb_upsert(url, key, buffer)
    sb_upsert(url, key, roll)
    print(f"Done — {n} practice values + {len(roll)} rollups for '{PERIOD}'.")


if __name__ == "__main__":
    main()
