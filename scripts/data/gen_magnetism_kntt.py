"""Generate data/magnetism_kntt.json: the data of Vật lí 12 KNTT Chương III "Từ trường" (Bài 15–17) that
the lessons "Lực từ. Cảm ứng từ" and "Cảm ứng điện từ. Máy phát điện xoay chiều" use (#255 round 3c).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Vật lí 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/shs-vat-li-12.4701697631, read
17/11/2026:
  - Bài 15: F = BIL sinα (15.2, tr. 63), B = F/(IL sinα) (15.1, tr. 62); the coil of the experiment
    (n = 200 turns, side l = 10 cm, tr. 61) and Bảng 15.1 (tr. 64: α = 90°, L = nl = 20 m; I, F and
    the printed F/(IL)); the questions of tr. 63 (1 m, 3 A, 5·10⁻² T, 60°; 50 cm, 5 mT, 10¹⁸
    electrons each second, |e| = 1,60·10⁻¹⁹ C);
  - Bài 16: Φ = BS cosα (16.1, tr. 66), e = −N ΔΦ/Δt (tr. 70);
  - Bài 17: e = E₀ cos(ωt + φ₀) with E₀ = NBSω (17.1, tr. 72), T = 2π/ω, f = ω/2π, I = I₀/√2 and
    U = U₀/√2 (17.4, 17.5, tr. 74); the three-phase generator's coils 2π/3 apart (tr. 77).

Everything is review_status "pending".

    python scripts/data/gen_magnetism_kntt.py
"""
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "magnetism_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/shs-vat-li-12.4701697631"

# The coil of the experiment (tr. 61): n turns of side l; the force acts on L = n·l (tr. 64).
COIL = {"turns": 200, "side_m": 0.1, "length_m": 20, "angle_deg": 90}
# Bảng 15.1 (tr. 64): I (A), F (N), F/(IL) as printed (T).
TABLE_15_1 = [(0.1, 0.02, 0.010), (0.2, 0.05, 0.013), (0.3, 0.07, 0.012), (0.4, 0.09, 0.011)]
# |e| as the book gives it (tr. 63).
ELECTRON_CHARGE = 1.60e-19

EXAMPLES = [
    {"id": "wire-60", "lesson": 15, "page": 63, "L": 1, "I": 3, "B": 5e-2, "angle_deg": 60},
    {"id": "electrons", "lesson": 15, "page": 63, "L": 0.5, "B": 5e-3, "angle_deg": 90,
     "electrons_per_second": 1e18},
]
# The three coils of a three-phase generator are 2π/3 apart (tr. 77).
THREE_PHASE_SHIFT = 2 * math.pi / 3


def main() -> None:
    assert COIL["turns"] * COIL["side_m"] == COIL["length_m"]
    for i, f, printed in TABLE_15_1:
        # The printed column is F/(IL) rounded half up to 3 decimals.
        exact = f / (i * COIL["length_m"])
        assert math.floor(exact * 1000 + 0.5 + 1e-9) / 1000 == printed, (i, f, exact)
    out = {
        "dataset": "magnetism_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-vl12-c3",
            "citation": (
                "SGK Vật lí 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Chương III “Từ trường”, Bài 15 (Bảng 15.1, tr. 61–65), "
                "Bài 16 (tr. 66–71), Bài 17 (tr. 72–77)"
            ),
            "url": READER,
        },
        "items": [
            {"id": f"row{k + 1}", "I": i, "F": f, "B_printed": b, "review_status": "pending"}
            for k, (i, f, b) in enumerate(TABLE_15_1)
        ],
        "coil": COIL,
        "electron_charge": ELECTRON_CHARGE,
        "three_phase_shift": THREE_PHASE_SHIFT,
        "examples": EXAMPLES,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(TABLE_15_1)} rows, {len(EXAMPLES)} examples")


if __name__ == "__main__":
    main()
