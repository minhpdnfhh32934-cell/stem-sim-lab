"""Generate data/electrochem_kntt.json: Bảng 15.1 of Hóa học 12 KNTT, the standard electrode
potentials the lesson "Thế điện cực và nguồn điện hóa học" uses (#255 round 4c).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Hóa học 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102, read
17/11/2026:
  - Bài 15 tr. 70: Bảng 15.1, 24 half-reactions and their E° (the book cites Dean, Lange's
    Handbook of Chemistry, 1999); footnote (2): the 2H2O/H2 value is at pH = 7;
  - tr. 73–74: the Zn–Cu cell, E°pin = E°cathode − E°anode = 1,102 V; tr. 75: the Cu–Ag cell of
    Hình 15.10 (the voltmeter shows 0,459);
  - Bài 24 tr. 110: the alkali metals react with water at ordinary conditions; Bài 25 tr. 119
    (Bảng 25.3): Ca, Sr, Ba react strongly with water at room temperature, Mg slowly. These metals
    are flagged so the cell builder does not dip them in a solution.

Species are written as the app's formula reader reads them ("Cu^2+", "OH^-", "Br2(aq)").

Everything is review_status "pending".

    python scripts/data/gen_electrochem_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "electrochem_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102"

# Bảng 15.1 (tr. 70), in the book's order: (id, element column, oxidised side, reduced side,
# electrons, E° in V). A side is a list of (coefficient, species).
TABLE = [
    ("Li", "Li", [(1, "Li^+")], [(1, "Li")], 1, -3.040),
    ("K", "K", [(1, "K^+")], [(1, "K")], 1, -2.924),
    ("Ba", "Ba", [(1, "Ba^2+")], [(1, "Ba")], 2, -2.92),
    ("Ca", "Ca", [(1, "Ca^2+")], [(1, "Ca")], 2, -2.84),
    ("Na", "Na", [(1, "Na^+")], [(1, "Na")], 1, -2.713),
    ("Mg", "Mg", [(1, "Mg^2+")], [(1, "Mg")], 2, -2.356),
    ("Al", "Al", [(1, "Al^3+")], [(1, "Al")], 3, -1.676),
    ("Zn", "Zn", [(1, "Zn^2+")], [(1, "Zn")], 2, -0.762),
    ("Cr", "Cr", [(1, "Cr^3+")], [(1, "Cr")], 3, -0.74),
    ("Fe", "Fe", [(1, "Fe^2+")], [(1, "Fe")], 2, -0.44),
    ("H2O", "H2", [(2, "H2O")], [(1, "H2"), (2, "OH^-")], 2, -0.414),
    ("Cd", "Cd", [(1, "Cd^2+")], [(1, "Cd")], 2, -0.403),
    ("Ni", "Ni", [(1, "Ni^2+")], [(1, "Ni")], 2, -0.257),
    ("Sn", "Sn", [(1, "Sn^2+")], [(1, "Sn")], 2, -0.137),
    ("Pb", "Pb", [(1, "Pb^2+")], [(1, "Pb")], 2, -0.126),
    ("H", "H2", [(2, "H^+")], [(1, "H2")], 2, 0.000),
    ("Cu", "Cu", [(1, "Cu^2+")], [(1, "Cu")], 2, 0.340),
    ("Fe3", "Fe", [(1, "Fe^3+")], [(1, "Fe^2+")], 1, 0.771),
    ("Ag", "Ag", [(1, "Ag^+")], [(1, "Ag")], 1, 0.799),
    ("Hg", "Hg", [(1, "Hg^2+")], [(1, "Hg")], 2, 0.853),
    ("Br", "Br", [(1, "Br2(aq)")], [(2, "Br^-")], 2, 1.087),
    ("O", "O", [(1, "O2"), (4, "H^+")], [(2, "H2O")], 4, 1.229),
    ("Cl", "Cl", [(1, "Cl2(aq)")], [(2, "Cl^-")], 2, 1.358),
    ("Au", "Au", [(1, "Au^3+")], [(1, "Au")], 3, 1.52),
]

# The couple as the book writes it (tr. 68, 71): oxidised form / reduced form.
LABEL = {"H2O": ("2H2O", "H2"), "H": ("2H^+", "H2"), "Fe3": ("Fe^3+", "Fe^2+"),
         "Br": ("Br2", "2Br^-"), "O": ("O2", "H2O"), "Cl": ("Cl2", "2Cl^-")}

# Decimals as printed in Bảng 15.1 (−3,040 but −2,92): the table shows each value this way.
TWO_DECIMALS = {"Ba", "Ca", "Cr", "Fe", "Au"}

# tr. 70, footnote (2): this value is at pH = 7, not under standard conditions.
AT_PH7 = {"H2O"}

# Metals that react with water at room temperature (Bài 24 tr. 110; Bài 25 Bảng 25.3 tr. 119).
REACTS_WITH_WATER = {"Li": 24, "K": 24, "Na": 24, "Ca": 25, "Ba": 25}

# Cells the book works out: (anode, cathode, E°pin in V, page).
BOOK_CELLS = [("Zn", "Cu", 1.102, 74), ("Cu", "Ag", 0.459, 75)]


def charge(species: str) -> int:
    if "^" not in species:
        return 0
    tail = species.split("^", 1)[1]
    n = int(tail[:-1]) if tail[:-1] else 1
    return n if tail.endswith("+") else -n


def main() -> None:
    values = [row[5] for row in TABLE]
    assert values == sorted(values), "Bảng 15.1 is in increasing E°"
    for rid, _el, ox, red, n, _e in TABLE:
        # Charge balance of each half-reaction: ox + n e = red.
        assert sum(c * charge(s) for c, s in ox) - n == sum(c * charge(s) for c, s in red), rid
    by_id = {row[0]: row for row in TABLE}
    for a, c, e, _p in BOOK_CELLS:
        assert round(by_id[c][5] - by_id[a][5], 3) == e, (a, c)
    items = []
    for rid, el, ox, red, n, e in TABLE:
        metal = len(ox) == 1 and len(red) == 1 and red[0][1] == el and ox[0][1].startswith(el + "^")
        ox_label, red_label = LABEL.get(rid, (ox[0][1], red[0][1]))
        item = {
            "id": rid,
            "element": el,
            "ox": [[c, s] for c, s in ox],
            "red": [[c, s] for c, s in red],
            "n": n,
            "E_V": e,
            "decimals": 2 if rid in TWO_DECIMALS else 3,
            "label": [ox_label, red_label],
            "metal": metal,
            "review_status": "pending",
        }
        if rid in AT_PH7:
            item["at_pH7"] = True
        if rid in REACTS_WITH_WATER:
            item["reacts_with_water_lesson"] = REACTS_WITH_WATER[rid]
        items.append(item)
    out = {
        "dataset": "electrochem_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-hh12-b15",
            "citation": (
                "SGK Hóa học 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Bài 15 “Thế điện cực và nguồn điện "
                "hóa học”, Bảng 15.1 (tr. 70, sách dẫn Dean, Lange's Handbook of Chemistry, 1999), pin Zn – Cu "
                "(tr. 73–74), pin Cu – Ag (tr. 75); Bài 24 tr. 110, Bài 25 Bảng 25.3 tr. 119"
            ),
            "url": READER,
        },
        "items": items,
        "book_cells": [{"anode": a, "cathode": c, "E_V": e, "page": p} for a, c, e, p in BOOK_CELLS],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(items)} couples")


if __name__ == "__main__":
    main()
