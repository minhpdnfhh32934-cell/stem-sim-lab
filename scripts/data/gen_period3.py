"""Generate data/period3_compounds.json: the highest oxides and hydroxides of the period 3
elements Na…Cl and their acid–base character (HH10 Bài 7 "Xu hướng biến đổi thành phần và một số
tính chất của hợp chất trong một chu kì").

Sources, read on ACCESSED:
- SGK Hóa học 10 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), Bảng 7.1 (printed
  page 40: formulas of the oxides and hydroxides for the highest valence) and Bảng 7.2 (printed
  page 41: acid–base character), NXBGD training reader, page images 41–42;
- cross-check of the oxides' character: J. Clark, "Acid-base Behavior of the Oxides", Chemistry
  LibreTexts (CC BY-NC 4.0): Na₂O strongly basic, MgO basic, Al₂O₃ amphoteric, SiO₂ very weakly
  acidic, P₄O₁₀, SO₃, Cl₂O₇ acidic (H₃PO₄ weak acid, pKa 2,15; H₂SO₄ strong; HClO₄ very strong).

The app computes the oxide formulas and the metal hydroxides from the group number (highest
oxidation number); the textbook's formulas are kept here so a test can compare them. Only the
acids' formulas (how many H and O) are taken from the table, and the app checks them with the
oxidation-number rules. Characters are copied as the textbook words them (enum values below).

    python scripts/data/gen_period3.py

review_status "pending" until a teacher checks it (docs/DATA_REVIEW.md HH10-RX-1).
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "period3_compounds.json"
ACCESSED = "2026-11-15"

SGK = {
    "id": "sgk-hh10-kntt-b7",
    "citation": "SGK Hóa học 10, Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài 7: Bảng 7.1 (tr. 40) và Bảng 7.2 (tr. 41)",
    "url": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983",
}
LIBRETEXTS = {
    "id": "libretexts-period3-oxides",
    "citation": "J. Clark, \"Acid-base Behavior of the Oxides\", Chemistry LibreTexts, Inorganic Chemistry › Period 3 Elements (CC BY-NC 4.0)",
    "url": "https://chem.libretexts.org/Bookshelves/Inorganic_Chemistry/Supplemental_Modules_and_Websites_(Inorganic_Chemistry)/Descriptive_Chemistry/Elements_Organized_by_Period/Period_3_Elements/Acid-base_Behavior_of_the_Oxides",
}

OXIDE_CHARACTERS = {"basic", "amphoteric", "acidic"}
HYDROXIDE_CHARACTERS = {"strongBase", "weakBase", "amphoteric", "weakAcid", "mediumAcid", "strongAcid", "veryStrongAcid"}

# z, symbol, oxide (Bảng 7.1), hydroxide (Bảng 7.1), oxide character, hydroxide character (Bảng 7.2)
ROWS = [
    (11, "Na", "Na2O", "NaOH", "basic", "strongBase"),
    (12, "Mg", "MgO", "Mg(OH)2", "basic", "weakBase"),
    (13, "Al", "Al2O3", "Al(OH)3", "amphoteric", "amphoteric"),
    (14, "Si", "SiO2", "H2SiO3", "acidic", "weakAcid"),
    (15, "P", "P2O5", "H3PO4", "acidic", "mediumAcid"),
    (16, "S", "SO3", "H2SO4", "acidic", "strongAcid"),
    (17, "Cl", "Cl2O7", "HClO4", "acidic", "veryStrongAcid"),
]


def main() -> None:
    items = []
    for z, symbol, oxide, hydroxide, ox_char, hy_char in ROWS:
        assert ox_char in OXIDE_CHARACTERS and hy_char in HYDROXIDE_CHARACTERS, symbol
        items.append({
            "z": z, "symbol": symbol, "oxide_textbook": oxide, "hydroxide_textbook": hydroxide,
            "oxide_character": ox_char, "hydroxide_character": hy_char, "review_status": "pending",
        })
    out = {
        "dataset": "period3_compounds",
        "version": 1,
        "source": SGK,
        "cross_check": LIBRETEXTS,
        "accessed": ACCESSED,
        "generated_by": "scripts/data/gen_period3.py",
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(items)} elements to {OUT}")


if __name__ == "__main__":
    main()
