"""Generate data/metal_groups_kntt.json: the tables of Hóa học 12 KNTT Chương 7 "Nguyên tố nhóm IA
và nhóm IIA" and Bài 27 "Đại cương về kim loại chuyển tiếp dãy thứ nhất" that the lessons "Nguyên
tố nhóm IA", "Nguyên tố nhóm IIA" and "Kim loại chuyển tiếp dãy thứ nhất" use (#255 round 4e).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Hóa học 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102, read
17/11/2026:
  - Bài 24 tr. 109: Bảng 24.1 (atomic number, name, electron configuration, atomic radius from
    Silberberg 2007, E° from Dean 1999); tr. 110: Bảng 24.2 (melting and boiling points, density,
    hardness from webelements.com); tr. 111: Bảng 24.3 (Li, Na, K with water); tr. 115: flame
    colours of Li⁺, Na⁺, K⁺;
  - Bài 25 tr. 117: Bảng 25.1; tr. 118: Bảng 25.2; tr. 119: Bảng 25.3 (water), the solubility of
    the hydroxides and of the carbonates, sulfates, nitrates (g/100 g water, 20 °C; SrCO3 from
    PubChem; Ca(NO3)2 at 30 °C); tr. 120: the solubility classes (≤ 0,01 không tan, ≤ 1 ít tan,
    above dễ tan) and Bảng 25.4; tr. 121–122: ΔrH°298 of the carbonate and nitrate
    decompositions; tr. 121: flame colours of Ca²⁺, Sr²⁺, Ba²⁺;
  - Bài 27 tr. 129: Bảng 27.1 (configurations Sc–Cu); tr. 130: Bảng 27.2 (melting point, density,
    electrical and thermal conductivity relative to Hg, hardness), question 1 (Be melts at
    1 287 °C) and question 2 (K and Ca conductivity 13,3 and 28,5, hardness 0,4 and 1,75);
    tr. 131: Bảng 27.4 (common oxidation states of Cr, Mn, Fe, Cu); tr. 132: titration of FeSO4
    with KMnO4 0,02 M (10FeSO4 + 2KMnO4 + 8H2SO4 → …, 5,0 mL of FeSO4).

Everything is review_status "pending".

    python scripts/data/gen_metal_groups_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "metal_groups_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102"

# Bảng 24.1 + 24.2: (symbol, Z, name, configuration, radius pm, E° V, mp °C, bp °C, density g/cm3,
# hardness on the diamond = 10 scale).
GROUP_IA = [
    ("Li", 3, "lithium", "[He]2s1", 152, -3.040, 180.5, 1341, 0.534, 0.6),
    ("Na", 11, "sodium", "[Ne]3s1", 186, -2.713, 97.8, 881, 0.968, 0.5),
    ("K", 19, "potassium", "[Ar]4s1", 227, -2.924, 63.4, 759, 0.89, 0.4),
    ("Rb", 37, "rubidium", "[Kr]5s1", 248, -2.924, 39.3, 691, 1.532, 0.3),
    ("Cs", 55, "caesium", "[Xe]6s1", 265, -2.923, 28.4, 668, 1.878, 0.2),
]
# Bảng 25.1 + 25.2: (symbol, Z, name, configuration, radius pm, E° V, mp °C, bp °C, density).
GROUP_IIA = [
    ("Be", 4, "beryllium", "[He]2s2", 112, -1.99, 1287, 2467, 1.85),
    ("Mg", 12, "magnesium", "[Ne]3s2", 160, -2.356, 651, 1100, 1.74),
    ("Ca", 20, "calcium", "[Ar]4s2", 197, -2.84, 842, 1484, 1.55),
    ("Sr", 38, "strontium", "[Kr]5s2", 215, -2.89, 757, 1366, 2.64),
    ("Ba", 56, "barium", "[Xe]6s2", 222, -2.92, 727, 1845, 3.51),
]
# Bảng 24.3 and Bảng 25.3: the reaction with water, in the book's words (vi, en).
WATER = {
    "Li": ("Mẫu kim loại chuyển động chậm trên mặt nước.", "The metal moves slowly on the water."),
    "Na": ("Mẫu kim loại trở thành khối cầu, chạy nhanh trên mặt nước.",
           "The metal becomes a ball and runs fast on the water."),
    "K": ("Mẫu kim loại cháy, kèm tiếng nổ nhẹ.", "The metal burns with a small pop."),
    "Be": ("Không tác dụng với nước.", "Does not react with water."),
    "Mg": ("Phản ứng chậm với nước ở nhiệt độ thường, nhanh hơn khi đun nóng.",
           "Reacts slowly with water at room temperature, faster when heated."),
    "Ca": ("Tác dụng mạnh với nước ở ngay nhiệt độ thường.",
           "Reacts strongly with water at room temperature."),
    "Sr": ("Tác dụng mạnh với nước ở ngay nhiệt độ thường.",
           "Reacts strongly with water at room temperature."),
    "Ba": ("Tác dụng mạnh với nước ở ngay nhiệt độ thường.",
           "Reacts strongly with water at room temperature."),
}
# Flame colours (tr. 115, tr. 121), as words: the app shows no colour for them.
FLAME = {
    "Li": ("đỏ tía", "crimson"), "Na": ("vàng", "yellow"), "K": ("tím nhạt", "lilac"),
    "Ca": ("đỏ cam", "orange-red"), "Sr": ("đỏ son", "scarlet"), "Ba": ("lục", "green"),
}

# tr. 119: solubility in g/100 g water at 20 °C (Ca(NO3)2 at 30 °C, footnote 3).
HYDROXIDE_SOLUBILITY = {"Mg": 1.25e-3, "Ca": 0.173, "Sr": 1.77, "Ba": 3.89}
SALT_SOLUBILITY = {
    "CO3": {"Mg": 0.01, "Ca": 0.0013, "Sr": 0.0011, "Ba": 0.0024},
    "SO4": {"Mg": 33.7, "Ca": 0.20, "Sr": 0.0132, "Ba": 0.0028},
    "NO3": {"Mg": 69.5, "Ca": 152, "Sr": 69.5, "Ba": 9.02},
}
AT_30C = [("NO3", "Ca")]
# tr. 120: "Chất không tan" up to 0,01, "chất ít tan" up to 1, "chất dễ tan" above (g/100 g).
INSOLUBLE_MAX = 0.01
SLIGHTLY_MAX = 1
# Bảng 25.4 as printed: T dễ tan, I ít tan, K không tan (rows CO3, SO4, NO3, OH; Mg Ca Sr Ba).
TABLE_25_4 = {
    "CO3": "KKKK",
    "SO4": "TIIK",
    "NO3": "TTTT",
    "OH": "KITT",
}
# tr. 121–122: ΔrH°298 (kJ) of MCO3 → MO + CO2 and M(NO3)2 → MO + 2NO2 + ½O2.
CARBONATE_DH = {"Mg": 100.7, "Ca": 179.2, "Sr": 234.6, "Ba": 271.5}
NITRATE_DH = {"Mg": 255.2, "Ca": 369.5, "Sr": 452.4, "Ba": 506.2}

# Bảng 27.1 + 27.2: (symbol, Z, configuration, mp °C, density, electrical conductivity at 20 °C
# relative to Hg, thermal conductivity at 25 °C relative to Hg, hardness or None).
TRANSITION = [
    ("Sc", 21, "[Ar]3d14s2", 1541, 2.98, 1.7, 1.9, None),
    ("Ti", 22, "[Ar]3d24s2", 1668, 4.50, 2.3, 2.6, 6),
    ("V", 23, "[Ar]3d34s2", 1917, 6.11, 4.9, 3.7, 7),
    ("Cr", 24, "[Ar]3d54s1", 1907, 7.15, 7.7, 11.3, 8.5),
    ("Mn", 25, "[Ar]3d54s2", 1244, 7.21, 0.7, 0.9, 6),
    ("Fe", 26, "[Ar]3d64s2", 1535, 7.86, 10, 9.7, 4),
    ("Co", 27, "[Ar]3d74s2", 1494, 8.90, 15.4, 12.0, 5),
    ("Ni", 28, "[Ar]3d84s2", 1453, 8.91, 13.8, 11.0, 4),
    ("Cu", 29, "[Ar]3d104s1", 1084, 8.96, 57.1, 48.3, 3),
]
# tr. 130, question 2: K and Ca, for the comparison with Fe and Cu.
S_BLOCK_COMPARE = {"K": {"conductivity": 13.3, "hardness": 0.4},
                   "Ca": {"conductivity": 28.5, "hardness": 1.75}}
BE_MELTING_POINT = 1287  # tr. 130, question 1
HEAVY_METAL_MIN_DENSITY = 5  # tr. 130 question 1b (D ≥ 5 g/cm3), as Bài 19
# Bảng 27.4 (tr. 131).
OXIDATION_STATES = {"Cr": [3, 6], "Mn": [2, 4, 7], "Fe": [2, 3], "Cu": [2]}
# tr. 132: the titration.
TITRATION = {"kmno4_M": 0.02, "feso4_mL": 5.0, "feso4_approx_M": 0.10,
             "ratio_fe_per_mno4": 5,
             "equation": "10FeSO4 + 2KMnO4 + 8H2SO4 -> 5Fe2(SO4)3 + K2SO4 + 2MnSO4 + 8H2O"}


def classify(s: float) -> str:
    return "K" if s <= INSOLUBLE_MAX else "I" if s <= SLIGHTLY_MAX else "T"


def main() -> None:
    metals = ["Mg", "Ca", "Sr", "Ba"]
    # The thresholds of tr. 120 give back Bảng 25.4 as printed.
    for anion, row in TABLE_25_4.items():
        values = HYDROXIDE_SOLUBILITY if anion == "OH" else SALT_SOLUBILITY[anion]
        assert "".join(classify(values[m]) for m in metals) == row, anion
    # Both decompositions take more heat down the group (tr. 125: more stable from Be to Ba).
    for dh in (CARBONATE_DH, NITRATE_DH):
        assert [dh[m] for m in metals] == sorted(dh[m] for m in metals)
    # Radius grows down both groups (Bảng 24.1, 25.1).
    for g in (GROUP_IA, GROUP_IIA):
        assert [r[4] for r in g] == sorted(r[4] for r in g)
    # The titration as the book sets it up needs about 5 mL of KMnO4: c·V = 5·c'·V'.
    t = TITRATION
    assert abs(t["feso4_approx_M"] * t["feso4_mL"] / (t["ratio_fe_per_mno4"] * t["kmno4_M"]) - 5) < 1e-9

    def row(group, sym, z, name, conf, radius, e, mp, bp, d, hardness=None):
        item = {"id": sym, "group": group,
                "Z": z, "name": name, "configuration": conf, "radius_pm": radius, "E_V": e,
                "mp_C": mp, "bp_C": bp, "density": d, "hardness": hardness,
                "water": {"vi": WATER[sym][0], "en": WATER[sym][1]} if sym in WATER else None,
                "flame": {"vi": FLAME[sym][0], "en": FLAME[sym][1]} if sym in FLAME else None,
                "review_status": "pending"}
        return item

    items = [row("IA", *r) for r in GROUP_IA] + [row("IIA", *r) for r in GROUP_IIA]
    out = {
        "dataset": "metal_groups_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-hh12-c7-b27",
            "citation": (
                "SGK Hóa học 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Bài 24 (Bảng 24.1–24.3, tr. 108–115), "
                "Bài 25 (Bảng 25.1–25.4, tr. 116–125), Bài 27 (Bảng 27.1–27.4, tr. 128–133); sách dẫn "
                "Silberberg 2007 (bán kính), Dean 1999 (thế điện cực, số liệu vật lí, độ tan, enthalpy), "
                "webelements.com (độ cứng), PubChem (SrCO3)"
            ),
            "url": READER,
        },
        "items": items,
        "hydroxide_solubility": HYDROXIDE_SOLUBILITY,
        "salt_solubility": SALT_SOLUBILITY,
        "solubility_at_30C": [list(x) for x in AT_30C],
        "insoluble_max": INSOLUBLE_MAX,
        "slightly_soluble_max": SLIGHTLY_MAX,
        "table_25_4": TABLE_25_4,
        "carbonate_dH_kJ": CARBONATE_DH,
        "nitrate_dH_kJ": NITRATE_DH,
        "transition": [
            {"id": s, "Z": z, "configuration": c, "mp_C": mp, "density": d, "conductivity": ec,
             "thermal": tc, "hardness": h, "oxidation_states": OXIDATION_STATES.get(s, []),
             "review_status": "pending"}
            for s, z, c, mp, d, ec, tc, h in TRANSITION
        ],
        "s_block_compare": S_BLOCK_COMPARE,
        "be_melting_point_C": BE_MELTING_POINT,
        "heavy_metal_min_density": HEAVY_METAL_MIN_DENSITY,
        "titration": TITRATION,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(items)} s-block metals, {len(TRANSITION)} transition metals")


if __name__ == "__main__":
    main()
