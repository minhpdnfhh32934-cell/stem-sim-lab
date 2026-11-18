"""Generate data/ecology12_kntt.json: the numbers of Sinh học 12 KNTT Bài 23 "Môi trường và các nhân
tố sinh thái" and Bài 29 "Trao đổi vật chất và chuyển hoá năng lượng trong hệ sinh thái" that the
lessons use (#255 round 5d).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Sinh học 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader, read 17/11/2026:
  - Bài 23 tr. 125 (Hình 23.5 and its example, from Mai Sỹ Tuấn et al. 2022): plants photosynthesise
    best at 20–30 °C and stop photosynthesising and respiring below 0 °C or above 40 °C;
  - Bài 29 tr. 158: about 1 % of the sunlight reaching the ground feeds photosynthesis; tr. 158–159:
    the ecological efficiency between successive levels averages about 10 %, in practice 5–20 %;
    tr. 159 (Hình 29.6, from Odum 1959): pyramids of numbers (individuals per 0,1 ha), biomass
    (g dry mass per m²) and energy (kcal per m² per year).

Everything is review_status "pending".

    python scripts/data/gen_ecology12_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "ecology12_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-12.4701665546"

# Bài 23: the temperature example of the tolerance law (°C).
TOLERANCE = {"lower_limit": 0, "optimum_from": 20, "optimum_to": 30, "upper_limit": 40}

# Hình 29.6: (id, kind, place vi, place en, unit, levels from the producers up: (level, vi, en, value)).
PYRAMIDS = [
    ("grassland", "number", "Đồng cỏ (mùa hè)", "Grassland (summer)", "cá thể/0,1 ha", [
        (1, "Cỏ", "Grass", 1500000),
        (2, "Côn trùng ăn cỏ", "Herbivorous insects", 200000),
        (3, "Côn trùng săn mồi", "Predatory insects", 90000),
        (4, "Chim", "Birds", 1),
    ]),
    ("forest", "number", "Rừng ôn đới (mùa hè)", "Temperate forest (summer)", "cá thể/0,1 ha", [
        (1, "Cây thân gỗ", "Trees", 200),
        (2, "Côn trùng ăn thực vật", "Plant-eating insects", 150000),
        (3, "Côn trùng săn mồi", "Predatory insects", 120000),
        (4, "Chim", "Birds", 5),
    ]),
    ("reef", "biomass", "Rạn san hô Eniwetok, Marshall", "Eniwetok coral reef, Marshall Islands", "g/m²", [
        (1, "Tảo, cỏ biển", "Algae, seagrass", 703),
        (2, "Nhím biển, cá nhỏ", "Sea urchins, small fish", 132),
        (3, "Cá lớn", "Large fish", 11),
    ]),
    ("channel", "biomass", "Eo biển Anh – Pháp", "English Channel", "g/m²", [
        (1, "Thực vật phù du", "Phytoplankton", 4),
        (2, "Động vật phù du", "Zooplankton", 21),
    ]),
    ("springs", "energy", "Đầm lầy Silver Spring ở Florida, Mỹ", "Silver Springs, Florida, USA", "kcal/m²/năm", [
        (1, "Tảo và thực vật", "Algae and plants", 20810),
        (2, "Côn trùng", "Insects", 3368),
        (3, "Cá nhỏ", "Small fish", 383),
        (4, "Cá lớn", "Large fish", 21),
    ]),
]
EFFICIENCY_AVERAGE = 0.10
EFFICIENCY_RANGE = [0.05, 0.20]
SUNLIGHT_TO_PHOTOSYNTHESIS = 0.01


def main() -> None:
    t = TOLERANCE
    assert t["lower_limit"] < t["optimum_from"] < t["optimum_to"] < t["upper_limit"]
    springs = next(p for p in PYRAMIDS if p[0] == "springs")
    values = [v for *_x, v in springs[5]]
    # An energy pyramid is always upright, and its steps fall within the book's 5–20 %.
    for lower, upper in zip(values, values[1:]):
        assert upper < lower
        assert EFFICIENCY_RANGE[0] <= upper / lower <= EFFICIENCY_RANGE[1], (lower, upper)
    out = {
        "dataset": "ecology12_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-sh12-b23-29",
            "citation": (
                "SGK Sinh học 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Bài 23 (Hình 23.5 và ví dụ tr. 125, sách "
                "dẫn Mai Sỹ Tuấn và cộng sự 2022), Bài 29 (tr. 158–159; Hình 29.6, sách dẫn Odum 1959)"
            ),
            "url": READER,
        },
        "items": [
            {"id": pid, "kind": kind, "place": {"vi": pvi, "en": pen}, "unit": unit,
             "levels": [{"level": lv, "name": {"vi": nvi, "en": nen}, "value": v} for lv, nvi, nen, v in levels],
             "review_status": "pending"}
            for pid, kind, pvi, pen, unit, levels in PYRAMIDS
        ],
        "tolerance_celsius": TOLERANCE,
        "efficiency_average": EFFICIENCY_AVERAGE,
        "efficiency_range": EFFICIENCY_RANGE,
        "sunlight_to_photosynthesis": SUNLIGHT_TO_PHOTOSYNTHESIS,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(PYRAMIDS)} pyramids")


if __name__ == "__main__":
    main()
