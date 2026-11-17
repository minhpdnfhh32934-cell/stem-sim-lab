"""Generate data/heredity_kntt.json: the numbers of Sinh học 12 KNTT Bài 11 "Liên kết gene và hoán vị
gene" and Bài 12 "Đột biến nhiễm sắc thể" that the lessons use (#255 round 5b).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Sinh học 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader, read 17/11/2026:
  - Bài 11 tr. 56 (Hình 11.2): the F1 female testcross gives 41,5 % : 41,5 % : 8,5 % : 8,5 %;
    tr. 57 (Hình 11.3): 34 % of the cells cross over; tr. 59, question 2: 721 grey-body red-eye,
    751 black-body purple-eye, 49 grey-body purple-eye, 45 black-body red-eye flies;
  - Bài 12 tr. 60–61 (Hình 12.1): the gene orders of a deletion, a duplication, an inversion and a
    translocation; tr. 63 (Hình 12.3c): species A with 2n = 4, species B with 2n = 6, the hybrid
    nA + nB = 5 and the allopolyploid 2nA + 2nB = 10; tr. 65: humans have 46 chromosomes,
    chimpanzees 48; tr. 67 ("Em có biết", from Penrose and Smith 1966 via Griffiths et al. 2015):
    the rate of Down syndrome per birth by the mother's age, read from the chart's seven points,
    one per five-year band.

Everything is review_status "pending".

    python scripts/data/gen_heredity_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "heredity_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-12.4701665546"

CELLS_WITH_CROSSOVER = 0.34
TESTCROSS_PERCENT = [41.5, 41.5, 8.5, 8.5]
QUESTION_COUNTS = [
    ("grey_red", "thân xám, mắt đỏ", "grey body, red eyes", 721),
    ("black_purple", "thân đen, mắt tím", "black body, purple eyes", 751),
    ("grey_purple", "thân xám, mắt tím", "grey body, purple eyes", 49),
    ("black_red", "thân đen, mắt đỏ", "black body, red eyes", 45),
]

# Hình 12.1, the letters as drawn.
STRUCTURE = {
    "original": ["abcdefg"],
    "deletion": ["abcg"],
    "duplication": ["abcdefdefg"],
    "inversion": ["abcfedg"],
    "translocation": ["123defg", "abc456"],
}
ALLOPOLYPLOID = {"a_2n": 4, "b_2n": 6}
HUMAN_2N = 46
CHIMP_2N = 48
# tr. 67: (age band from, to (None = open), births per case).
DOWN_BY_AGE = [
    (None, 20, 2300), (20, 25, 1600), (25, 30, 1200), (30, 35, 880),
    (35, 40, 290), (40, 45, 100), (45, None, 46),
]


def main() -> None:
    # Hình 11.3 gives back Hình 11.2: 34 % of cells → 17 % recombinants, 8,5 % each.
    f = CELLS_WITH_CROSSOVER / 2
    assert [round(100 * x, 6) for x in ((1 - f) / 2, (1 - f) / 2, f / 2, f / 2)] == TESTCROSS_PERCENT
    # Hình 12.3c: nA + nB = 5, 2nA + 2nB = 10.
    a, b = ALLOPOLYPLOID["a_2n"], ALLOPOLYPLOID["b_2n"]
    assert a // 2 + b // 2 == 5 and a + b == 10
    # The rate rises with the mother's age.
    rates = [1 / n for *_band, n in DOWN_BY_AGE]
    assert rates == sorted(rates)
    out = {
        "dataset": "heredity_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-sh12-b11-12",
            "citation": (
                "SGK Sinh học 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Bài 11 “Liên kết gene và hoán vị "
                "gene” (Hình 11.2, 11.3, câu 2 tr. 59), Bài 12 “Đột biến nhiễm sắc thể” (Hình 12.1, 12.3, tr. 65, "
                "Em có biết tr. 67 dẫn Penrose và Smith 1966 qua Griffiths 2015)"
            ),
            "url": READER,
        },
        "items": [
            {"id": i, "label": {"vi": vi, "en": en}, "count": n, "review_status": "pending"}
            for i, vi, en, n in QUESTION_COUNTS
        ],
        "cells_with_crossover": CELLS_WITH_CROSSOVER,
        "testcross_percent": TESTCROSS_PERCENT,
        "structure": STRUCTURE,
        "allopolyploid": ALLOPOLYPLOID,
        "human_2n": HUMAN_2N,
        "chimp_2n": CHIMP_2N,
        "down_by_age": [{"from": lo, "to": hi, "births_per_case": n} for lo, hi, n in DOWN_BY_AGE],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
