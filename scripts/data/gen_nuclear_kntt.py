"""Generate data/nuclear_kntt.json: the data of Vật lí 12 KNTT Chương IV "Vật lí hạt nhân" (Bài 21–23) that
the lessons "Hạt nhân và năng lượng liên kết" and "Phóng xạ" use (#255 round 3d).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Vật lí 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/shs-vat-li-12.4701697631, read
17/11/2026:
  - Bài 21: m_p ≈ 1,67262·10⁻²⁷ kg, m_n ≈ 1,67493·10⁻²⁷ kg, q_p = +e ≈ 1,6·10⁻¹⁹ C, 1 amu ≈
    1,66054·10⁻²⁷ kg (tr. 93); R = 1,2·10⁻¹⁵·A^(1/3) m (21.1, tr. 94) and Bảng 21.1 (tr. 94);
  - Bài 22: m_p ≈ 1,00728 amu, m_n ≈ 1,00866 amu, m(⁴He) ≈ 4,00260 amu (tr. 99), m(¹⁶O) ≈ 15,99492
    amu (question, tr. 99); about 200 MeV per fission of ²³⁵U (tr. 100–101); ²H + ²H → ³He + n
    gives about 4 MeV (tr. 102); critical masses about 47 kg (²³⁵U) and 10 kg (²³⁹Pu) (tr. 102);
  - Bài 23: Bảng 23.1 counts (tr. 105), Rn-220 halves every 55 s (tr. 107), Bảng 23.2 half-lives
    (tr. 108), 1 Ci = 3,7·10¹⁰ Bq (tr. 108), ¹⁴C half-life 5 730 years (tr. 109), ¹⁸F about 110
    minutes and 10⁹ Bq per mL (question, tr. 109), ¹⁵O loses 75 % in 244 s (question, tr. 108),
    Hình 23.10 sources of passive exposure (tr. 111), about 2,4 mSv a year from passive sources and
    the limits of Thông tư 19/2012/TT-BKHCN: 1 mSv a year, 6 mSv for learners aged 16 to 18 in
    practice, 20 mSv for radiation workers (tr. 112–113).

Two points do not agree inside the book and are kept as printed (docs/DATA_REVIEW.md, VL12-NUC-1):
the radii of Bảng 21.1 are about 20–30 % below R = 1,2·10⁻¹⁵·A^(1/3) m; the masses given for the ⁴He
and ¹⁶O nuclei (4,00260 and 15,99492 amu) are the atoms' masses (electrons included).

Everything is review_status "pending".

    python scripts/data/gen_nuclear_kntt.py
"""
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "nuclear_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/shs-vat-li-12.4701697631"

PARTICLES = {
    "proton_kg": 1.67262e-27,
    "neutron_kg": 1.67493e-27,
    "elementary_charge": 1.6e-19,
    "amu_kg": 1.66054e-27,
    "proton_amu": 1.00728,
    "neutron_amu": 1.00866,
}
RADIUS_R0 = 1.2e-15

# Bảng 21.1 (tr. 94): (id, vi, en, symbol, Z, A, atom radius (10⁻¹⁰ m), nucleus radius (10⁻¹⁵ m)).
# Z comes from the element (the table prints the name and A).
TABLE_21_1 = [
    ("H", "Hydrogen", "Hydrogen", 1, 1, 1.2, 0.9),
    ("He", "Helium", "Helium", 2, 4, 1.4, 1.7),
    ("O", "Oxygen", "Oxygen", 8, 16, 1.5, 2.7),
    ("Si", "Silicon", "Silicon", 14, 28, 2.1, 3.1),
    ("Fe", "Sắt", "Iron", 26, 56, 1.9, 3.7),
    ("Cd", "Cadimium", "Cadmium", 48, 114, 1.6, 4.6),
    ("Au", "Vàng", "Gold", 79, 197, 1.7, 5.4),
    ("U", "Uranium", "Uranium", 92, 238, 1.9, 5.9),
]

# Masses the book gives (amu): (symbol, Z, A, mass, page).
MASSES = [("He", 2, 4, 4.00260, 99), ("O", 8, 16, 15.99492, 99)]

FISSION_MEV = 200
FUSION_DD_MEV = 4
CRITICAL_KG = {"U235": 47, "Pu239": 10}

# Bảng 23.2 (tr. 108): (id, vi, en, symbol, Z, A, half-life value, unit).
HALF_LIVES = [
    ("C14", "Carbon", "Carbon", "C", 6, 14, 5.7e3, "year"),
    ("I131", "Iodine", "Iodine", "I", 53, 131, 8.0, "day"),
    ("O15", "Oxygen", "Oxygen", "O", 8, 15, 1.2e2, "second"),
    ("Po210", "Polonium", "Polonium", "Po", 84, 210, 1.4e2, "day"),
    ("Ra226", "Radium", "Radium", "Ra", 88, 226, 1.6e3, "year"),
    ("Rn219", "Radon", "Radon", "Rn", 86, 219, 4.0, "second"),
    ("U235", "Uranium", "Uranium", "U", 92, 235, 7.0e8, "year"),
]
# Bảng 23.1 (tr. 105): counts in each 5 s.
COUNTS_23_1 = [1, 3, 2, 0, 3, 1]
CURIE_BQ = 3.7e10

# Hình 23.10 (tr. 111): share (%) of passive exposure by source.
EXPOSURE = [
    ("air", "Không khí", "Air", 51),
    ("rock", "Đá", "Rock", 14),
    ("medical", "Y học hạt nhân", "Nuclear medicine", 12),
    ("food", "Thức ăn", "Food", 12),
    ("cosmic", "Tia vũ trụ", "Cosmic rays", 10),
    ("other", "Nguồn khác", "Other", 1),
]
DOSE = {"background_mSv": 2.4, "public_mSv": 1, "learner_16_18_mSv": 6, "worker_mSv": 20}

EXAMPLES = [
    {"id": "rn220", "lesson": 23, "page": 107, "isotope": "Rn220", "half_life_s": 55},
    {"id": "o15", "lesson": 23, "page": 108, "decayed": 0.75, "time_s": 244},
    {"id": "f18", "lesson": 23, "page": 109, "half_life_min": 110, "activity_bq": 1e9,
     "left": [0.1, 0.01], "after_s": 86400},
    {"id": "c14", "lesson": 23, "page": 109, "half_life_year": 5730},
    {"id": "u235-1kg", "lesson": 22, "page": 101, "mass_kg": 1, "molar_g": 235, "mev_per_fission": 200},
]


def main() -> None:
    assert sum(s for *_, s in EXPOSURE) == 100
    for sym, name_vi, name_en, z, a, ra, rn in TABLE_21_1:
        assert 0 < z <= a
    for _id, *_rest, val, unit in HALF_LIVES:
        assert unit in ("second", "day", "year") and val > 0
    # 2·1,00728 + 2·1,00866 = 4,03188 (tr. 99).
    assert abs(2 * PARTICLES["proton_amu"] + 2 * PARTICLES["neutron_amu"] - 4.03188) < 1e-9
    # The book's m_p, m_n in kg and in amu agree to the printed digits.
    assert abs(PARTICLES["proton_kg"] / PARTICLES["amu_kg"] - PARTICLES["proton_amu"]) < 1e-5
    assert abs(PARTICLES["neutron_kg"] / PARTICLES["amu_kg"] - PARTICLES["neutron_amu"]) < 1e-5
    out = {
        "dataset": "nuclear_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-vl12-c4",
            "citation": (
                "SGK Vật lí 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Chương IV “Vật lí hạt nhân”, Bài 21 (Bảng 21.1, tr. 91–95), "
                "Bài 22 (tr. 96–103), Bài 23 (Bảng 23.1, 23.2, Hình 23.10, tr. 104–113)"
            ),
            "url": READER,
        },
        "items": [
            {"id": i, "name": {"vi": vi, "en": en}, "symbol": s, "Z": z, "A": a, "half_life": val,
             "unit": unit, "review_status": "pending"}
            for i, vi, en, s, z, a, val, unit in HALF_LIVES
        ],
        "particles": PARTICLES,
        "radius_r0": RADIUS_R0,
        "table_21_1": [
            {"symbol": s, "name": {"vi": vi, "en": en}, "Z": z, "A": a, "atom_radius": ra * 1e-10,
             "nucleus_radius": rn * 1e-15}
            for s, vi, en, z, a, ra, rn in TABLE_21_1
        ],
        "masses": [{"symbol": s, "Z": z, "A": a, "amu": m, "page": p} for s, z, a, m, p in MASSES],
        "fission_mev": FISSION_MEV,
        "fusion_dd_mev": FUSION_DD_MEV,
        "critical_kg": CRITICAL_KG,
        "counts_23_1": COUNTS_23_1,
        "curie_bq": CURIE_BQ,
        "exposure": [{"id": i, "name": {"vi": vi, "en": en}, "percent": p} for i, vi, en, p in EXPOSURE],
        "dose": DOSE,
        "examples": EXAMPLES,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(HALF_LIVES)} isotopes, {len(TABLE_21_1)} radii")


if __name__ == "__main__":
    main()
