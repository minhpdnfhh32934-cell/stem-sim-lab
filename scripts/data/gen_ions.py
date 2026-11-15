"""Generate data/ions.json: the common monatomic ion of the main-group elements used by "Liên kết
ion" (Hóa học 10 KNTT Bài 11, #255).

User decision 16/11/2026 ("bám sát chương trình của sách"): the textbook first.

1. Primary source: SGK Hóa học 10 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page
   images in NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983,
   read 16/11/2026. The book prints no table of ion charges by group. What it states:
   - Bài 11, printed page 51: the charge of a cation equals the number of electrons the atom gave,
     the charge of an anion the number it took, and ions usually have the electron configuration
     of the noble gas nearest to the element in the periodic table (with Bài 10, Bảng 10.1, printed
     page 49: a group A element has as many valence electrons as its group number).
   - The ions it prints (BOOK below, with page and the text as printed): Li, Na, K, Be, Mg, Ca, Al,
     O, S, F, Cl, Br.
2. Second source, for the elements the book does not print: P. Flowers, K. Theopold, R. Langley,
   W. R. Robinson, Chemistry 2e, OpenStax (Houston, 2019), §2.6 "Ionic and Molecular Compounds",
   Figure 2.29 (the ions as listed in the figure's text description),
   https://openstax.org/books/chemistry-2e/pages/2-6-ionic-and-molecular-compounds, read
   2026-11-15.

Every kept ion is checked against the book's rule (noble gas nearest to the element: a metal of
group nA gives n electrons, a non-metal of group nA takes 8 − n); the script stops if one
disagrees. None does, and every ion the book prints is also in the figure with the same charge.

Kept (the lesson's scope): groups 1, 2, 13 and 15–17. Left out, with the reason written into the
file: elements data/elements.json marks as metalloids (As, Te) and elements without a stable
isotope (Fr, Ra, At). Everything is review_status "pending" (docs/DATA_REVIEW.md, HH10-BOND-*).

    python scripts/data/gen_ions.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "ions.json"
ELEMENTS = ROOT / "data" / "elements.json"
SGK_READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983"
FIGURE = (
    "OpenStax Chemistry 2e (Flowers, Theopold, Langley, Robinson, 2019), §2.6, Hình 2.29: các ion "
    "có điện tích theo quy luật"
)

# Ions the textbook prints: symbol -> (charge, "Bài N tr. P: text as printed").
BOOK = {
    "Na": (1, "Bài 11 tr. 51: Na → Na⁺ + 1e"),
    "Mg": (2, "Bài 11 tr. 51: Mg → Mg²⁺ + 2e"),
    "Al": (3, "Bài 11 tr. 51: Al → Al³⁺ + 3e"),
    "Cl": (-1, "Bài 11 tr. 51: Cl + 1e → Cl⁻"),
    "F": (-1, "Bài 11 tr. 51: F + 1e → F⁻"),
    "S": (-2, "Bài 11 tr. 51: S + 2e → S²⁻"),
    "Li": (1, "Bài 11 tr. 52, câu hỏi 1a: Li → Li⁺ + ?"),
    "Be": (2, "Bài 11 tr. 52, câu hỏi 1b: Be → ? + 2e"),
    "Br": (-1, "Bài 11 tr. 52, câu hỏi 1c: Br + ? → Br⁻"),
    "O": (-2, "Bài 11 tr. 52, câu hỏi 1d và 3: O + 2e → ?; ion O²⁻"),
    "K": (1, "Bài 11 tr. 52, câu hỏi 2: ion K⁺"),
    "Ca": (2, "Bài 11 tr. 52: Ca²⁺ (sự tạo thành CaCl₂)"),
}

# Figure 2.29, groups 1, 2, 13, 15, 16, 17 as listed (symbol, charge). The figure's other groups
# (transition metals, C⁴⁻ in group 14) are outside the lesson's examples.
FIGURE_2_29 = [
    ("Li", 1), ("Na", 1), ("K", 1), ("Rb", 1), ("Cs", 1), ("Fr", 1),
    ("Be", 2), ("Mg", 2), ("Ca", 2), ("Sr", 2), ("Ba", 2), ("Ra", 2),
    ("Al", 3),
    ("N", -3), ("P", -3), ("As", -3),
    ("O", -2), ("S", -2), ("Se", -2), ("Te", -2),
    ("F", -1), ("Cl", -1), ("Br", -1), ("I", -1), ("At", -1),
]


def book_rule(group: int) -> int:
    """Charge by the book's rule: a metal gives its valence electrons, a non-metal takes enough to
    reach 8 (nearest noble gas); valence electrons = number of group A (groups 1, 2, 13–17)."""
    valence = group if group <= 2 else group - 10
    return valence if valence <= 3 else valence - 8


def main() -> None:
    elements = {e["symbol"]: e for e in json.loads(ELEMENTS.read_text(encoding="utf-8"))["items"]}
    figure = dict(FIGURE_2_29)
    for symbol, (charge, _) in BOOK.items():
        assert figure.get(symbol) == charge, f"book and figure differ for {symbol}"
    items, excluded = [], []
    for symbol, charge in FIGURE_2_29:
        e = elements[symbol]
        assert e["group"] in (1, 2, 13, 15, 16, 17), symbol
        assert charge == book_rule(e["group"]), f"{symbol}{charge}: against the book's rule"
        if e["mass_number_only"]:
            excluded.append({"element": symbol, "charge": charge,
                             "reason": "Không có đồng vị bền (elements.json: chỉ có số khối)."})
        elif e["category"] == "metalloid":
            excluded.append({"element": symbol, "charge": charge,
                             "reason": "elements.json xếp là á kim: không phải kim loại hay phi kim rõ ràng."})
        elif symbol in BOOK:
            items.append({"element": symbol, "charge": charge, "source": "sgk",
                          "book": BOOK[symbol][1], "review_status": "pending"})
        else:
            items.append({"element": symbol, "charge": charge, "source": "openstax",
                          "review_status": "pending"})
    assert {i["element"] for i in items if i["source"] == "sgk"} == set(BOOK)
    out = {
        "dataset": "ions",
        "version": 2,
        "accessed": "2026-11-16",
        "source": {
            "id": "sgk-hh10-b11-ions",
            "citation": (
                "SGK Hóa học 10 Kết nối tri thức, NXB Giáo dục Việt Nam: Bài 11 tr. 51 (số điện tích "
                "của ion bằng số electron nhường hoặc nhận; ion thường có cấu hình electron của khí "
                "hiếm gần nhất), các ion sách in ở tr. 51–52; Bài 10 Bảng 10.1 tr. 49 (số electron hóa "
                "trị theo nhóm A)"
            ),
            "url": SGK_READER,
        },
        "second_source": {
            "id": "openstax-chem2e-fig2-29",
            "citation": FIGURE,
            "url": "https://openstax.org/books/chemistry-2e/pages/2-6-ionic-and-molecular-compounds",
        },
        "generated_by": "scripts/data/gen_ions.py",
        "items": items,
        "excluded": excluded,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    book = sum(1 for i in items if i["source"] == "sgk")
    print(f"wrote {len(items)} ions ({book} printed in the book, {len(excluded)} left out)")


if __name__ == "__main__":
    main()
