"""Generate data/isotopes.json: the naturally occurring isotopes of every element, from `mendeleev`.

Sources, as mendeleev's data page lists them for its Isotope table
(https://mendeleev.readthedocs.io/en/stable/data.html, read on 15/11/2026):
- isotope masses and mass numbers (`mass`, `mass_number`): IUPAC-CIAAW, "Atomic masses",
  https://ciaaw.org/atomic-masses.htm (accessed by mendeleev on 25 September 2022, data file
  last updated 17 March 2021);
- natural abundances (`abundance`, in % of atoms): F.G. Kondev, M. Wang, W.J. Huang, S. Naimi,
  G. Audi, "The NUBASE2020 evaluation of nuclear physics properties", Chinese Physics C 45(3),
  030001 (2021), https://doi.org/10.1088/1674-1137/abddae.

An isotope is listed when mendeleev gives it a natural abundance above zero; an element without
one (Tc, Pm, the elements after Bi except Th, Pa, U) is left out. Values are copied as mendeleev
gives them (no rounding). mendeleev's table holds ground states only: tantalum's other natural
nuclide is the metastable 180mTa, so Ta's listed abundances add up to 99.988 %; Mg's and S's
add up to 100.001 % and 99.9938 % (rounded values). The app shows such a sum and divides by it.

Every item is written with review_status "pending": a teacher checks it before switching it to
"verified" (docs/DATA_REVIEW.md, HH10-ATOM-3).

    python scripts/data/gen_isotopes.py      (needs mendeleev, e.g. 1.3.0)
"""
import json
import pathlib

import mendeleev
from mendeleev import element

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "isotopes.json"

REFERENCES = [
    {
        "id": "ciaaw-atomic-masses",
        "citation": (
            "IUPAC-CIAAW, Atomic masses (data file last updated 17 March 2021; "
            "accessed by mendeleev on 25 September 2022): isotope masses"
        ),
        "url": "https://ciaaw.org/atomic-masses.htm",
    },
    {
        "id": "nubase2020",
        "citation": (
            "F.G. Kondev, M. Wang, W.J. Huang, S. Naimi, G. Audi, The NUBASE2020 evaluation of "
            "nuclear physics properties, Chinese Physics C 45(3), 030001 (2021): natural abundances"
        ),
        "url": "https://doi.org/10.1088/1674-1137/abddae",
    },
]


def main() -> None:
    items = []
    for z in range(1, 119):
        e = element(z)
        natural = sorted(
            (i for i in e.isotopes if i.abundance and i.abundance > 0), key=lambda i: i.mass_number
        )
        if not natural:
            continue
        items.append(
            {
                "z": z,
                "symbol": e.symbol,
                "isotopes": [
                    {"a": i.mass_number, "mass_u": i.mass, "abundance_pct": i.abundance}
                    for i in natural
                ],
                "review_status": "pending",
            }
        )
    data = {
        "dataset": "isotopes",
        "version": 1,
        "source": {
            "id": "mendeleev-isotopes",
            "citation": (
                f"mendeleev {mendeleev.__version__} (L. M. Mentel), Isotope table: masses from "
                "IUPAC-CIAAW Atomic masses (2021), natural abundances from NUBASE2020 "
                "(Kondev et al., Chinese Physics C 45, 030001, 2021)"
            ),
            "url": "https://mendeleev.readthedocs.io/en/stable/data.html",
        },
        "references": REFERENCES,
        "generated_by": "scripts/data/gen_isotopes.py",
        "items": items,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} elements, {sum(len(i['isotopes']) for i in items)} isotopes to {OUT}")


if __name__ == "__main__":
    main()
