"""Generate data/hydrocarbons_kntt.json: the hydrocarbons of Hóa học 11 KNTT Chương 4 (Bài 15
"Alkane", Bài 16 "Hydrocarbon không no", Bài 17 "Arene (Hydrocarbon thơm)") that the lesson shows
(#255 round 2f).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Hóa học 11 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834, read
17/11/2026:
  - Bài 15: general formula CnH2n+2 (n ≥ 1); Bảng 15.1 names (tr. 83); methane's 109,5° (tr. 84);
    Bảng 15.2 melting point, boiling point and density at 20 °C (tr. 85; the book cites PubChem);
    reactions tr. 86–88 (halogenation, cracking, combustion with ΔrH° of CH4 and C3H8);
  - Bài 16: CnH2n and CnH2n−2 (n ≥ 2) (tr. 92); Bảng 16.1 names (tr. 94); ethylene 121,3°, C=C
    133,9 pm, C–H 108,7 pm and acetylene 180°, C≡C 120,3 pm, C–H 106,0 pm (tr. 95); Bảng 16.2 (tr. 96;
    the book cites PubChem); reactions tr. 96–98;
  - Bài 17: CnH2n−6 (n ≥ 6) (tr. 102); benzene 120°, C–C 139 pm (tr. 103); Bảng 17.1 (tr. 103; the
    book cites PubChem); reactions tr. 104–106.

Everything is review_status "pending" (docs/DATA_REVIEW.md, HH11-HC-1).

    python scripts/data/gen_hydrocarbons_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "hydrocarbons_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834"

# (id, Vietnamese, English, H = a·n + b, minimum n, lesson, page)
CLASSES = [
    ("alkane", "Alkane", "Alkanes", 2, 2, 1, 15, 82),
    ("alkene", "Alkene", "Alkenes", 2, 0, 2, 16, 92),
    ("alkyne", "Alkyne", "Alkynes", 2, -2, 2, 16, 92),
    ("arene", "Dãy đồng đẳng của benzene", "Benzene series", 2, -6, 6, 17, 102),
]

# Tables as printed: (class, name, molecular formula, condensed structure, C count, mp °C, bp °C,
# density g/cm³ at 20 °C or None, page, straight chain)
MEMBERS = [
    ("alkane", "methane", "CH4", "CH4", 1, -182.5, -161.5, None, 85, True),
    ("alkane", "ethane", "C2H6", "CH3CH3", 2, -183.3, -88.6, None, 85, True),
    ("alkane", "propane", "C3H8", "CH3CH2CH3", 3, -187.7, -42.1, 0.501, 85, True),
    ("alkane", "butane", "C4H10", "CH3[CH2]2CH3", 4, -138.3, -0.5, 0.579, 85, True),
    ("alkane", "pentane", "C5H12", "CH3[CH2]3CH3", 5, -129.7, 36.1, 0.626, 85, True),
    ("alkane", "hexane", "C6H14", "CH3[CH2]4CH3", 6, -95.3, 68.7, 0.659, 85, True),
    ("alkane", "heptane", "C7H16", "CH3[CH2]5CH3", 7, -90.6, 98.4, 0.684, 85, True),
    ("alkane", "octane", "C8H18", "CH3[CH2]6CH3", 8, -56.8, 125.7, 0.703, 85, True),
    ("alkane", "nonane", "C9H20", "CH3[CH2]7CH3", 9, -53.6, 150.8, 0.718, 85, True),
    ("alkane", "decane", "C10H22", "CH3[CH2]8CH3", 10, -29.7, 174.0, 0.730, 85, True),
    ("alkene", "ethene (ethylene)", "C2H4", "CH2=CH2", 2, -169, -105, None, 96, True),
    ("alkene", "propene (propylene)", "C3H6", "CH2=CH-CH3", 3, -185, -47.8, None, 96, True),
    ("alkene", "but-1-ene", "C4H8", "CH2=CH-CH2-CH3", 4, -185, -6.3, None, 96, True),
    ("alkene", "trans-but-2-ene", "C4H8", "CH3-CH=CH-CH3", 4, -106, 0.9, None, 96, False),
    ("alkene", "cis-but-2-ene", "C4H8", "CH3-CH=CH-CH3", 4, -139, 3.7, None, 96, False),
    ("alkene", "pent-1-ene", "C5H10", "CH2=CH-CH2-CH2-CH3", 5, -165, 30, 0.641, 96, True),
    ("alkyne", "ethyne (acetylene)", "C2H2", "HC≡CH", 2, -81, -83, None, 96, True),
    ("alkyne", "propyne", "C3H4", "HC≡C-CH3", 3, -102.7, -23.2, None, 96, True),
    ("alkyne", "but-1-yne", "C4H6", "HC≡C-CH2-CH3", 4, -126, 8.1, None, 96, True),
    ("alkyne", "but-2-yne", "C4H6", "CH3-C≡C-CH3", 4, -32, 27, 0.691, 96, False),
    ("alkyne", "pent-1-yne", "C5H8", "HC≡C-CH2-CH2-CH3", 5, -106, 40.2, 0.690, 96, True),
    ("alkyne", "pent-2-yne", "C5H8", "CH3-C≡C-CH2-CH3", 5, -109, 56.1, 0.711, 96, False),
    ("arene", "benzene", "C6H6", "C6H6", 6, 5.5, 80.1, 0.878, 103, True),
    ("arene", "toluene", "C7H8", "C6H5CH3", 7, -95.0, 110.6, 0.867, 103, True),
    ("arene", "o-xylene", "C8H10", "C6H4(CH3)2", 8, -25.2, 144, 0.880, 103, False),
    ("arene", "m-xylene", "C8H10", "C6H4(CH3)2", 8, -47.4, 139, 0.864, 103, False),
    ("arene", "p-xylene", "C8H10", "C6H4(CH3)2", 8, 13.3, 138, 0.861, 103, False),
    ("arene", "styrene", "C8H8", "C6H5CH=CH2", 8, -30.0, 145, 0.909, 103, False),
    ("arene", "naphthalene", "C10H8", "C10H8", 10, 80.26, 218, 1.0253, 103, False),
]

# Members of Bảng 17.1 outside the benzene series (a vinyl group; two fused rings).
OUTSIDE_SERIES = {"styrene", "naphthalene"}

# Shape facts as printed: (class, Vietnamese, English, page)
SHAPES = [
    ("alkane", "Methane: bốn liên kết C–H hướng về bốn đỉnh của một tứ diện đều, góc 109,5°.", "Methane: four C–H bonds point to the corners of a regular tetrahedron, at 109.5°.", 84),
    ("alkene", "Ethylene: mọi nguyên tử trên một mặt phẳng; góc HCH 121,3°; C=C 133,9 pm; C–H 108,7 pm; liên kết đôi gồm một σ và một π.", "Ethylene: all atoms in one plane; HCH angle 121.3°; C=C 133.9 pm; C–H 108.7 pm; the double bond is one σ and one π.", 95),
    ("alkyne", "Acetylene: các nguyên tử trên một đường thẳng, góc 180°; C≡C 120,3 pm; C–H 106,0 pm; liên kết ba gồm một σ và hai π.", "Acetylene: the atoms on one straight line, at 180°; C≡C 120.3 pm; C–H 106.0 pm; the triple bond is one σ and two π.", 95),
    ("arene", "Benzene: sáu nguyên tử C tạo lục giác đều, mọi nguyên tử trên một mặt phẳng, góc 120°, liên kết C–C dài 139 pm.", "Benzene: six C atoms in a regular hexagon, all atoms in one plane, 120° angles, C–C bonds of 139 pm.", 103),
]

# Reactions as printed: (class, Vietnamese kind, English kind, reactants, products, conditions vi, en, ΔrH kJ, page)
REACTIONS = [
    ("alkane", "Thế halogen", "Halogenation", [(1, "CH4"), (1, "Cl2")], [(1, "CH3Cl"), (1, "HCl")], "ánh sáng", "light", None, 86),
    ("alkane", "Cracking", "Cracking", [(1, "C9H20")], [(1, "C2H4"), (1, "C7H16")], "cracking", "cracking", None, 87),
    ("alkane", "Đốt cháy", "Combustion", [(1, "CH4"), (2, "O2")], [(1, "CO2"), (2, "H2O")], "đốt cháy", "burnt", -890, 88),
    ("alkane", "Đốt cháy", "Combustion", [(1, "C3H8"), (5, "O2")], [(3, "CO2"), (4, "H2O")], "đốt cháy", "burnt", -2216, 88),
    ("alkene", "Cộng hydrogen", "Adding hydrogen", [(1, "C2H4"), (1, "H2")], [(1, "C2H6")], "Ni, t°, áp suất", "Ni, heat, pressure", None, 96),
    ("alkene", "Cộng bromine", "Adding bromine", [(1, "C2H4"), (1, "Br2")], [(1, "C2H4Br2")], "dung dịch bromine mất màu", "bromine water loses its colour", None, 96),
    ("alkene", "Cộng HBr", "Adding HBr", [(1, "C2H4"), (1, "HBr")], [(1, "C2H5Br")], "", "", None, 97),
    ("alkene", "Cộng nước", "Adding water", [(1, "C2H4"), (1, "H2O")], [(1, "C2H6O")], "H₃PO₄, t°", "H₃PO₄, heat", None, 97),
    ("alkene", "Oxi hóa không hoàn toàn", "Partial oxidation", [(3, "C2H4"), (2, "KMnO4"), (4, "H2O")], [(3, "C2H6O2"), (2, "MnO2"), (2, "KOH")], "dung dịch thuốc tím mất màu", "permanganate loses its colour", None, 98),
    ("alkyne", "Cộng hydrogen", "Adding hydrogen", [(1, "C2H2"), (2, "H2")], [(1, "C2H6")], "Ni, t°, áp suất", "Ni, heat, pressure", None, 96),
    ("alkyne", "Cộng bromine", "Adding bromine", [(1, "C2H2"), (2, "Br2")], [(1, "C2H2Br4")], "", "", None, 96),
    ("alkyne", "Cộng nước", "Adding water", [(1, "C2H2"), (1, "H2O")], [(1, "C2H4O")], "Hg²⁺, H₂SO₄, t°", "Hg²⁺, H₂SO₄, heat", None, 97),
    ("alkyne", "Với AgNO₃ trong NH₃", "With AgNO₃ in NH₃", [(1, "C2H2"), (2, "AgNO3"), (2, "NH3")], [(1, "C2Ag2"), (2, "NH4NO3")], "kết tủa vàng nhạt", "pale yellow precipitate", None, 98),
    ("arene", "Thế bromine", "Bromination", [(1, "C6H6"), (1, "Br2")], [(1, "C6H5Br"), (1, "HBr")], "FeBr₃, t°", "FeBr₃, heat", None, 104),
    ("arene", "Nitro hóa", "Nitration", [(1, "C6H6"), (1, "HNO3")], [(1, "C6H5NO2"), (1, "H2O")], "H₂SO₄ đặc, t°", "concentrated H₂SO₄, heat", None, 104),
    ("arene", "Cộng chlorine", "Adding chlorine", [(1, "C6H6"), (3, "Cl2")], [(1, "C6H6Cl6")], "UV, t°", "UV, heat", None, 105),
    ("arene", "Cộng hydrogen", "Adding hydrogen", [(1, "C6H6"), (3, "H2")], [(1, "C6H12")], "Ni, t°, áp suất", "Ni, heat, pressure", None, 106),
    ("arene", "Đốt cháy", "Combustion", [(1, "C7H8"), (9, "O2")], [(7, "CO2"), (4, "H2O")], "t°", "heat", None, 106),
]


def counts(formula: str) -> dict:
    import re
    out: dict = {}
    for el, n in re.findall(r"([A-Z][a-z]?)(\d*)", formula):
        out[el] = out.get(el, 0) + int(n or 1)
    return out


def main() -> None:
    by_class = {c[0]: c for c in CLASSES}
    for cls, name, f, _, n, mp, bp, *_ in MEMBERS:
        _, _, _, a, b, nmin, _, _ = by_class[cls]
        c = counts(f)
        assert c.get("C") == n, (name, f)
        # Styrene and naphthalene are arenes of Bảng 17.1 but not of the benzene series CnH2n−6.
        assert (c.get("H") == a * n + b and n >= nmin) == (name not in OUTSIDE_SERIES), (name, f)
        assert mp < bp or name == "ethyne (acetylene)", name  # the book prints mp −81, bp −83 (sublimes)
    for cls, *_r, rs, ps, _cv, _ce, _dh, _p in [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]) for r in REACTIONS]:
        left: dict = {}
        right: dict = {}
        for k, f in rs:
            for el, m in counts(f).items():
                left[el] = left.get(el, 0) + k * m
        for k, f in ps:
            for el, m in counts(f).items():
                right[el] = right.get(el, 0) + k * m
        assert left == right, (rs, ps)
    out = {
        "dataset": "hydrocarbons_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-hh11-c4",
            "citation": (
                "SGK Hóa học 11 Kết nối tri thức, NXB Giáo dục Việt Nam: Chương 4 “Hydrocarbon”, Bài 15 "
                "(Bảng 15.1, 15.2, tr. 82–91), Bài 16 (Bảng 16.1, 16.2, tr. 92–101), Bài 17 (Bảng 17.1, "
                "tr. 102–109); bảng tính chất vật lí sách ghi nguồn PubChem"
            ),
            "url": READER,
        },
        "items": [
            {
                "class": cls,
                "name": name,
                "formula": f,
                "structure": st,
                "carbons": n,
                "mp_C": mp,
                "bp_C": bp,
                "density": d,
                "straight": straight,
                "in_series": name not in OUTSIDE_SERIES,
                "page": page,
                "review_status": "pending",
            }
            for cls, name, f, st, n, mp, bp, d, page, straight in MEMBERS
        ],
        "classes": [
            {"id": i, "name": {"vi": vi, "en": en}, "a": a, "b": b, "n_min": nmin, "lesson": lesson, "page": page}
            for i, vi, en, a, b, nmin, lesson, page in CLASSES
        ],
        "shapes": [{"class": c, "text": {"vi": vi, "en": en}, "page": p} for c, vi, en, p in SHAPES],
        "reactions": [
            {
                "class": c,
                "kind": {"vi": kvi, "en": ken},
                "reactants": [{"coef": k, "formula": f} for k, f in rs],
                "products": [{"coef": k, "formula": f} for k, f in ps],
                # The book prints no condition for some additions: a dash, never an invented one.
                "conditions": {"vi": cvi or "—", "en": cen or "—"},
                "dH_kJ": dh,
                "page": p,
            }
            for c, kvi, ken, rs, ps, cvi, cen, dh, p in REACTIONS
        ],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(MEMBERS)} members, {len(REACTIONS)} reactions")


if __name__ == "__main__":
    main()
