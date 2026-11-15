"""Generate data/formation_enthalpy.json: standard enthalpies of formation at 298 K, 1 bar
(HH10 Bài 17 "Biến thiên enthalpy trong các phản ứng hoá học"; Bài 22 uses the NIST values of H, X
and HX for a cross-check of the book's H–X bond energies).

Sources, book first (user decision 15/11/2026, "bám sát chương trình của sách"):
1. SGK Hoá học 10 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), Bài 17, Bảng 17.1
   "Nhiệt tạo thành chuẩn của một số chất thường gặp" (printed page 85; the book cites Silberberg,
   Chemistry: the molecular nature of matter and change, 2018), read in NXBGD's training reader.
   The book's value is the one the app uses whenever the table has the species.
2. NIST Chemistry WebBook, NIST Standard Reference Database 69 (P. J. Linstrom, W. G. Mallard,
   eds.), read on ACCESSED: species the book does not give, and the cross-check named on the
   Science Card when it does (`other`). Each value is the WebBook's "Δf H°" row for the stated
   phase, with its uncertainty and page URL. One rule for every species: the CODATA Key Values row
   (Cox, Wagman, Medvedev 1984, "CODATA Review value") when the page lists one, otherwise the
   NIST-JANAF row (Chase 1998); pages with neither are not used.
Elements in their most stable form have ΔfH° = 0 by definition (SGK tr. 84).

`reactions` names, for each library reaction the app computes, the phase of every species (the
standard state at 298 K, as the book writes them); the script checks that each one has a value.

    python scripts/data/gen_enthalpy.py            # writes the JSON
    python scripts/data/gen_enthalpy.py --check    # also re-reads every WebBook page and checks
                                                   # that the row and value are still there

review_status "pending" until a teacher checks it (docs/DATA_REVIEW.md HH10-RX-4, -5).
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
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983"

REFERENCES = {
    "sgk": {
        "id": "sgk-hh10-kntt-b17",
        "citation": "SGK Hoá học 10, Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài 17, Bảng 17.1 (tr. 85); sách dẫn nguồn Silberberg, Chemistry: the molecular nature of matter and change, McGraw-Hill 2018",
        "url": READER,
    },
    "codata": {
        "id": "codata-key-values",
        "citation": "J. D. Cox, D. D. Wagman, V. A. Medvedev, CODATA Key Values for Thermodynamics, Hemisphere, New York 1984 (as listed in the NIST Chemistry WebBook, \"CODATA Review value\")",
        "url": "https://webbook.nist.gov/chemistry/",
    },
    "janaf": {
        "id": "nist-janaf",
        "citation": "M. W. Chase Jr., NIST-JANAF Thermochemical Tables, 4th ed., J. Phys. Chem. Ref. Data, Monograph 9 (1998) (as listed in the NIST Chemistry WebBook)",
        "url": "https://webbook.nist.gov/chemistry/",
    },
    "definition": {
        "id": "dfh-definition",
        "citation": "Nhiệt tạo thành chuẩn của các đơn chất ở dạng bền vững nhất bằng không (SGK Hoá học 10 KNTT, Bài 17, tr. 84)",
        "url": READER,
    },
}
# Author text of each reference as the WebBook prints it in the row (for --check).
ROW_AUTHOR = {"codata": "Cox, Wagman, et al., 1984", "janaf": "Chase, 1998"}
PHASE_WORD = {"g": "gas", "l": "liquid", "s": "solid"}

# SGK Bảng 17.1 (tr. 85), as printed: (formula, phase, ΔfH° kJ/mol).
TEXTBOOK = [
    ("AgCl", "s", -127.0), ("BaCl2", "s", -806.1), ("BaSO4", "s", -1465.0), ("CaCl2", "s", -795.0),
    ("CaCO3", "s", -1206.9), ("CaO", "s", -635.1), ("CH4", "g", -74.9), ("C2H6", "g", -84.7),
    ("C2H2", "g", 227.0), ("CO", "g", -110.5), ("CO2", "g", -393.5), ("Ca(OH)2", "s", -986.1),
    ("HBr", "g", -36.3), ("HCl", "g", -92.3), ("HI", "g", 25.9), ("H2O", "l", -285.8),
    ("H2O", "g", -241.8), ("KCl", "s", -436.7), ("KOH", "s", -424.8), ("Fe2O3", "s", -825.5),
    ("NaCl", "s", -411.1), ("NaOH", "s", -425.6), ("NH3", "g", -45.9), ("O3", "g", 143.0),
    ("SO2", "g", -296.8), ("SO3", "l", -441.0),
]

# NIST WebBook: (formula, phase, ΔfH° kJ/mol, ± kJ/mol or None, reference, WebBook ID, Mask, note)
SPECIES = [
    ("H2O", "l", -285.830, 0.040, "codata", "C7732185", 2, None),
    ("CO2", "g", -393.51, 0.13, "codata", "C124389", 1, None),
    ("CH4", "g", -74.87, None, "janaf", "C74828", 1, None),
    ("CaO", "s", -634.92, 0.90, "codata", "C1305788", 2, None),
    ("NH4Cl", "s", -314.55, None, "janaf", "C12125029", 2, None),
    ("NH3", "g", -45.94, 0.35, "codata", "C7664417", 1, None),
    ("HCl", "g", -92.31, 0.10, "codata", "C7647010", 1, None),
    ("SO2", "g", -296.81, 0.20, "codata", "C7446095", 1, None),
    ("Fe2O3", "s", -825.50, None, "janaf", "C1317608", 2, "hematite"),
    ("CO", "g", -110.53, 0.17, "codata", "C630080", 1, None),
    ("Al2O3", "s", -1675.7, 1.3, "codata", "C1344281", 2, "corundum"),
    # Atoms and hydrogen halides: D(H–X) = ΔfH°(H) + ΔfH°(X) − ΔfH°(HX), the cross-check of the
    # book's Bảng 22.1 bond energies.
    ("H", "g", 217.998, 0.006, "codata", "C12385136", 1, None),
    ("F", "g", 79.38, 0.30, "codata", "C14762948", 1, None),
    ("Cl", "g", 121.301, 0.008, "codata", "C22537151", 1, None),
    ("Br", "g", 111.87, 0.12, "codata", "C10097322", 1, None),
    ("I", "g", 106.76, 0.04, "codata", "C14362448", 1, None),
    ("HF", "g", -273.30, 0.70, "codata", "C7664393", 1, None),
    ("HBr", "g", -36.29, 0.16, "codata", "C10035106", 1, None),
    ("HI", "g", 26.50, 0.10, "codata", "C10034852", 1, None),
]
# Elements in their most stable form at 298 K, 1 bar.
REFERENCE_STATES = [("H2", "g"), ("O2", "g"), ("N2", "g"), ("Fe", "s"), ("Al", "s")]

# Library reactions (data/reactions.json ids) and the phase of each species at 298 K.
REACTIONS = [
    ("h2-o2", {"H2": "g", "O2": "g", "H2O": "l"}),
    ("ch4-combustion", {"CH4": "g", "O2": "g", "CO2": "g", "H2O": "l"}),
    ("caco3-decomp", {"CaCO3": "s", "CaO": "s", "CO2": "g"}),
    ("nh4cl-decomp", {"NH4Cl": "s", "NH3": "g", "HCl": "g"}),
    ("haber", {"N2": "g", "H2": "g", "NH3": "g"}),
    # SO3 as the book's table and its worked example give it (liquid).
    ("contact", {"SO2": "g", "O2": "g", "SO3": "l"}),
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


def check() -> None:
    for formula, phase, value, _, ref, cas, mask, _ in SPECIES:
        url = WEBBOOK.format(id=cas, mask=mask)
        word, author = PHASE_WORD[phase], ROW_AUTHOR[ref]
        found = False
        for row in webbook_rows(url):
            m = re.match(rf"Δ\s*f\s*H°\s*{word}\s+(-?\d+\.?\d*)", row)
            if m and author in row and abs(float(m.group(1)) - value) < 1e-9:
                found = True
        if not found:
            raise SystemExit(f"{formula}({phase}): {value} ({author}) not found at {url}")
        print(f"ok {formula}({phase}) {value} — {author}")
        time.sleep(1)


def main() -> None:
    nist = {
        (f, p): {
            "dfh_kj_mol": v, "uncertainty_kj_mol": unc, "source": ref,
            "url": WEBBOOK.format(id=cas, mask=mask), **({"form": form} if form else {}),
        }
        for f, p, v, unc, ref, cas, mask, form in SPECIES
    }
    items = []
    for formula, phase, value in TEXTBOOK:
        other = nist.pop((formula, phase), None)
        items.append({
            "formula": formula, "phase": phase, "dfh_kj_mol": value, "uncertainty_kj_mol": None,
            "source": "sgk", "page": 85, **({"other": other} if other else {}),
            "review_status": "pending",
        })
    for (formula, phase), item in nist.items():
        items.append({"formula": formula, "phase": phase, **item, "review_status": "pending"})
    for formula, phase in REFERENCE_STATES:
        items.append({
            "formula": formula, "phase": phase, "dfh_kj_mol": 0, "uncertainty_kj_mol": None,
            "source": "definition", "page": 84, "review_status": "pending",
        })
    known = {(i["formula"], i["phase"]) for i in items}
    assert len(known) == len(items), "duplicate species"
    for rid, phases in REACTIONS:
        for f, p in phases.items():
            assert (f, p) in known, (rid, f, p)
    if "--check" in sys.argv:
        check()
    out = {
        "dataset": "formation_enthalpy",
        "version": 1,
        "source": REFERENCES["sgk"],
        "generated_by": "scripts/data/gen_enthalpy.py",
        "accessed": ACCESSED,
        "references": REFERENCES,
        "items": items,
        "reactions": [{"id": rid, "phases": phases} for rid, phases in REACTIONS],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(items)} species ({len(TEXTBOOK)} from the book), {len(REACTIONS)} reactions to {OUT}")


if __name__ == "__main__":
    main()
