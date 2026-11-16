"""Generate data/polyatomic_ions.json: the charges of the common polyatomic ions that the redox
lesson needs to read salts such as CuSO4, AgNO3, Cu(NO3)2 and NH4Cl (Hóa học 10 KNTT Bài 15,
#255; user decision 16/11/2026: "có" to the polyatomic ion table).

User decision 15/11/2026 ("bám sát chương trình của sách"): the textbook first.

1. Primary source: SGK Hóa học 10 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page
   images in NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983,
   read 16/11/2026. Bài 15, printed page 72, Quy tắc 4: in a polyatomic ion the oxidation numbers
   add up to the ion's charge, with the worked example [NH4]+ (N −3, H +1). The book prints no
   table of polyatomic ions.
2. Second source, for the ions the book does not print: P. Flowers, K. Theopold, R. Langley,
   W. R. Robinson, Chemistry 2e, OpenStax (Houston, 2019), §2.6 "Molecular and Ionic Compounds",
   Table 2.5 "Common Polyatomic Ions",
   https://openstax.org/books/chemistry-2e/pages/2-6-ionic-and-molecular-compounds, read
   2026-11-16.

Kept: the ions the library's salts contain (sulfate, nitrate, ammonium) and the two other
oxoanions of grade-10 chemistry (carbonate, phosphate). Everything is review_status "pending"
(docs/DATA_REVIEW.md, HH10-RX-9).

    python scripts/data/gen_polyatomic_ions.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "polyatomic_ions.json"
SGK_READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983"
OPENSTAX = "https://openstax.org/books/chemistry-2e/pages/2-6-ionic-and-molecular-compounds"

# Table 2.5 rows as listed (name, formula body, charge), only the kept ions.
TABLE_2_5 = [
    ("ammonium", "NH4", 1),
    ("carbonate", "CO3", -2),
    ("nitrate", "NO3", -1),
    ("sulfate", "SO4", -2),
    ("phosphate", "PO4", -3),
]

# Ions the textbook prints: formula body -> (charge, "Bài N tr. P: text").
BOOK = {"NH4": (1, "Bài 15 tr. 72, Quy tắc 4: ví dụ [NH₄]⁺, tổng số oxi hóa (−3) + (+1)·4 = +1")}


def main() -> None:
    table = {body: charge for _, body, charge in TABLE_2_5}
    for body, (charge, _) in BOOK.items():
        assert table.get(body) == charge, f"book and table differ for {body}"
    items = []
    for name, body, charge in TABLE_2_5:
        sign = "+" if charge > 0 else "-"
        item = {
            "id": name,
            "formula": f"{body}^{abs(charge) if abs(charge) > 1 else ''}{sign}",
            "body": body,
            "charge": charge,
            "source": "sgk" if body in BOOK else "openstax",
        }
        if body in BOOK:
            item["book"] = BOOK[body][1]
        item["review_status"] = "pending"
        items.append(item)
    out = {
        "dataset": "polyatomic_ions",
        "version": 1,
        "accessed": "2026-11-16",
        "source": {
            "id": "sgk-hh10-b15-rule4",
            "citation": (
                "SGK Hóa học 10 Kết nối tri thức, NXB Giáo dục Việt Nam: Bài 15 tr. 72, Quy tắc 4 "
                "(trong ion đa nguyên tử, tổng số oxi hóa của các nguyên tử bằng điện tích ion; "
                "ví dụ NH₄⁺)"
            ),
            "url": SGK_READER,
        },
        "second_source": {
            "id": "openstax-chem2e-table2-5",
            "citation": (
                "OpenStax Chemistry 2e (Flowers, Theopold, Langley, Robinson, 2019), §2.6, "
                "Bảng 2.5 Common Polyatomic Ions"
            ),
            "url": OPENSTAX,
        },
        "generated_by": "scripts/data/gen_polyatomic_ions.py",
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} polyatomic ions ({len(BOOK)} printed in the book)")


if __name__ == "__main__":
    main()
