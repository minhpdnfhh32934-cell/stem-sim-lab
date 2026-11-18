"""Generate data/thermal_kntt.json: the thermal data of Vật lí 12 KNTT Chương I (Bài 2–6) that the
"Nhiệt và chuyển thể" lesson uses (#255 round 3a).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Vật lí 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/shs-vat-li-12.4701697631, read
17/11/2026:
  - Bài 2: ΔU = A + Q and its sign convention (tr. 12, Hình 2.4); the incline question (tr. 14,
    question 2: 1 kg, 21 m, 30°, 4,1 m/s, g = 9,8 m/s²);
  - Bài 3: T (K) = t (°C) + 273,15 and its usual rounding + 273 (tr. 17–18); °F = 32 + 1,8 t (tr. 18,
    "Em có biết"); the temperatures of Hình 3.3 (tr. 17);
  - Bài 4: Bảng 4.1 specific heats (tr. 20); question 3 (tr. 21: 20 L of water, 20 → 70 °C, 2,5 kW,
    80 %);
  - Bài 5: Bảng 5.1 melting points and specific latent heats of fusion (tr. 24); question 2 (tr. 24:
    2 kg of copper from 30 °C, 20 000 W, 50 %);
  - Bài 6: Bảng 6.1 boiling points and specific latent heats of vaporisation (tr. 27).

Two values disagree inside the book and are kept as printed (docs/DATA_REVIEW.md, VL12-TH-1): the
boiling point of ethanol is 78 °C in Bảng 6.1 but 79 °C (352 K) in Hình 3.3.

Everything is review_status "pending".

    python scripts/data/gen_thermal_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "thermal_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/shs-vat-li-12.4701697631"

# (id, vi, en, c solid, c liquid, c gas [J/(kg·K), Bảng 4.1], melting point °C, λ [J/kg] (Bảng 5.1),
#  boiling point °C, L [J/kg] (Bảng 6.1)). None = the book gives no value.
SUBSTANCES = [
    ("water", "Nước", "Water", 2100, 4200, None, 0, 3.34e5, 100, 2.26e6),
    ("iron", "Sắt", "Iron", 440, None, None, 1535, 2.77e5, None, None),
    ("copper", "Đồng", "Copper", 380, None, None, 1084, 1.80e5, None, None),
    ("lead", "Chì", "Lead", 130, None, None, 327, 0.25e5, None, None),
    ("mercury", "Thủy ngân", "Mercury", None, 140, None, None, None, 357, 2.85e5),
    ("ethanol", "Rượu", "Alcohol (ethanol)", None, None, None, None, None, 78, 8.57e5),
    ("ether", "Ether", "Ether", None, None, None, None, None, 34.5, 0.40e6),
    ("air", "Không khí", "Air", None, None, 1000, None, None, None, None),
    ("glass", "Thủy tinh", "Glass", 840, None, None, None, None, None, None),
    ("soil", "Đất", "Soil", 800, None, None, None, None, None, None),
]

# Hình 3.3 (tr. 17): (kelvin as printed, celsius as printed or None, vi, en). The thermometer side
# prints Celsius values only; the Kelvin side prints kelvins (some also in °C).
REFERENCE = [
    (5772, None, "Bề mặt của Mặt Trời", "Surface of the Sun"),
    (4000, None, "Lõi của Trái Đất", "Earth's core"),
    (1500, None, "Nóng sáng", "Red-hot glow"),
    (1340, None, "Điểm nóng chảy của vàng", "Melting point of gold"),
    (630, None, "Điểm sôi của thủy ngân", "Boiling point of mercury"),
    (505, None, "Điểm nóng chảy của thiếc", "Melting point of tin"),
    (373, 100, "Điểm hóa hơi của nước", "Boiling point of water"),
    (352, 79, "Điểm sôi của rượu etylic", "Boiling point of ethanol"),
    (None, 60, "Nước có thể làm bỏng tay khi nhúng vào", "Water hot enough to scald a hand"),
    (None, 37, "Cơ thể người khỏe mạnh", "A healthy human body"),
    (None, 25, "Không khí ngày mát mẻ", "Air on a mild day"),
    (273, 0, "Điểm đông đặc của nước", "Freezing point of water"),
    (90, None, "Điểm sôi của oxygen", "Boiling point of oxygen"),
    (20, None, "Điểm sôi của hydrogen", "Boiling point of hydrogen"),
    (0, -273.15, "Độ không tuyệt đối", "Absolute zero"),
]
# Hình 3.3: measuring ranges of two thermometers (K).
THERMOMETERS = [
    ("mercury", "Nhiệt kế thủy ngân", "Mercury thermometer", 234, 630),
    ("alcohol", "Nhiệt kế rượu", "Alcohol thermometer", 156, 352),
]

# The book's worked questions the lesson opens on or checks (inputs only; the app computes).
EXAMPLES = [
    {"id": "copper-melt", "lesson": 5, "page": 24, "substance": "copper", "mass": 2, "t0": 30,
     "power": 20000, "efficiency": 0.5, "to": "melted"},
    {"id": "water-heat", "lesson": 4, "page": 21, "substance": "water", "mass": 20, "t0": 20,
     "t1": 70, "power": 2500, "efficiency": 0.8},
    {"id": "incline", "lesson": 2, "page": 14, "mass": 1, "length": 21, "angle_deg": 30,
     "speed": 4.1, "g": 9.8},
]


def main() -> None:
    for sid, vi, en, cs, cl, cg, tm, lam, tb, lv in SUBSTANCES:
        assert (tm is None) == (lam is None), sid
        assert (tb is None) == (lv is None), sid
        if tm is not None and tb is not None:
            assert tm < tb, sid
    kelvins = [k for k, *_ in REFERENCE if k is not None]
    assert kelvins == sorted(kelvins, reverse=True)
    for k, c, *_ in REFERENCE:
        # Where both are printed they agree with the book's rounding T = t + 273 (tr. 18).
        if k is not None and c is not None and k != 0:
            assert k == c + 273, (k, c)
    out = {
        "dataset": "thermal_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-vl12-c1",
            "citation": (
                "SGK Vật lí 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Chương I “Vật lí nhiệt”, Bài 2 (tr. 10–14), "
                "Bài 3 (Hình 3.2, 3.3, tr. 15–19), Bài 4 (Bảng 4.1, tr. 20–23), Bài 5 (Bảng 5.1, tr. 24–26), "
                "Bài 6 (Bảng 6.1, tr. 27–29)"
            ),
            "url": READER,
        },
        "items": [
            {
                "id": sid,
                "name": {"vi": vi, "en": en},
                "c_solid": cs,
                "c_liquid": cl,
                "c_gas": cg,
                "melt_C": tm,
                "lambda": lam,
                "boil_C": tb,
                "L": lv,
                "review_status": "pending",
            }
            for sid, vi, en, cs, cl, cg, tm, lam, tb, lv in SUBSTANCES
        ],
        "reference": [
            {"kelvin": k, "celsius": c, "label": {"vi": vi, "en": en}} for k, c, vi, en in REFERENCE
        ],
        "thermometers": [
            {"id": i, "name": {"vi": vi, "en": en}, "min_K": lo, "max_K": hi} for i, vi, en, lo, hi in THERMOMETERS
        ],
        "examples": EXAMPLES,
        "kelvin_offset": 273.15,
        "kelvin_offset_rounded": 273,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(SUBSTANCES)} substances, {len(REFERENCE)} reference points")


if __name__ == "__main__":
    main()
