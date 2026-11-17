"""Generate data/esters_kntt.json: the data of Hóa học 12 KNTT Bài 1 "Ester – Lipid" (and Bài 2's
saponification of a fat) that the lesson "Ester và chất béo" uses (#255 round 4a).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Hóa học 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102, read
17/11/2026:
  - Bài 1 tr. 7: boiling points of propan-1-ol, acetic acid and methyl formate (M = 60; the book
    cites CRC Handbook, 97th ed.); the naming rule "tên gốc R' + tên gốc carboxylic acid" and the
    examples ethyl acetate, propyl formate, methyl acrylate, ethyl benzoate;
  - Bài 1 tr. 9, question 7: 16,2 g acetic acid and 15,2 g isoamyl alcohol give 14,16 g isoamyl
    acetate;
  - Bài 1 tr. 10: the fatty acids palmitic, stearic, oleic and linoleic acid, and Hình 1.2 (mass %
    of saturated, one-double-bond and several-double-bond fatty acid chains in some fats; the book
    cites Stoker, General, Organic and Biological Chemistry, 2013);
  - Bài 2 tr. 16: saponification of tristearin with NaOH, question 3 (tripalmitin).

The book prints no table of atomic masses: molar masses come from the standard atomic weights of
data/elements.json (docs/DATA_REVIEW.md, HH12-EST-1).

Everything is review_status "pending".

    python scripts/data/gen_esters_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "esters_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102"

# Fatty acids of tr. 10: (id, name, chain R in RCOOH, carbon atoms, C=C double bonds).
FATTY_ACIDS = [
    ("palmitic", "palmitic acid", "C15H31", 16, 0),
    ("stearic", "stearic acid", "C17H35", 18, 0),
    ("oleic", "oleic acid", "C17H33", 18, 1),
    ("linoleic", "linoleic acid", "C17H31", 18, 2),
]

# Hình 1.2 (tr. 10): % by mass of saturated / one C=C / several C=C chains.
FAT_COMPOSITION = [
    ("sunflower", "Dầu hướng dương", "Sunflower oil", 11, 20, 69),
    ("olive", "Dầu oliu", "Olive oil", 14, 77, 9),
    ("soybean", "Dầu đậu nành", "Soybean oil", 15, 24, 61),
    ("peanut", "Dầu lạc", "Peanut oil", 18, 48, 34),
    ("lard", "Mỡ lợn", "Lard", 41, 47, 12),
    ("tallow", "Mỡ bò", "Beef tallow", 52, 44, 4),
    ("butter", "Chất béo từ bơ động vật", "Butterfat", 66, 30, 4),
]

# tr. 7: (formula, kind, M, boiling point °C).
BOILING = [
    ("CH3CH2CH2OH", "alcohol", 60, 97),
    ("CH3COOH", "carboxylicAcid", 60, 118),
    ("HCOOCH3", "ester", 60, 32),
]

EXAMPLES = [
    {"id": "isoamyl-acetate", "lesson": 1, "page": 9, "acid": "acetic", "acid_g": 16.2,
     "alcohol": "isoamyl", "alcohol_g": 15.2, "ester_g": 14.16},
]


def main() -> None:
    for _id, _vi, _en, sat, one, many in FAT_COMPOSITION:
        assert sat + one + many == 100, _id
    for _id, _name, chain, carbons, double in FATTY_ACIDS:
        h = int(chain.split("H")[1])
        # CnH(2n+1−2k) for the chain of a fatty acid with k C=C (RCOOH has carbons − 1 in R).
        assert h == 2 * (carbons - 1) + 1 - 2 * double, _id
    out = {
        "dataset": "esters_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-hh12-c1",
            "citation": (
                "SGK Hóa học 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Chương 1 “Ester – Lipid”, Bài 1 (tr. 6–13, Hình 1.2), "
                "Bài 2 (tr. 14–17)"
            ),
            "url": READER,
        },
        "items": [
            {"id": i, "name": n, "chain": c, "carbons": k, "double_bonds": d, "review_status": "pending"}
            for i, n, c, k, d in FATTY_ACIDS
        ],
        "fat_composition": [
            {"id": i, "name": {"vi": vi, "en": en}, "saturated": a, "one_double": b, "several_double": c}
            for i, vi, en, a, b, c in FAT_COMPOSITION
        ],
        "boiling": [{"formula": f, "kind": k, "M": m, "bp_C": t} for f, k, m, t in BOILING],
        "examples": EXAMPLES,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(FATTY_ACIDS)} fatty acids, {len(FAT_COMPOSITION)} fats")


if __name__ == "__main__":
    main()
