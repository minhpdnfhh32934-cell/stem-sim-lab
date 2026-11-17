"""Generate data/nitrogen_organic_kntt.json: the data of Hóa học 12 KNTT Chương 3 "Hợp chất chứa nitrogen"
(Bài 8 Amine, Bài 9 Amino acid và peptide) that the lessons "Amine" and "Amino acid và peptide" use
(#255 round 4b).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Hóa học 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102, read
17/11/2026:
  - Bài 8 tr. 37: Bảng 8.1, melting and boiling points of seven amines (the book cites CRC
    Handbook, 97th ed.); naming by "gốc – chức" and substitutive names (tr. 36); question 2
    (isomers of C3H9N) and question 3 (names of CH3CH2CH2NH2, CH3CH2NHCH3, (CH3)3N);
  - Bài 9 tr. 41–42: the amino acids of Hình 9.1 and Bảng 9.1 (structure, substitutive,
    semi-systematic and common names, symbol); tr. 43: glycine near pH 6 is a zwitterion and hardly
    moves in an electric field, below pH 6 it moves to the cathode, above pH 6 to the anode;
    tr. 44: the tripeptide Val-Gly-Ala (Hình 9.2), question 2 (Gly-Ala-Val), the partial
    hydrolysis of Gly-Tyr-Val-Ala; tr. 45: the biuret test (two or more peptide bonds) and
    question 3 (Val-Gly-Ala).

Molecular formulas of the amino acids follow from the structures the book prints.

Everything is review_status "pending".

    python scripts/data/gen_nitrogen_organic_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "nitrogen_organic_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102"

# Bảng 8.1 (tr. 37): (condensed formula, name, melting point °C, boiling point °C).
AMINES = [
    ("CH3NH2", "methylamine", -93.4, -6.4),
    ("CH3CH2NH2", "ethylamine", -81.0, 16.6),
    ("CH3NHCH3", "dimethylamine", -93.0, 7.3),
    ("CH3CH2CH2NH2", "propylamine", -84.8, 47.2),
    ("CH3CH(NH2)CH3", "isopropylamine", -95.1, 31.8),
    ("(CH3)3N", "trimethylamine", -117.1, 2.8),
    ("C6H5NH2", "aniline", -6.0, 184.1),
]

# Bảng 9.1 (tr. 42): (symbol, structure as printed, substitutive, semi-systematic, common,
# molecular formula from the structure, SMILES).
AMINO_ACIDS = [
    ("Gly", "H2N-CH2-COOH", "aminoethanoic acid", "aminoacetic acid", "glycine", "C2H5NO2",
     "NCC(=O)O"),
    ("Ala", "H2N-CH(CH3)-COOH", "2-aminopropanoic acid", "α-aminopropionic acid", "alanine",
     "C3H7NO2", "NC(C)C(=O)O"),
    ("Lys", "H2N-[CH2]4-CH(NH2)-COOH", "2,6-diaminohexanoic acid", "α,ε-diaminocaproic acid",
     "lysine", "C6H14N2O2", "NCCCCC(N)C(=O)O"),
    ("Glu", "HOOC-[CH2]2-CH(NH2)-COOH", "2-aminopentane-1,5-dioic acid", "α-aminoglutaric acid",
     "glutamic acid", "C5H9NO4", "OC(=O)CCC(N)C(=O)O"),
    ("Val", "(CH3)2CH-CH(NH2)-COOH", "2-amino-3-methylbutanoic acid", "α-aminoisovaleric acid",
     "valine", "C5H11NO2", "CC(C)C(N)C(=O)O"),
]

# Glycine and the electric field (tr. 43): the pH at which it is a zwitterion.
GLYCINE_NEUTRAL_PH = 6

PEPTIDES = [
    {"id": "val-gly-ala", "lesson": 9, "page": 44, "sequence": ["Val", "Gly", "Ala"]},
    {"id": "gly-ala-val", "lesson": 9, "page": 44, "sequence": ["Gly", "Ala", "Val"]},
    {"id": "gly-tyr-val-ala", "lesson": 9, "page": 44, "sequence": ["Gly", "Tyr", "Val", "Ala"]},
]


def count(formula: str) -> dict:
    import re
    out: dict = {}
    for el, n in re.findall(r"([A-Z][a-z]?)(\d*)", formula):
        out[el] = out.get(el, 0) + (int(n) if n else 1)
    return out


def main() -> None:
    for sym, struct, *_rest, formula, _smiles in AMINO_ACIDS:
        # Every α-amino acid here has at least one N and two O.
        c = count(formula)
        assert c["N"] >= 1 and c["O"] >= 2, sym
    for f, _n, mp, bp in AMINES:
        assert mp < bp, f
    out = {
        "dataset": "nitrogen_organic_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-hh12-c3",
            "citation": (
                "SGK Hóa học 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Chương 3 “Hợp chất chứa nitrogen”, "
                "Bài 8 (Bảng 8.1, tr. 35–40), Bài 9 (Bảng 9.1, tr. 41–45)"
            ),
            "url": READER,
        },
        "items": [
            {"id": sym, "structure": st, "substitutive": sub, "semi": semi, "common": com,
             "formula": f, "smiles": smi, "review_status": "pending"}
            for sym, st, sub, semi, com, f, smi in AMINO_ACIDS
        ],
        "amines": [{"formula": f, "name": n, "mp_C": mp, "bp_C": bp} for f, n, mp, bp in AMINES],
        "glycine_neutral_pH": GLYCINE_NEUTRAL_PH,
        "peptides": PEPTIDES,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(AMINES)} amines, {len(AMINO_ACIDS)} amino acids")


if __name__ == "__main__":
    main()
