"""Generate data/halogens.json: what SGK Hóa học 10 "Kết nối tri thức với cuộc sống" (NXB Giáo dục
Việt Nam) gives about F, Cl, Br, I and their hydrogen halides, copied as printed (user decision
15/11/2026: the book's values first; other sources only fill what the book does not give).

- Bài 6, Hình 6.2 (tr. 35, the book cites Silberberg, Principles of General Chemistry, 2007):
  atomic radius, pm;
- Bài 6, Bảng 6.2 (tr. 37): Pauling electronegativity;
- Bài 21, Bảng 21.2 (tr. 107, the book cites chem.libretexts.org): state and colour of the element,
  melting point t_nc and boiling point t_s (°C), solubility in water at 25 °C (mol/L; "–" for F2);
- Bài 22, Bảng 22.1 (tr. 112): H–X bond length (pm) and bond energy (kJ/mol);
- Bài 22, Bảng 22.2 (tr. 113): boiling point of HX (°C).

The book gives no first ionisation energies for these elements (Hình 6.3 stops at Z = 20): the app
takes them from data/elements.json (NIST ASD via mendeleev). Read in NXBGD's training reader on
ACCESSED. review_status "pending" until a teacher checks it (docs/DATA_REVIEW.md HH10-RX-6, -7).

    python scripts/data/gen_halogens.py
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "halogens.json"
ACCESSED = "2026-11-15"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983"
BOOK = "SGK Hóa học 10, Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam)"

SOURCES = {
    "radius": {"id": "sgk-hh10-hinh-6-2", "citation": f"{BOOK}, Bài 6, Hình 6.2 (tr. 35); sách dẫn nguồn M. S. Silberberg, Principles of General Chemistry, McGraw-Hill 2007", "url": READER},
    "en": {"id": "sgk-hh10-bang-6-2", "citation": f"{BOOK}, Bài 6, Bảng 6.2 (tr. 37): độ âm điện theo L. C. Pauling", "url": READER},
    "physical": {"id": "sgk-hh10-bang-21-2", "citation": f"{BOOK}, Bài 21, Bảng 21.2 (tr. 107); sách dẫn nguồn chem.libretexts.org", "url": READER},
    "bond": {"id": "sgk-hh10-bang-22-1", "citation": f"{BOOK}, Bài 22, Bảng 22.1 (tr. 112)", "url": READER},
    "hxBoiling": {"id": "sgk-hh10-bang-22-2", "citation": f"{BOOK}, Bài 22, Bảng 22.2 (tr. 113)", "url": READER},
}

# z, symbol, radius pm (Hình 6.2), EN (Bảng 6.2), state, colour {vi, en} (Bảng 21.2; English is a
# translation of the book's words), t_nc °C, t_s °C, solubility mol/L or None,
# HX: bond length pm, bond energy kJ/mol (Bảng 22.1), t_s of HX °C (Bảng 22.2)
ROWS = [
    (9, "F", 72, 3.98, "gas", {"vi": "Lục nhạt", "en": "Pale green"}, -219.6, -188.1, None, 92, 569, 19.5),
    (17, "Cl", 100, 3.16, "gas", {"vi": "Vàng lục", "en": "Yellow-green"}, -101.0, -34.1, 0.091, 127, 432, -84.9),
    (35, "Br", 114, 2.96, "liquid", {"vi": "Nâu đỏ", "en": "Red-brown"}, -7.3, 59.2, 0.21, 141, 366, -66.7),
    (53, "I", 133, 2.66, "solid", {"vi": "Tím đen", "en": "Violet-black"}, 113.6, 185.5, 0.0013, 160, 299, -35.8),
]


def main() -> None:
    items = []
    for z, sym, radius, en, state, colour, mp, bp, sol, length, energy, hx_bp in ROWS:
        items.append({
            "z": z, "symbol": sym, "radius_pm": radius, "en_pauling": en, "state": state,
            "colour": colour, "melting_c": mp, "boiling_c": bp, "solubility_mol_l": sol,
            "hx": {"formula": f"H{sym}", "bond_length_pm": length, "bond_energy_kj_mol": energy,
                   "boiling_c": hx_bp},
            "review_status": "pending",
        })
    out = {
        "dataset": "halogens",
        "version": 1,
        "source": {"id": "sgk-hh10-kntt", "citation": f"{BOOK}: Bài 6, 21, 22 (đọc ngày {ACCESSED})", "url": READER},
        "generated_by": "scripts/data/gen_halogens.py",
        "accessed": ACCESSED,
        "sources": SOURCES,
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(items)} halogens to {OUT}")


if __name__ == "__main__":
    main()
