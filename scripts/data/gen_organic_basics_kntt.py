"""Generate data/organic_basics_kntt.json: the tables of Hóa học 11 KNTT Chương 3 "Đại cương về hóa
học hữu cơ" that the lessons use (#255 round 2e).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Hóa học 11 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834, read
17/11/2026:
  - Bài 10 "Hợp chất hữu cơ và hoá học hữu cơ" (tr. 57–62): the hydrocarbon and derivative examples
    (tr. 59), Bảng 10.1 functional groups with examples (tr. 60), Bảng 10.2 characteristic IR
    wavenumbers (tr. 61; the book cites orgchemboulder.com/Spectroscopy);
  - Bài 12 "Công thức phân tử hợp chất hữu cơ" (tr. 70–73): the atomic masses used to set up
    x : y : z (C 12,0, H 1,0, O 16,0, tr. 72), the ethanol mass spectrum's molecular ion m/z = 46
    (Hình 12.1, tr. 71), the camphor activity (78,94 % C, 10,53 % H, 10,53 % O, [M⁺] = 152, tr. 73)
    and question 3 (eugenol: 73,17 % C, 7,31 % H, the rest O, M = 164, tr. 73);
  - Bài 13 "Cấu tạo hoá học hợp chất hữu cơ" (tr. 74–79): the boiling points of the table on tr. 75
    (the book cites pubchem.ncbi.nlm.nih.gov) and the isomer examples of tr. 76–77.

Everything is review_status "pending" (docs/DATA_REVIEW.md, HH11-ORG-1).

    python scripts/data/gen_organic_basics_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "organic_basics_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834"

# Bảng 10.1 (tr. 60): (id, Vietnamese class, English class, group as printed, example formula)
GROUPS = [
    ("halide", "Dẫn xuất halogen", "Halogen derivative", "–X (F, Cl, Br, I)", "CH3Cl"),
    ("alcohol", "Alcohol", "Alcohol", "–OH", "CH3OH"),
    ("aldehyde", "Aldehyde", "Aldehyde", "–CHO", "CH3CHO"),
    ("ketone", "Ketone", "Ketone", ">C=O", "CH3COCH3"),
    ("carboxylic", "Carboxylic acid", "Carboxylic acid", "–COOH", "CH3COOH"),
    ("ester", "Ester", "Ester", "–COO–", "CH3COOCH3"),
    ("amine", "Amine", "Amine", "–NH2", "CH3NH2"),
    ("ether", "Ether", "Ether", "–O–", "CH3OCH3"),
]

# Bảng 10.2 (tr. 61): (group id, bond as printed, low, high) in cm⁻¹.
IR = [
    ("alcohol", "O–H", 3200, 3500),
    ("amine", "N–H", 3000, 3300),
    ("aldehyde", "C–H", 2695, 2830),
    ("aldehyde", "C=O", 1685, 1740),
    ("ketone", "C=O", 1666, 1715),
    ("carboxylic", "O–H", 2500, 3300),
    ("carboxylic", "C=O", 1690, 1760),
    ("ester", "C=O", 1715, 1750),
]

# Tr. 72: the atomic masses the book uses to set up x : y : z.
ATOMIC_MASS = {"C": 12.0, "H": 1.0, "O": 16.0}

# Worked data (tr. 71, 73): (id, Vietnamese name, English name, mass % {el: value or None = rest}, M)
PROBLEMS = [
    ("camphor", "Camphor", "Camphor", {"C": 78.94, "H": 10.53, "O": 10.53}, 152, "tr. 73, Hoạt động"),
    ("eugenol", "Eugenol", "Eugenol", {"C": 73.17, "H": 7.31, "O": None}, 164, "tr. 73, câu hỏi 3"),
]

# Tr. 75 table: (formula as printed, boiling point °C, Vietnamese note, English note)
BOILING = [
    ("CH4", -161.5, "Khác loại nguyên tử", "Different kinds of atoms"),
    ("CH3OH", 64.7, "Khác loại nguyên tử", "Different kinds of atoms"),
    ("C3H8", -42.1, "Khác số lượng nguyên tử", "Different numbers of atoms"),
    ("C20H42", 343, "Khác số lượng nguyên tử", "Different numbers of atoms"),
    ("CH3-CH=CH2", -47.8, "Cùng công thức phân tử, khác cấu tạo", "Same molecular formula, different structure"),
    ("cyclopropane", -32.8, "Cùng công thức phân tử, khác cấu tạo", "Same molecular formula, different structure"),
    ("phenol", 181.7, "Ảnh hưởng qua lại của các nhóm nguyên tử", "Groups of atoms affect each other"),
    ("cyclohexanol", 161.8, "Ảnh hưởng qua lại của các nhóm nguyên tử", "Groups of atoms affect each other"),
]

# Isomer examples (tr. 76–77): (molecular formula, [(name, SMILES)], kind) — structures as drawn in the book.
ISOMERS = [
    ("C3H6O", [("propanal", "CCC=O"), ("acetone", "CC(C)=O"), ("allyl alcohol", "C=CCO"), ("methyl vinyl ether", "C=COC")], "tr. 76"),
    ("C5H12", [("pentane", "CCCCC"), ("2-methylbutane", "CCC(C)C")], "tr. 77, đồng phân mạch carbon"),
    ("C3H8O", [("propan-1-ol", "CCCO"), ("ethyl methyl ether", "CCOC"), ("propan-2-ol", "CC(C)O")], "tr. 77, đồng phân loại và vị trí nhóm chức"),
]


def main() -> None:
    assert len({g[0] for g in GROUPS}) == len(GROUPS)
    for gid, *_ in IR:
        assert any(g[0] == gid for g in GROUPS), gid
    for *_, lo, hi in IR:
        assert lo < hi
    out = {
        "dataset": "organic_basics_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-hh11-c3",
            "citation": (
                "SGK Hóa học 11 Kết nối tri thức, NXB Giáo dục Việt Nam: Chương 3 “Đại cương về hóa học "
                "hữu cơ”, Bài 10 (Bảng 10.1, 10.2, tr. 59–61), Bài 12 (tr. 70–73), Bài 13 (tr. 75–77)"
            ),
            "url": READER,
        },
        "items": [
            {
                "id": gid,
                "name": {"vi": vi, "en": en},
                "group": grp,
                "example": ex,
                "ir": [{"bond": b, "low": lo, "high": hi} for g2, b, lo, hi in IR if g2 == gid],
                "book": "Bảng 10.1, tr. 60; Bảng 10.2, tr. 61",
                "review_status": "pending",
            }
            for gid, vi, en, grp, ex in GROUPS
        ],
        "atomic_mass": {"values": ATOMIC_MASS, "book": "tr. 72"},
        "problems": [
            {"id": i, "name": {"vi": vi, "en": en}, "percent": pct, "M": m, "book": where}
            for i, vi, en, pct, m, where in PROBLEMS
        ],
        "ethanol_ms": {"molecular_ion": 46, "book": "Hình 12.1, tr. 71"},
        "boiling": [
            {"formula": f, "bp_C": bp, "note": {"vi": vi, "en": en}, "book": "tr. 75"}
            for f, bp, vi, en in BOILING
        ],
        "isomers": [
            {"formula": f, "structures": [{"name": n, "smiles": s} for n, s in st], "book": where}
            for f, st, where in ISOMERS
        ],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(GROUPS)} groups, {len(IR)} IR bands, {len(PROBLEMS)} problems")


if __name__ == "__main__":
    main()
