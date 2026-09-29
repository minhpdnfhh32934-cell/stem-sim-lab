"""Generate data/genetic_code.json: the standard genetic code (NCBI translation table 1).

Source: NCBI Genetic Codes, table 1 ("Standard"), as distributed in Biopython
(Bio.Data.CodonTable). Amino-acid names/abbreviations: IUPAC-IUB three- and one-letter codes.
review_status "pending" until a teacher checks it.

    python scripts/data/gen_genetic_code.py
"""
import json
import pathlib

import Bio
from Bio.Data import CodonTable
from Bio.Data.IUPACData import protein_letters_1to3

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "genetic_code.json"

NAMES = {
    "A": "Alanine", "R": "Arginine", "N": "Asparagine", "D": "Aspartic acid", "C": "Cysteine",
    "Q": "Glutamine", "E": "Glutamic acid", "G": "Glycine", "H": "Histidine", "I": "Isoleucine",
    "L": "Leucine", "K": "Lysine", "M": "Methionine", "F": "Phenylalanine", "P": "Proline",
    "S": "Serine", "T": "Threonine", "W": "Tryptophan", "Y": "Tyrosine", "V": "Valine",
}


def main() -> None:
    table = CodonTable.unambiguous_rna_by_id[1]
    items = []
    for b1 in "UCAG":
        for b2 in "UCAG":
            for b3 in "UCAG":
                codon = b1 + b2 + b3
                if codon in table.stop_codons:
                    items.append({"codon": codon, "aa": "*", "three": "Stop", "name": "Stop", "start": False, "stop": True, "review_status": "pending"})
                else:
                    aa = table.forward_table[codon]
                    items.append({
                        "codon": codon,
                        "aa": aa,
                        "three": protein_letters_1to3[aa],
                        "name": NAMES[aa],
                        "start": codon in table.start_codons and codon == "AUG",
                        "stop": False,
                        "review_status": "pending",
                    })
    out = {
        "dataset": "genetic_code",
        "version": 1,
        "source": {
            "id": "ncbi-table-1",
            "citation": f"NCBI Genetic Codes — Translation table 1 (Standard), via Biopython {Bio.__version__}",
            "url": "https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi",
        },
        "generated_by": "scripts/data/gen_genetic_code.py",
        # Only AUG is used as the start codon in textbook problems (NCBI table 1 also lists
        # the rare alternative starts UUG and CUG).
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} codons; stops = {sorted(table.stop_codons)}; starts = {table.start_codons}")


if __name__ == "__main__":
    main()
