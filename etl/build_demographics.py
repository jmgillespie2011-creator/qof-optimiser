#!/usr/bin/env python3
"""
Build population-weighted per-practice demographics for the QOF Optimiser.
Reuses the atlas method: weight LSOA-level IMD / rurality / ethnicity by the
practice's registered patients in each LSOA (NHS 'patients registered by LSOA').

Inputs (pass the diabetes-atlas etl folder as --atlas, and the IMD map via --imd):
  <atlas>/raw/gp-reg-pat-prac-lsoa-all.csv   PRACTICE_CODE, LSOA_CODE, NUMBER_OF_PATIENTS
  <atlas>/raw/ru_lsoa.csv                    LSOA21CD, Urban_rural_flag
  <atlas>/raw/ethnicity_lsoa.csv             census TS021 by LSOA
  <atlas>/coords.csv                         gp_code, lat, lng
  --imd  lsoa_imd.csv                        lsoa21, imd_rank (derived from ONSPD)

Outputs (into ./etl/out): demographics.csv, ethnicity.csv
"""
import csv, sys, argparse, math, os
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--atlas", required=True)
ap.add_argument("--imd", help="prebuilt lsoa21,imd_rank csv (optional)")
ap.add_argument("--onspd", help="ONSPD.csv — builds the IMD map directly (no awk needed)")
ap.add_argument("--female", help="gp-reg single-year-of-age FEMALE csv (matching QOF year)")
ap.add_argument("--male", help="gp-reg single-year-of-age MALE csv (optional; needed for whole-list over-65)")
ap.add_argument("--out", default="etl/out")
a = ap.parse_args()
ATLAS = Path(a.atlas); RAW = ATLAS / "raw"; OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)

def load_imd(p):
    m = {}
    with open(p, newline="", encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            if len(row) < 2: continue
            lsoa, rank = row[0].strip(), row[1].strip()
            try: r = int(float(rank))
            except: continue
            if lsoa and r > 0: m[lsoa] = r
    return m
def load_imd_from_onspd(p):
    """Stream ONSPD; build LSOA21 -> IMD rank (cols: lsoa21cd, imd20ind)."""
    m = {}
    with open(p, newline="", encoding="utf-8-sig") as f:
        r = csv.reader(f); header = next(r)
        hi = {h.strip().lower(): i for i, h in enumerate(header)}
        li, ii = hi.get("lsoa21cd"), hi.get("imd20ind")
        if li is None or ii is None: raise SystemExit("ONSPD missing lsoa21cd/imd20ind columns")
        for row in r:
            try:
                lsoa = row[li].strip(); rank = int(float(row[ii]))
            except (ValueError, IndexError): continue
            if lsoa.startswith("E") and rank > 0 and lsoa not in m: m[lsoa] = rank
    return m
if a.onspd:
    imd_rank = load_imd_from_onspd(a.onspd)
elif a.imd:
    imd_rank = load_imd(a.imd)
else:
    imd_rank = {}
# IMD 2019 rank 1..32844 (1 = most deprived) -> decile 1..10 (1 = most deprived)
def rank_to_decile(r): return min(10, max(1, (r - 1) // 3285 + 1))
imd_decile = {k: rank_to_decile(v) for k, v in imd_rank.items()}
print(f"IMD LSOAs: {len(imd_decile)}")

ru = {}
with open(RAW / "ru_lsoa.csv", newline="", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        c, fl = row.get("LSOA21CD"), row.get("Urban_rural_flag")
        if c and fl: ru[c.strip()] = fl.strip()
print(f"rurality LSOAs: {len(ru)}")

# ethnicity fractions per LSOA
eth = {}   # lsoa -> {Asian,Black,Mixed,White,Other} fractions
with open(RAW / "ethnicity_lsoa.csv", newline="", encoding="utf-8-sig") as f:
    for row in csv.reader(f):
        if not row or " : " not in (row[0] or ""): continue
        lsoa = row[0].split(" : ")[0].strip()
        try:
            tot = float(row[1]); 
            if tot <= 0: continue
            asian, black, mixed, white, other = float(row[3]), float(row[5]), float(row[7]), float(row[9]), float(row[11])
        except (ValueError, IndexError): continue
        eth[lsoa] = {"Asian":asian/tot,"Black":black/tot,"Mixed":mixed/tot,"White":white/tot,"Other":other/tot}
print(f"ethnicity LSOAs: {len(eth)}")


def load_sing_age(path):
    """Return {ORG_CODE: (total, over65)} from an NHS single-year-of-age file."""
    if not path or not os.path.exists(path): return {}
    out = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        for row in r:
            gp = (row.get("ORG_CODE") or "").strip()
            age = (row.get("AGE") or "").strip()
            try: n = int(float(row.get("NUMBER_OF_PATIENTS") or 0))
            except: continue
            if not gp: continue
            t, o = out.get(gp, (0, 0))
            if age == "ALL": t = n
            else:
                ag = 95 if age in ("95+","95") else (int(age) if age.isdigit() else None)
                if ag is not None and ag >= 65: o += n
            out[gp] = (t, o)
    return out
female = load_sing_age(a.female)
male = load_sing_age(a.male)
print(f"female practices: {len(female)}; male practices: {len(male)}")

coords = {}
with open(ATLAS / "coords.csv", newline="", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        coords[row["gp_code"].strip()] = (row["lat"], row["lng"])

# stream gp-reg, accumulate per practice
prac = {}   # code -> dict
with open(RAW / "gp-reg-pat-prac-lsoa-all.csv", newline="", encoding="utf-8-sig") as f:
    r = csv.DictReader(f)
    for row in r:
        gp = (row.get("PRACTICE_CODE") or "").strip()
        lsoa = (row.get("LSOA_CODE") or "").strip()
        try: n = int(float(row.get("NUMBER_OF_PATIENTS") or 0))
        except: continue
        if not gp or not lsoa or n <= 0: continue
        d = prac.setdefault(gp, {"tot":0,"imd_wsum":0,"imd_w":0,"urban":0,"rural":0,"eth":{"Asian":0,"Black":0,"Mixed":0,"White":0,"Other":0},"eth_w":0})
        d["tot"] += n
        dec = imd_decile.get(lsoa)
        if dec: d["imd_wsum"] += dec * n; d["imd_w"] += n
        fl = ru.get(lsoa)
        if fl == "Urban": d["urban"] += n
        elif fl == "Rural": d["rural"] += n
        e = eth.get(lsoa)
        if e:
            for k in d["eth"]: d["eth"][k] += e[k] * n
            d["eth_w"] += n

with open(OUT / "demographics.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["gp_code","imd_decile","imd_quintile","pct_rural","pct_female","pct_over_65","lat","lng"])
    for gp, d in sorted(prac.items()):
        dec = round(d["imd_wsum"]/d["imd_w"]) if d["imd_w"] else ""
        quint = (min(5, (dec-1)//2 + 1) if dec else "")
        ur = d["urban"] + d["rural"]
        rural = round(d["rural"]/ur*100, 1) if ur else ""
        lat, lng = coords.get(gp, ("",""))
        fem, fem_o65 = female.get(gp, (None, None))
        mal, mal_o65 = male.get(gp, (None, None))
        tot = d["tot"]
        pct_female = round(fem / tot * 100, 1) if fem and tot else ""
        if fem is not None and mal is not None and (fem + mal) > 0:
            pct_over65 = round((fem_o65 + mal_o65) / (fem + mal) * 100, 1)
        else:
            pct_over65 = ""   # need male file for whole-list %over65
        w.writerow([gp, dec, quint, rural, pct_female, pct_over65, lat, lng])

with open(OUT / "ethnicity.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["gp_code","category","pct"])
    for gp, d in sorted(prac.items()):
        if not d["eth_w"]: continue
        for k, v in d["eth"].items():
            w.writerow([gp, k, round(v/d["eth_w"]*100, 1)])

print(f"practices: {len(prac)} -> {OUT}/demographics.csv, ethnicity.csv")
