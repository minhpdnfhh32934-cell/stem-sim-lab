"""Generate data/formation_enthalpy.json: standard enthalpies of formation at 298.15 K, 1 bar
(HH10 Bài 17 "Biến thiên enthalpy trong các phản ứng hoá học"; Bài 22 uses the H, X and HX values
for the H–X bond enthalpy).

Source: NIST Chemistry WebBook, NIST Standard Reference Database 69 (P. J. Linstrom, W. G.
Mallard, eds.), read on ACCESSED. Each value is the WebBook's "Δf H°" row for the stated phase,
copied with its uncertainty, and its page URL is stored with it. Selection rule, the same for every
species: the CODATA Key Values row (Cox, Wagman, Medvedev 1984, "CODATA Review value") when the
page lists one, otherwise the NIST-JANAF row (Chase 1998). Pages that list neither (only single
measurements or an average) are NOT used: the species goes into `missing` and the app says it has
no cited value. Elements in their reference state have ΔfH° = 0 by definition.

`reactions` names, for each library reaction the app computes, the phase of every species (the
standard state at 298.15 K); the script checks that each one has a value or is listed as missing.

    python scripts/data/gen_enthalpy.py            # writes the JSON
    python scripts/data/gen_enthalpy.py --check    # also re-reads every WebBook page and checks
                                                   # that the row and value are still there

review_status "pending" until a teacher checks it (docs/DATA_REVIEW.md HH10-RX-3).
"""
import html
import json
import pathlib
import re
import sys
import time
import urllib.request

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "formation_enthalpy.json"
ACCESSED = "2026-11-15"
WEBBOOK = "https://webbook.nist.gov/cgi/cbook.cgi?ID={id}&Mask={mask}"

REFERENCES = {
    "codata": {
        "id": "codata-key-values",
        "citation": "J. D. Cox, D. D. Wagman, V. A. Medvedev, CODATA Key Values for Thermodynamics, Hemisphere, New York 1984 (as listed in the NIST Chemistry WebBook, \"CODATA Review value\")",
    },
    "janaf": {
        "id": "nist-janaf",
        "citation": "M. W. Chase Jr., NIST-JANAF Thermochemical Tables, 4th ed., J. Phys. Chem. Ref. Data, Monograph 9 (1998) (as listed in the NIST Chemistry WebBook)",
    },
    "definition": {
        "id": "dfh-definition",
        "citation": "Định nghĩa: enthalpy tạo thành chuẩn của đơn chất bền nhất ở 298 K, 1 bar bằng 0 (SGK Hoá học 10 KNTT, Bài 17)",
    },
}
# Author text of each reference as the WebBook prints it in the row (for --check).
ROW_AUTHOR = {"codata": "Cox, Wagman, et al., 1984", "janaf": "Chase, 1998"}
PHASE_WORD = {"g": "gas", "l": "liquid", "s": "solid"}

# (formula, phase, ΔfH° kJ/mol, ± kJ/mol or None, reference, WebBook ID, Mask, note)
SPECIES = [
    ("H2O", "l", -285.830, 0.040, "codata", "C7732185", 2, None),
    ("CO2", "g", -393.51, 0.13, "codata", "C124389", 1, None),
    ("CH4", "g", -74.87, None, "janaf", "C74828", 1, None),
    ("CaO", "s", -634.92, 0.90, "codata", "C1305788", 2, None),
    ("NH4Cl", "s", -314.55, None, "janaf", "C12125029", 2, None),
    ("NH3", "g", -45.94, 0.35, "codata", "C7664417", 1, None),
    ("HCl", "g", -92.31, 0.10, "codata", "C7647010", 1, None),
    ("SO2", "g", -296.81, 0.20, "codata", "C7446095", 1, None),
    ("SO3", "g", -395.77, None, "janaf", "C7446119", 1, None),
    ("Fe2O3", "s", -825.50, None, "janaf", "C1317608", 2, "hematite"),
    ("CO", "g", -110.53, 0.17, "codata", "C630080", 1, None),
    ("Al2O3", "s", -1675.7, 1.3, "codata", "C1344281", 2, "corundum"),
    # Atoms and hydrogen halides (Bài 22: D(H–X) = ΔfH°(H) + ΔfH°(X) − ΔfH°(HX)).
    ("H", "g", 217.998, 0.006, "codata", "C12385136", 1, None),
    ("F", "g", 79.38, 0.30, "codata", "C14762948", 1, None),
    ("Cl", "g", 121.301, 0.008, "codata", "C22537151", 1, None),
    ("Br", "g", 111.87, 0.12, "codata", "C10097322", 1, None),
    ("I", "g", 106.76, 0.04, "codata", "C14362448", 1, None),
    ("HF", "g", -273.30, 0.70, "codata", "C7664393", 1, None),
    ("HBr", "g", -36.29, 0.16, "codata", "C10035106", 1, None),
    ("HI", "g", 26.50, 0.10, "codata", "C10034852", 1, None),
]
# Elements in their reference state at 298.15 K, 1 bar.
REFERENCE_STATES = [("H2", "g"), ("O2", "g"), ("N2", "g"), ("Fe", "s"), ("Al", "s")]

MISSING = [
    ("CaCO3", "s", {
        "vi": "NIST Chemistry WebBook (calcite, ID B6004659) và bảng CODATA Key Values không có ΔfH° của CaCO₃(s); cần giáo viên chọn một nguồn khác (ví dụ bảng NBS 1982).",
        "en": "Neither the NIST Chemistry WebBook (calcite, ID B6004659) nor the CODATA Key Values list ΔfH° of CaCO₃(s); a teacher must choose another source (e.g. the 1982 NBS tables).",
    }),
]

# Library reactions (data/reactions.json ids) and the phase of each species at 298.15 K.
REACTIONS = [
    ("h2-o2", {"H2": "g", "O2": "g", "H2O": "l"}),
    ("ch4-combustion", {"CH4": "g", "O2": "g", "CO2": "g", "H2O": "l"}),
    ("caco3-decomp", {"CaCO3": "s", "CaO": "s", "CO2": "g"}),
    ("nh4cl-decomp", {"NH4Cl": "s", "NH3": "g", "HCl": "g"}),
    ("haber", {"N2": "g", "H2": "g", "NH3": "g"}),
    ("contact", {"SO2": "g", "O2": "g", "SO3": "g"}),
    ("fe2o3-co", {"Fe2O3": "s", "CO": "g", "Fe": "s", "CO2": "g"}),
    ("thermite", {"Al": "s", "Fe2O3": "s", "Al2O3": "s", "Fe": "s"}),
]


def webbook_rows(url: str) -> list[str]:
    """Text of every table row of a WebBook page that holds a ΔfH° value."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (SimLab data check)"})
    page = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
    rows = []
    for m in re.finditer(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", m.group(1)))).strip()
        if re.search(r"Δ\s*f\s*H°", text):
            rows.append(text)
    return rows


def check(items) -> None:
    for it in items:
        if it["reference"] == "definition":
            continue
        rows = webbook_rows(it["url"])
        word = PHASE_WORD[it["phase"]]
        author = ROW_AUTHOR[it["reference"]]
        ok = False
        for row in rows:
            m = re.match(rf"Δ\s*f\s*H°\s*{word}\s+(-?\d+\.?\d*)", row)
            if m and author in row and abs(float(m.group(1)) - it["dfh_kj_mol"]) < 1e-9:
                ok = True
        if not ok:
            raise SystemExit(f"{it['formula']}({it['phase']}): {it['dfh_kj_mol']} ({author}) not found at {it['url']}")
        print(f"ok {it['formula']}({it['phase']}) {it['dfh_kj_mol']} — {author}")
        time.sleep(1)


def main() -> None:
    items = []
    for formula, phase, value, unc, ref, cas, mask, form in SPECIES:
        items.append({
            "formula": formula, "phase": phase, "dfh_kj_mol": value, "uncertainty_kj_mol": unc,
            "reference": ref, "url": WEBBOOK.format(id=cas, mask=mask),
            **({"form": form} if form else {}), "review_status": "pending",
        })
    for formula, phase in REFERENCE_STATES:
        items.append({
            "formula": formula, "phase": phase, "dfh_kj_mol": 0, "uncertainty_kj_mol": None,
            "reference": "definition", "review_status": "pending",
        })
    known = {(i["formula"], i["phase"]) for i in items}
    missing = {(f, p) for f, p, _ in MISSING}
    assert len(known) == len(items), "duplicate species"
    for rid, phases in REACTIONS:
        for f, p in phases.items():
            assert (f, p) in known or (f, p) in missing, (rid, f, p)
    if "--check" in sys.argv:
        check(items)
    out = {
        "dataset": "formation_enthalpy",
        "version": 1,
        "source": {
            "id": "nist-webbook",
            "citation": f"NIST Chemistry WebBook, NIST Standard Reference Database 69 (Linstrom, Mallard, eds.), ΔfH° ở 298,15 K, 1 bar; giá trị CODATA Key Values khi có, nếu không thì NIST-JANAF (đọc ngày {ACCESSED})",
            "url": "https://webbook.nist.gov/chemistry/",
        },
        "generated_by": "scripts/data/gen_enthalpy.py",
        "accessed": ACCESSED,
        "references": REFERENCES,
        "items": items,
        "missing": [{"formula": f, "phase": p, "note": note} for f, p, note in MISSING],
        "reactions": [{"id": rid, "phases": phases} for rid, phases in REACTIONS],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(items)} species, {len(MISSING)} missing, {len(REACTIONS)} reactions to {OUT}")


if __name__ == "__main__":
    main()
