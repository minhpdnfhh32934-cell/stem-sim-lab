"""Generate data/biomolecules.json: one 3D structure per group of "Các phân tử sinh học" (SH10 KNTT
Bài 5, #255): a monosaccharide, a fatty acid and glycerol, an amino acid and a nucleotide.

Each molecule is a PubChem compound (CID recorded): its isomeric SMILES below were copied from
PubChem's PUG REST service (`/compound/cid/<CID>/property/Title,IsomericSMILES,MolecularFormula`)
on 15/11/2026. The 3D structure is made by the same RDKit pipeline as the chemistry library
(`build` of scripts/data/gen_molecules.py: ETKDG v3 embedding, then MMFF94): one gas-phase
conformer, not a crystal or solution structure. The script checks that RDKit's formula is
PubChem's, and with `--check` it asks PubChem again and stops if a SMILES or formula changed.

Which molecule stands for which group follows SGK Sinh học 10 KNTT, Bài 5: glucose (đường đơn,
H 5.1, tr. 29), palmitic acid (the C16 saturated fatty acid drawn in H 5.4a, tr. 31) and glycerol
(H 5.4c), an amino acid (H 5.7, tr. 34; L-alanine, whose R group is CH3) and a DNA nucleotide
(H 5.10b, tr. 37; dAMP: phosphate, deoxyribose and adenine). review_status "pending"
(docs/DATA_REVIEW.md, SH10-BIOMOL-*).

    python scripts/data/gen_biomolecules.py [--check]   (needs rdkit, numpy, mendeleev)
"""
import json
import pathlib
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from gen_molecules import build  # noqa: E402  (the chemistry library's RDKit pipeline)

import numpy as np  # noqa: E402
import rdkit  # noqa: E402
from rdkit import Chem  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "biomolecules.json"
PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{}/property/Title,IsomericSMILES,MolecularFormula/JSON"

# id, group, Vietnamese name, English name, CID, PubChem title, isomeric SMILES, PubChem formula
MOLECULES = [
    ("glucose", "carbohydrate", "Glucose (β-D-glucose, dạng vòng)", "β-D-Glucose (ring form)", 64689,
     "Beta-D-Glucose", "C([C@@H]1[C@H]([C@@H]([C@H]([C@@H](O1)O)O)O)O)O", "C6H12O6"),
    ("palmitic", "lipid", "Acid palmitic: acid béo bão hoà (acid béo no)", "Palmitic acid: a saturated fatty acid", 985,
     "Palmitic Acid", "CCCCCCCCCCCCCCCC(=O)O", "C16H32O2"),
    ("glycerol", "lipid", "Glycerol", "Glycerol", 753,
     "Glycerol", "C(C(CO)O)O", "C3H8O3"),
    ("alanine", "protein", "Alanine (L-alanine)", "Alanine (L-alanine)", 5950,
     "L-Alanine", "C[C@@H](C(=O)O)N", "C3H7NO2"),
    ("damp", "nucleicAcid", "Nucleotide dAMP (deoxyadenosine monophosphate)", "Nucleotide dAMP (deoxyadenosine monophosphate)", 12599,
     "dAMP", "C1[C@@H]([C@H](O[C@H]1N2C=NC3=C(N=CN=C32)N)COP(=O)(O)O)O", "C10H14N5O6P"),
]
# Parts of a monomer as the textbook's figures name them (H 5.7: nhóm amino, nhóm carboxyl, nhóm R
# around the central carbon; H 5.10b: phosphate, đường 5 carbon, base; H 5.4: the fatty acid's
# carboxyl group and hydrocarbon chain, glycerol's three OH groups). Found with SMARTS patterns
# (never by hand); each part takes the H atoms bonded to its atoms; None = every atom left over.
# The parts of one molecule share no atom and cover all of them (checked below).
PARTS = {
    "alanine": [("amino", "[NX3;H2]"), ("carboxyl", "[CX3](=O)[OX2H1]"),
                ("alphaC", "[CX4;H1;$(C[NX3])]"), ("rGroup", None)],
    "damp": [("phosphate", "P(=O)(O)(O)O"), ("base", "[nX3]1cnc2c(N)ncnc12"), ("sugar", None)],
    "palmitic": [("carboxyl", "[CX3](=O)[OX2H1]"), ("chain", None)],
    "glycerol": [("hydroxyl", "[OX2H1]"), ("backbone", None)],
}

# Formulas as the textbook writes them (same atoms as the Hill formula; a test checks it).
DISPLAY_FORMULA = {"glucose": "C6H12O6", "palmitic": "C15H31COOH", "glycerol": "C3H5(OH)3",
                   "alanine": "CH3CH(NH2)COOH", "damp": "C10H14N5O6P"}


def check_pubchem() -> None:
    for mid, *_rest, cid, title, smiles, formula in MOLECULES:
        with urllib.request.urlopen(PUG.format(cid), timeout=30) as r:
            p = json.load(r)["PropertyTable"]["Properties"][0]
        got = (p["Title"], p.get("IsomericSMILES") or p.get("SMILES"), p["MolecularFormula"])
        assert got == (title, smiles, formula), f"{mid}: PubChem now says {got}"
    print("PubChem: titles, SMILES and formulas unchanged")


def parts_of(mid: str, smiles: str) -> list:
    """Atom indices of each named part, in build()'s atom order (SMILES order, then added H)."""
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    taken: set = set()
    out = []
    for pid, smarts in PARTS.get(mid, []):
        if smarts is None:
            atoms = set(range(mol.GetNumAtoms())) - taken
        else:
            heavy = {i for m in mol.GetSubstructMatches(Chem.MolFromSmarts(smarts)) for i in m}
            assert heavy, f"{mid}: no match for {pid}"
            atoms = heavy | {n.GetIdx() for i in heavy for n in mol.GetAtomWithIdx(i).GetNeighbors()
                             if n.GetSymbol() == "H"}
        assert not atoms & taken, f"{mid}: {pid} overlaps another part"
        taken |= atoms
        out.append({"id": pid, "atoms": sorted(atoms)})
    assert not PARTS.get(mid) or taken == set(range(mol.GetNumAtoms())), f"{mid}: parts miss atoms"
    return out


def principal_axes(atoms: list) -> None:
    """Rotates the (centred) conformer so its longest axis lies along x and its thinnest along z:
    a proper rotation (determinant +1, so no mirror image: chirality is kept), bonds unchanged."""
    xyz = np.array([a["xyz"] for a in atoms])
    _, _, vt = np.linalg.svd(xyz - xyz.mean(axis=0), full_matrices=False)
    if np.linalg.det(vt) < 0:
        vt[2] = -vt[2]
    for a, p in zip(atoms, (xyz - xyz.mean(axis=0)) @ vt.T):
        a["xyz"] = [round(float(v), 4) for v in p]


def main() -> None:
    if "--check" in sys.argv:
        check_pubchem()
    items = []
    for mid, group, vi, en, cid, title, smiles, formula in MOLECULES:
        data = build(mid, smiles)
        assert data["formula"] == formula, f"{mid}: RDKit {data['formula']} != PubChem {formula}"
        data["display_formula"] = DISPLAY_FORMULA[mid]
        principal_axes(data["atoms"])
        items.append({
            "id": mid,
            "group": group,
            "name": {"vi": vi, "en": en},
            "cid": cid,
            "pubchem_title": title,
            **data,
            "parts": parts_of(mid, smiles),
            "review_status": "pending",
        })
    out = {
        "dataset": "biomolecules",
        "version": 1,
        "source": {
            "id": "pubchem-rdkit",
            "citation": (
                "Cấu trúc hoá học: PubChem (NCBI), mỗi phân tử ghi số CID, SMILES lấy ngày 15/11/2026; "
                f"cấu trúc 3D sinh bằng RDKit {rdkit.__version__} (ETKDG v3 + MMFF94), một cấu dạng ở pha khí"
            ),
            "url": "https://pubchem.ncbi.nlm.nih.gov",
        },
        "generated_by": "scripts/data/gen_biomolecules.py",
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} molecules")


if __name__ == "__main__":
    main()
