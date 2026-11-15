"""Generate data/ions.json: the common monatomic ion of the main-group elements used by "Liên kết
ion" (Hoá học 10 KNTT Bài 11, #255).

Source: P. Flowers, K. Theopold, R. Langley, W. R. Robinson, Chemistry 2e, OpenStax (Houston,
2019), §2.6 "Ionic and Molecular Compounds", Figure 2.29 "Some elements exhibit a regular pattern
of ionic charge when they form ions" — the ions as listed in the figure's text description,
https://openstax.org/books/chemistry-2e/pages/2-6-ionic-and-molecular-compounds, read 2026-11-15.

Kept (the lesson's scope): groups 1, 2, 13 and 15–17, where the figure gives the element one
charge. Left out, with the reason written into the file: elements data/elements.json marks as
metalloids (As, Te: not a clear metal / non-metal for an ionic-bond example) and elements without
a stable isotope (Fr, Ra, At). Everything is review_status "pending" (docs/DATA_REVIEW.md,
HH10-BOND-*).

    python scripts/data/gen_ions.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "ions.json"
ELEMENTS = ROOT / "data" / "elements.json"
FIGURE = (
    "OpenStax Chemistry 2e (Flowers, Theopold, Langley, Robinson, 2019), §2.6, Hình 2.29: các ion "
    "có điện tích theo quy luật"
)

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


def main() -> None:
    elements = {e["symbol"]: e for e in json.loads(ELEMENTS.read_text(encoding="utf-8"))["items"]}
    items, excluded = [], []
    for symbol, charge in FIGURE_2_29:
        e = elements[symbol]
        assert e["group"] in (1, 2, 13, 15, 16, 17), symbol
        if e["mass_number_only"]:
            excluded.append({"element": symbol, "charge": charge,
                             "reason": "Không có đồng vị bền (elements.json: chỉ có số khối)."})
        elif e["category"] == "metalloid":
            excluded.append({"element": symbol, "charge": charge,
                             "reason": "elements.json xếp là á kim: không phải kim loại hay phi kim rõ ràng."})
        else:
            items.append({"element": symbol, "charge": charge, "review_status": "pending"})
    out = {
        "dataset": "ions",
        "version": 1,
        "accessed": "2026-11-15",
        "source": {
            "id": "openstax-chem2e-fig2-29",
            "citation": FIGURE,
            "url": "https://openstax.org/books/chemistry-2e/pages/2-6-ionic-and-molecular-compounds",
        },
        "generated_by": "scripts/data/gen_ions.py",
        "items": items,
        "excluded": excluded,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} ions ({len(excluded)} left out)")


if __name__ == "__main__":
    main()
