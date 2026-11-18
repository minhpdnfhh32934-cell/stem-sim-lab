"""Generate data/gas_kntt.json: the data of Vật lí 12 KNTT Chương II "Khí lí tưởng" (Bài 8–12) that the
"Khí lí tưởng" lesson uses (#255 round 3b).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Vật lí 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/shs-vat-li-12.4701697631, read
17/11/2026:
  - Bài 8: oxygen molecules move at about 400 m/s on average at T = 273 K, p = 1 atm (10⁵ Pa)
    (tr. 35);
  - Bài 9: Boyle's law pV = const (tr. 39), Bảng 9.1 (tr. 38), worked example (tr. 39: 10 L at
    10⁵ Pa, then 1,25·10⁵ Pa), question 1 (tr. 40: 0,04 m³ at 120 kPa squeezed to 0,025 m³);
  - Bài 10: Charles's law V/T = const (tr. 42), Bảng 10.1 (tr. 43), worked example (tr. 43:
    32 °C → 117 °C, the volume grows by 1,7 L), the laws hold for p not above 10⁵ Pa and T not
    below 200 K (tr. 44);
  - Bài 11: pV/T = const (tr. 45), worked example (tr. 45–46: 100 cm³, 27 °C, 10⁵ Pa → 20 cm³,
    39 °C), R from one mole at standard conditions: 22,4·10⁻³ m³, 1,013·10⁵ Pa, 273 K (tr. 46),
    pV = nRT, R = 8,31 J/(mol·K); question 1 (tr. 47: weather balloon);
  - Bài 12: p = ⅓μm v̄² = ⅔μĒđ (tr. 49), Ēđ = 3/2 kT (tr. 50), k = R/N_A = 8,31 / 6,02·10²³ =
    1,38·10⁻²³ J/K (tr. 49); the gases of question 2 (tr. 50): nitrogen, oxygen, carbon dioxide.

The book converts °C to K with T = t + 273 throughout this chapter (Bảng 10.1, worked examples).
Standard pressure is written 1 atm (10⁵ Pa) in Bài 8 but 1,013·10⁵ Pa in Bài 11; both are kept as
printed (docs/DATA_REVIEW.md, VL12-GAS-1). Molar masses are not in this book: the app computes
them from the standard atomic weights in data/elements.json.

Everything is review_status "pending".

    python scripts/data/gen_gas_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "gas_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/shs-vat-li-12.4701697631"

# Gases of Bài 12, question 2 (tr. 50) and Bài 8 (tr. 35): (id, formula, vi, en).
GASES = [
    ("oxygen", "O2", "Oxygen (O₂)", "Oxygen (O₂)"),
    ("nitrogen", "N2", "Nitrogen (N₂)", "Nitrogen (N₂)"),
    ("carbonDioxide", "CO2", "Carbon dioxide (CO₂)", "Carbon dioxide (CO₂)"),
]

# The book's rounded constants (Bài 11 tr. 46, Bài 12 tr. 49).
CONSTANTS = {"R": 8.31, "k": 1.38e-23, "N_A": 6.02e23}

# One mole at standard conditions (Bài 11, tr. 46), from which the book finds R.
STANDARD = {"p": 1.013e5, "V": 22.4e-3, "T": 273}

# Bảng 9.1 (tr. 38): V (cm³), p (10⁵ Pa), measured at constant temperature.
BOYLE_TABLE = [(3.0, 1.0), (2.5, 1.2), (2.0, 1.5), (1.5, 1.9)]
# Bảng 10.1 (tr. 43): t (°C), T (K) as printed, V (mL), at constant pressure.
CHARLES_TABLE = [(24.5, 297.5, 30), (0.5, 273.5, 27), (41.5, 314.5, 33), (59.3, 332.3, 35)]

# Where the book says Boyle's and Charles's laws were found (tr. 44).
VALIDITY = {"p_max": 1e5, "T_min": 200}

# The book's worked questions the lesson opens on or checks (inputs only; the app computes).
EXAMPLES = [
    {"id": "boyle", "lesson": 9, "page": 39, "p1": 1e5, "V1": 10e-3, "p2": 1.25e5},
    {"id": "ball", "lesson": 9, "page": 40, "p1": 120e3, "V1": 0.04, "V2": 0.025},
    {"id": "charles", "lesson": 10, "page": 43, "t1": 32, "t2": 117, "dV": 1.7e-3},
    {"id": "pump", "lesson": 11, "page": 45, "p1": 1e5, "V1": 100e-6, "t1": 27, "V2": 20e-6, "t2": 39},
    {"id": "balloon", "lesson": 11, "page": 47, "r_high": 1, "p_high": 0.3e5, "T_high": 200,
     "p_ground": 1.02e5, "T_ground": 300},
    {"id": "oxygen-speed", "lesson": 8, "page": 35, "gas": "oxygen", "T": 273, "p": 1e5,
     "mean_speed_about": 400},
]


def main() -> None:
    for v, p in BOYLE_TABLE:
        assert v > 0 and p > 0
    for t, T, v in CHARLES_TABLE:
        # The book's T column is t + 273.
        assert abs(T - (t + 273)) < 1e-9, (t, T)
        assert v > 0
    # R as the book finds it: 1,013·10⁵ · 22,4·10⁻³ / 273 = 8,31 (rounded).
    r = STANDARD["p"] * STANDARD["V"] / STANDARD["T"]
    assert round(r, 2) == CONSTANTS["R"], r
    # k = R / N_A = 1,38·10⁻²³ (rounded, tr. 49).
    assert round(CONSTANTS["R"] / CONSTANTS["N_A"] / 1e-23, 2) == 1.38
    out = {
        "dataset": "gas_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-vl12-c2",
            "citation": (
                "SGK Vật lí 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Chương II “Khí lí tưởng”, Bài 8 (tr. 34–36), "
                "Bài 9 (Bảng 9.1, tr. 37–40), Bài 10 (Bảng 10.1, tr. 41–44), Bài 11 (tr. 45–47), Bài 12 (tr. 48–51)"
            ),
            "url": READER,
        },
        "items": [
            {"id": i, "formula": f, "name": {"vi": vi, "en": en}, "review_status": "pending"}
            for i, f, vi, en in GASES
        ],
        "constants": CONSTANTS,
        "standard": STANDARD,
        "kelvin_offset": 273,
        "boyle_table": [{"V_cm3": v, "p_1e5Pa": p} for v, p in BOYLE_TABLE],
        "charles_table": [{"t_C": t, "T_K": T, "V_mL": v} for t, T, v in CHARLES_TABLE],
        "validity": VALIDITY,
        "examples": EXAMPLES,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(GASES)} gases, {len(EXAMPLES)} examples")


if __name__ == "__main__":
    main()
