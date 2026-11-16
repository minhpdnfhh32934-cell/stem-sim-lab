"""Generate data/acid_base_kntt.json: the numbers of Hóa học 11 KNTT Bài 2 "Cân bằng trong dung
dịch nước" that the pH and titration lesson shows (#255 round 2c).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value comes from the textbook.

Source: SGK Hóa học 11 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834, read
16/11/2026:
  - tr. 20, "Em có biết": the ionic product of water Kw = [H+]·[OH-] = 10^-14 at 25 °C;
  - tr. 21: pH = -lg[H+]; acid pH < 7, neutral pH = 7, base pH > 7; the usual scale 1 to 14;
  - tr. 23, Bảng 2.1: litmus red at pH <= 6, violet at pH = 7, blue at pH >= 8; phenolphthalein
    colourless at pH < 8, pink at pH > 8; pH paper colours 1 to 14;
  - tr. 16, Hình 2.1: the pH of some everyday solutions;
  - tr. 22, Hình 2.4 (the book cites "Expert Opinion on Drug Metabolism & Toxicology") and text:
    the pH ranges of body fluids, of water for shrimp and fish, and of soil for three crops;
  - tr. 25: titrating 10 mL of 0,1 M HCl with NaOH of about 0,1 M from a 25 mL burette, with
    phenolphthalein; V_HCl·C_HCl = V_NaOH·C_NaOH.

Everything is review_status "pending" (docs/DATA_REVIEW.md, HH11-AB-1).

    python scripts/data/gen_acid_base_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "acid_base_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834"

# Hình 2.1, tr. 16: (id, Vietnamese name, English name, pH).
EVERYDAY = [
    ("lemon", "Nước chanh ép", "Lemon juice", 2),
    ("wine", "Rượu vang", "Wine", 3),
    ("banana", "Nước chuối ép", "Banana juice", 4),
    ("coffee", "Cà phê đen", "Black coffee", 5),
    ("milk", "Sữa", "Milk", 6),
    ("water", "Nước", "Water", 7),
    ("seawater", "Nước biển", "Seawater", 8),
    ("eggwhite", "Lòng trắng trứng", "Egg white", 9),
    ("cleaner", "Chất tẩy rửa đa năng", "All-purpose cleaner", 10),
    ("ammonia", "Nước ammonia", "Ammonia solution", 11),
    ("soap", "Xà phòng", "Soap", 12),
    ("oven", "Nước làm sạch lò nướng", "Oven cleaner", 13),
    ("drain", "Chất thông cống", "Drain cleaner", 14),
]

# Screen colours of pH paper from pH 1 to 14, looking like the printed Bảng 2.1 (illustrative).
PH_PAPER = [
    "#a3233f", "#e04b56", "#ef7a3f", "#f5a23d", "#f7c043", "#f2dd4a", "#c7cf48",
    "#93b85a", "#5f9a5c", "#3f7d6a", "#3b6478", "#2c5c8f", "#2a3f8a", "#2a2f7a",
]

# Hình 2.4 and the text of tr. 22: (id, Vietnamese name, English name, low, high, where).
RANGES = [
    ("saliva", "Nước bọt", "Saliva", 6.0, 7.4, "Hình 2.4, tr. 22"),
    ("blood", "Máu", "Blood", 7.3, 7.4, "Hình 2.4, tr. 22"),
    ("stomach", "Dịch dạ dày", "Stomach fluid", 1.5, 3.5, "Hình 2.4, tr. 22"),
    ("urine", "Nước tiểu", "Urine", 4.8, 7.0, "Hình 2.4, tr. 22"),
    ("shrimpFish", "Nước nuôi tôm, cá", "Water for shrimp and fish", 7.5, 8.5, "tr. 22"),
    ("tea", "Đất trồng chè", "Soil for tea", 4.5, 5.5, "tr. 22"),
    ("rice", "Đất trồng lúa", "Soil for rice", 5.5, 6.5, "tr. 22"),
    ("tomato", "Đất trồng cà chua", "Soil for tomatoes", 6.0, 7.0, "tr. 22"),
]


def main() -> None:
    assert [p for *_, p in EVERYDAY] == list(range(2, 15))
    assert len(PH_PAPER) == 14
    for *_, lo, hi, _ in RANGES:
        assert 0 < lo < hi < 14
    out = {
        "dataset": "acid_base_kntt",
        "version": 1,
        "accessed": "2026-11-16",
        "review_status": "pending",
        "source": {
            "id": "sgk-hh11-b2",
            "citation": (
                "SGK Hóa học 11 Kết nối tri thức, NXB Giáo dục Việt Nam: Bài 2 “Cân bằng trong "
                "dung dịch nước”, tr. 16–26 (Kw tr. 20; pH tr. 21; Bảng 2.1 tr. 23; Hình 2.1 "
                "tr. 16; Hình 2.4 tr. 22; chuẩn độ tr. 25)"
            ),
            "url": READER,
        },
        "kw": {"value": 1e-14, "temperature_C": 25, "book": "tr. 20, Em có biết", "review_status": "pending"},
        "indicators": {
            "litmus": {
                "red_max": 6,
                "violet": 7,
                "blue_min": 8,
                "colours": {"red": "#e0444a", "violet": "#8a6fc9", "blue": "#3f7fc4"},
                "book": "Bảng 2.1, tr. 23",
                "review_status": "pending",
            },
            "phenolphthalein": {
                "colourless_below": 8,
                "pink_above": 8,
                "colours": {"colourless": "transparent", "pink": "#ec5aa6"},
                "book": "Bảng 2.1, tr. 23",
                "review_status": "pending",
            },
            # pH paper, pH 1 to 14: screen colours chosen to look like the printed scale of Bảng 2.1
            # (an illustration, not a measured colour).
            "ph_paper": {
                "colours": PH_PAPER,
                "book": "Bảng 2.1, tr. 23 (màu minh họa)",
                "review_status": "pending",
            },
        },
        "titration": {
            "acid_volume_mL": 10,
            "acid_concentration_M": 0.1,
            "base_concentration_M": 0.1,
            "burette_mL": 25,
            "book": "tr. 25 (dung dịch NaOH nồng độ khoảng 0,1 M)",
            "review_status": "pending",
        },
        "items": [
            {"id": i, "name": {"vi": vi, "en": en}, "pH": p, "book": "Hình 2.1, tr. 16", "review_status": "pending"}
            for i, vi, en, p in EVERYDAY
        ],
        "ranges": [
            {
                "id": i,
                "name": {"vi": vi, "en": en},
                "low": lo,
                "high": hi,
                "book": where,
                "review_status": "pending",
            }
            for i, vi, en, lo, hi, where in RANGES
        ],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(EVERYDAY)} everyday solutions, {len(RANGES)} ranges")


if __name__ == "__main__":
    main()
