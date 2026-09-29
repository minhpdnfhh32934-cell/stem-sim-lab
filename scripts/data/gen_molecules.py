"""Generate data/molecules.json: 3D structures for the molecule library.

PubChem is not reachable from the build environment, so conformers are generated locally
with RDKit (ETKDG v3 embedding, then MMFF94 optimisation; UFF when MMFF has no parameters).
Hypervalent species whose lone pairs a force field cannot represent (SF4, ClF3, XeF4...)
get an *ideal VSEPR geometry* with bond lengths = sum of Cordero covalent radii. The method
is recorded per molecule and shown in the app. Everything is review_status "pending".

Reference experimental geometries (for the automated accuracy test) are listed in
REFERENCE below with their source; they are also pending teacher review.

    python scripts/data/gen_molecules.py
"""
import json
import math
import pathlib

import numpy as np
import rdkit
from mendeleev import element
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "molecules.json"

# id, Vietnamese name, English name, SMILES, category, extra search aliases
MOLECULES = [
    ("h2", "Hydrogen (khí hiđro)", "Hydrogen", "[H][H]", "inorganic", []),
    ("n2", "Nitrogen (khí nitơ)", "Nitrogen", "N#N", "inorganic", []),
    ("o2", "Oxygen (khí oxi)", "Oxygen", "O=O", "inorganic", []),
    ("f2", "Fluorine (khí flo)", "Fluorine", "FF", "inorganic", []),
    ("cl2", "Chlorine (khí clo)", "Chlorine", "ClCl", "inorganic", []),
    ("hf", "Hydrogen fluoride", "Hydrogen fluoride", "F", "inorganic", ["axit flohiđric"]),
    ("hcl", "Hydrogen chloride", "Hydrogen chloride", "Cl", "inorganic", ["hiđro clorua", "axit clohiđric"]),
    ("hbr", "Hydrogen bromide", "Hydrogen bromide", "Br", "inorganic", []),
    ("h2o", "Nước", "Water", "O", "inorganic", ["water"]),
    ("h2s", "Hydrogen sulfide", "Hydrogen sulfide", "S", "inorganic", ["hiđro sunfua"]),
    ("h2o2", "Hydrogen peroxide", "Hydrogen peroxide", "OO", "inorganic", ["nước oxi già"]),
    ("nh3", "Ammonia", "Ammonia", "N", "inorganic", ["amoniac"]),
    ("ph3", "Phosphine", "Phosphine", "P", "inorganic", ["photphin"]),
    ("ch4", "Methane", "Methane", "C", "organic", ["metan"]),
    ("co", "Carbon monoxide", "Carbon monoxide", "[C-]#[O+]", "inorganic", ["cacbon monoxit"]),
    ("co2", "Carbon dioxide", "Carbon dioxide", "O=C=O", "inorganic", ["cacbon đioxit", "khí cacbonic"]),
    ("so2", "Sulfur dioxide", "Sulfur dioxide", "O=S=O", "inorganic", ["lưu huỳnh đioxit"]),
    ("so3", "Sulfur trioxide", "Sulfur trioxide", "O=S(=O)=O", "inorganic", ["lưu huỳnh trioxit"]),
    ("o3", "Ozone", "Ozone", "[O-][O+]=O", "inorganic", ["ozon"]),
    ("hcn", "Hydrogen cyanide", "Hydrogen cyanide", "C#N", "inorganic", ["axit xianhiđric"]),
    ("bf3", "Boron trifluoride", "Boron trifluoride", "FB(F)F", "inorganic", []),
    ("becl2", "Beryllium chloride (phân tử khí)", "Beryllium chloride (gas-phase molecule)", "Cl[Be]Cl", "inorganic", []),
    ("pcl3", "Phosphorus trichloride", "Phosphorus trichloride", "ClP(Cl)Cl", "inorganic", []),
    ("pcl5", "Phosphorus pentachloride (phân tử khí)", "Phosphorus pentachloride (gas phase)", "ClP(Cl)(Cl)(Cl)Cl", "inorganic", []),
    ("sf4", "Sulfur tetrafluoride", "Sulfur tetrafluoride", "FS(F)(F)F", "inorganic", []),
    ("sf6", "Sulfur hexafluoride", "Sulfur hexafluoride", "FS(F)(F)(F)(F)F", "inorganic", []),
    ("clf3", "Chlorine trifluoride", "Chlorine trifluoride", "FCl(F)F", "inorganic", []),
    ("xef4", "Xenon tetrafluoride", "Xenon tetrafluoride", "F[Xe](F)(F)F", "inorganic", []),
    ("xef2", "Xenon difluoride", "Xenon difluoride", "F[Xe]F", "inorganic", []),
    ("ccl4", "Carbon tetrachloride", "Carbon tetrachloride", "ClC(Cl)(Cl)Cl", "organic", ["cacbon tetraclorua"]),
    ("chcl3", "Chloroform", "Chloroform", "ClC(Cl)Cl", "organic", ["clorofom", "trichloromethane"]),
    ("ch2cl2", "Dichloromethane", "Dichloromethane", "ClCCl", "organic", []),
    ("ch3cl", "Chloromethane", "Chloromethane", "CCl", "organic", ["metyl clorua"]),
    ("ch3br", "Bromomethane", "Bromomethane", "CBr", "organic", ["metyl bromua"]),
    ("c2h6", "Ethane", "Ethane", "CC", "organic", ["etan"]),
    ("c2h4", "Ethene (ethylene)", "Ethene (ethylene)", "C=C", "organic", ["etilen", "eten"]),
    ("c2h2", "Ethyne (acetylene)", "Ethyne (acetylene)", "C#C", "organic", ["axetilen", "etin"]),
    ("c3h8", "Propane", "Propane", "CCC", "organic", ["propan"]),
    ("c3h6", "Propene", "Propene", "CC=C", "organic", ["propilen"]),
    ("c4h10", "Butane", "Butane", "CCCC", "organic", ["butan"]),
    ("isobutene", "2-Methylpropene", "2-Methylpropene", "CC(C)=C", "organic", ["isobutilen"]),
    ("c6h6", "Benzene", "Benzene", "c1ccccc1", "organic", ["benzen"]),
    ("toluene", "Toluene", "Toluene", "Cc1ccccc1", "organic", ["toluen"]),
    ("ch3oh", "Methanol", "Methanol", "CO", "organic", ["ancol metylic", "metanol"]),
    ("c2h5oh", "Ethanol", "Ethanol", "CCO", "organic", ["ancol etylic", "rượu etylic", "etanol"]),
    ("tbuoh", "2-Methylpropan-2-ol", "2-Methylpropan-2-ol (tert-butanol)", "CC(C)(C)O", "organic", ["tert-butanol"]),
    ("tbubr", "2-Bromo-2-methylpropane", "2-Bromo-2-methylpropane (tert-butyl bromide)", "CC(C)(C)Br", "organic", ["tert-butyl bromua"]),
    ("ipbr", "2-Bromopropane", "2-Bromopropane", "CC(C)Br", "organic", ["isopropyl bromua"]),
    ("hcho", "Methanal (formaldehyde)", "Methanal (formaldehyde)", "C=O", "organic", ["fomanđehit", "anđehit fomic"]),
    ("ch3cho", "Ethanal (acetaldehyde)", "Ethanal (acetaldehyde)", "CC=O", "organic", ["anđehit axetic", "axetanđehit"]),
    ("acetone", "Propanone (acetone)", "Propanone (acetone)", "CC(C)=O", "organic", ["axeton"]),
    ("hcooh", "Methanoic acid (formic acid)", "Methanoic acid (formic acid)", "OC=O", "organic", ["axit fomic"]),
    ("ch3cooh", "Ethanoic acid (acetic acid)", "Ethanoic acid (acetic acid)", "CC(=O)O", "organic", ["axit axetic"]),
    ("etac", "Ethyl ethanoate (ethyl acetate)", "Ethyl ethanoate (ethyl acetate)", "CCOC(C)=O", "organic", ["etyl axetat"]),
    ("glycine", "Glycine", "Glycine", "NCC(=O)O", "organic", ["axit aminoaxetic"]),
    ("urea", "Urea", "Urea", "NC(N)=O", "organic", ["ure"]),
    ("glucose", "Glucose (dạng vòng β)", "β-D-Glucopyranose", "OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@@H]1O", "organic", ["glucozơ"]),
    ("nh4", "Ion ammonium", "Ammonium ion", "[NH4+]", "ion", ["amoni"]),
    ("h3o", "Ion hydronium", "Hydronium ion", "[OH3+]", "ion", ["hiđroni"]),
    ("oh", "Ion hydroxide", "Hydroxide ion", "[OH-]", "ion", ["hiđroxit"]),
    ("no3", "Ion nitrate", "Nitrate ion", "[O-][N+](=O)[O-]", "ion", []),
    ("co3", "Ion carbonate", "Carbonate ion", "[O-]C([O-])=O", "ion", ["cacbonat"]),
    ("so4", "Ion sulfate", "Sulfate ion", "[O-]S(=O)(=O)[O-]", "ion", ["sunfat"]),
]

# Formulas as written in Vietnamese textbooks (the Hill formula from RDKit is kept too;
# a test checks both contain the same atoms).
DISPLAY_FORMULA = {
    "hf": "HF", "hcl": "HCl", "hbr": "HBr", "h2o": "H2O", "h2s": "H2S", "h2o2": "H2O2",
    "nh3": "NH3", "ph3": "PH3", "co": "CO", "co2": "CO2", "so2": "SO2", "so3": "SO3",
    "o3": "O3", "hcn": "HCN", "bf3": "BF3", "becl2": "BeCl2", "pcl3": "PCl3", "pcl5": "PCl5",
    "sf4": "SF4", "sf6": "SF6", "clf3": "ClF3", "xef4": "XeF4", "xef2": "XeF2",
    "ccl4": "CCl4", "chcl3": "CHCl3", "ch2cl2": "CH2Cl2", "ch3cl": "CH3Cl", "ch3br": "CH3Br",
    "c2h6": "C2H6", "c2h4": "C2H4", "c2h2": "C2H2", "c3h8": "C3H8", "c3h6": "CH2=CH–CH3",
    "c4h10": "CH3CH2CH2CH3", "isobutene": "(CH3)2C=CH2", "c6h6": "C6H6", "toluene": "C6H5CH3",
    "ch3oh": "CH3OH", "c2h5oh": "C2H5OH", "tbuoh": "(CH3)3COH", "tbubr": "(CH3)3CBr",
    "ipbr": "CH3CHBrCH3", "hcho": "HCHO", "ch3cho": "CH3CHO", "acetone": "CH3COCH3",
    "hcooh": "HCOOH", "ch3cooh": "CH3COOH", "etac": "CH3COOC2H5", "glycine": "H2NCH2COOH",
    "urea": "(NH2)2CO", "glucose": "C6H12O6", "nh4": "NH4+", "h3o": "H3O+", "oh": "OH-",
    "no3": "NO3-", "co3": "CO3-2", "so4": "SO4-2",
}

# VSEPR ideal directions (unit vectors) for bonds + lone pairs, by steric number.
IDEAL = {
    2: [(0, 0, 1), (0, 0, -1)],
    3: [(1, 0, 0), (-0.5, math.sqrt(3) / 2, 0), (-0.5, -math.sqrt(3) / 2, 0)],
    4: [(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1)],
    # trigonal bipyramid: 3 equatorial first (lone pairs go there), then 2 axial
    5: [(1, 0, 0), (-0.5, math.sqrt(3) / 2, 0), (-0.5, -math.sqrt(3) / 2, 0), (0, 0, 1), (0, 0, -1)],
    6: [(0, 0, 1), (0, 0, -1), (1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0)],
}
# Which ideal positions lone pairs occupy (VSEPR: equatorial in TBP, trans in octahedron).
LP_SLOTS = {5: [0, 1, 2], 6: [0, 1]}

# Molecules built from ideal VSEPR geometry (force fields do not model their lone pairs).
IDEAL_GEOMETRY = {"sf4", "clf3", "xef4", "xef2", "pcl5", "sf6", "becl2"}

# Small inorganic molecules for which MMFF94/UFF give poor geometries (e.g. N2 1.46 Å,
# CO2 1.41 Å, SO3 non-planar): their coordinates are built from EXPERIMENTAL geometries
# (NIST CCCBDB, experimental; pending teacher review). r in Å, angle in degrees.
EXPERIMENTAL = {
    "h2": {"r": 0.741},
    "n2": {"r": 1.098},
    "o2": {"r": 1.208},
    "f2": {"r": 1.412},
    "cl2": {"r": 1.988},
    "hf": {"r": 0.917},
    "hcl": {"r": 1.275},
    "hbr": {"r": 1.414},
    "co": {"r": 1.128},
    "co2": {"r": 1.160, "angle": 180.0},
    "so2": {"r": 1.431, "angle": 119.3},
    "o3": {"r": 1.278, "angle": 116.8},
    "so3": {"r": 1.418, "angle": 120.0},
    "bf3": {"r": 1.307, "angle": 120.0},
}

# Experimental reference geometries used to TEST the force-field structures above
# (NIST CCCBDB experimental; pending teacher review). Bonds in Å, angles in degrees.
REFERENCE = {
    "h2o": {"bonds": {"H-O": 0.958}, "angles": {"H-O-H": 104.5}},
    "nh3": {"bonds": {"H-N": 1.012}, "angles": {"H-N-H": 106.7}},
    "ch4": {"bonds": {"C-H": 1.087}, "angles": {"H-C-H": 109.47}},
    "co2": {"bonds": {"C-O": 1.160}, "angles": {"O-C-O": 180.0}},
    "c2h4": {"bonds": {"C-C": 1.339, "C-H": 1.086}, "angles": {"H-C-H": 117.4}},
    "c2h2": {"bonds": {"C-C": 1.203}, "angles": {"C-C-H": 180.0}},
    "c6h6": {"bonds": {"C-C": 1.397}, "angles": {"C-C-C": 120.0}},
    "hcn": {"bonds": {"C-N": 1.153}},
    "c2h6": {"bonds": {"C-C": 1.535}},
}


def valence_electrons(sym: str) -> int:
    e = element(sym)
    g = e.group_id
    if g is None:
        raise ValueError(sym)
    return g if g <= 2 else g - 10


def ideal_structure(mol: Chem.Mol):
    """Central atom at the origin, ligands along ideal VSEPR directions."""
    center = max(mol.GetAtoms(), key=lambda a: a.GetDegree())
    ci = center.GetIdx()
    sym = center.GetSymbol()
    bo = sum(b.GetBondTypeAsDouble() for b in center.GetBonds())
    lp = (valence_electrons(sym) - center.GetFormalCharge() - int(bo)) // 2
    steric = center.GetDegree() + lp
    dirs = [np.array(d, float) / np.linalg.norm(d) for d in IDEAL[steric]]
    lp_slots = LP_SLOTS.get(steric, list(range(lp)))[:lp] if lp else []
    free = [d for i, d in enumerate(dirs) if i not in lp_slots]
    if steric == 5 and lp == 0:
        free = dirs
    coords = {ci: np.zeros(3)}
    r_c = element(sym).covalent_radius_cordero / 100
    for nb, d in zip(center.GetNeighbors(), free):
        r = r_c + element(nb.GetSymbol()).covalent_radius_cordero / 100
        coords[nb.GetIdx()] = d * r
    return [coords[i] for i in range(mol.GetNumAtoms())]


def experimental_structure(mol: Chem.Mol, geo: dict):
    """Linear, bent or trigonal-planar structure from an experimental r (and angle)."""
    n = mol.GetNumAtoms()
    r = geo["r"]
    if n == 2:
        return [np.array([-r / 2, 0, 0]), np.array([r / 2, 0, 0])]
    center = max(mol.GetAtoms(), key=lambda a: a.GetDegree()).GetIdx()
    others = [i for i in range(n) if i != center]
    coords = {center: np.zeros(3)}
    if n == 3:
        half = math.radians(geo["angle"]) / 2
        coords[others[0]] = r * np.array([math.sin(half), math.cos(half), 0])
        coords[others[1]] = r * np.array([-math.sin(half), math.cos(half), 0])
    else:  # AX3 trigonal planar
        for k, i in enumerate(others):
            a = 2 * math.pi * k / 3
            coords[i] = r * np.array([math.cos(a), math.sin(a), 0])
    return [coords[i] for i in range(n)]


def build(mid: str, smiles: str):
    hypervalent = mid in IDEAL_GEOMETRY
    # RDKit refuses some hypervalent valences (ClF3, XeF4): parse those without sanitizing.
    mol = Chem.MolFromSmiles(smiles, sanitize=not hypervalent)
    if mol is None:
        raise ValueError(f"bad SMILES {smiles}")
    if hypervalent:
        mol.UpdatePropertyCache(strict=False)
    canonical = Chem.MolToSmiles(mol)
    if not hypervalent:
        mol = Chem.AddHs(mol)
    if mid in EXPERIMENTAL:
        coords = experimental_structure(mol, EXPERIMENTAL[mid])
        method = "experimental"
    elif hypervalent:
        coords = ideal_structure(mol)
        method = "vsepr-ideal"
    else:
        params = AllChem.ETKDGv3()
        params.randomSeed = 42
        if AllChem.EmbedMolecule(mol, params) != 0:
            raise RuntimeError(f"embedding failed for {mid}")
        if AllChem.MMFFHasAllMoleculeParams(mol):
            AllChem.MMFFOptimizeMolecule(mol, maxIters=5000)
            method = "mmff94"
        else:
            AllChem.UFFOptimizeMolecule(mol, maxIters=5000)
            method = "uff"
        conf = mol.GetConformer()
        coords = [np.array(conf.GetAtomPosition(i)) for i in range(mol.GetNumAtoms())]
    # Centre on the centroid.
    c = np.mean(coords, axis=0)
    coords = [p - c for p in coords]
    kek = Chem.Mol(mol)
    if not hypervalent:
        Chem.Kekulize(kek, clearAromaticFlags=True)
    # Graph symmetry classes ignoring bond orders/charges (resonance-equivalent atoms such as
    # the O atoms of NO3- share a class); used to average formal charges.
    plain = Chem.RWMol(mol)
    for b in plain.GetBonds():
        b.SetBondType(Chem.BondType.SINGLE)
        b.SetIsAromatic(False)
    for a in plain.GetAtoms():
        a.SetFormalCharge(0)
        a.SetIsAromatic(False)
    sym = list(Chem.CanonicalRankAtoms(plain, breakTies=False))
    atoms = [
        {
            "el": a.GetSymbol(),
            "sym": int(sym[a.GetIdx()]),
            "xyz": [round(float(v), 4) for v in coords[a.GetIdx()]],
            "charge": a.GetFormalCharge(),
        }
        for a in mol.GetAtoms()
    ]
    bonds = []
    for b, bk in zip(mol.GetBonds(), kek.GetBonds()):
        bonds.append(
            {
                "a": b.GetBeginAtomIdx(),
                "b": b.GetEndAtomIdx(),
                "order": int(bk.GetBondTypeAsDouble()),
                "aromatic": b.GetIsAromatic(),
            }
        )
    formula = rdMolDescriptors.CalcMolFormula(mol)
    return {
        "smiles": canonical,
        "formula": formula,
        "display_formula": DISPLAY_FORMULA.get(mid, formula),
        "molar_mass": round(Descriptors.MolWt(mol), 3),
        "atoms": atoms,
        "bonds": bonds,
        "geometry_method": method,
    }


def main() -> None:
    items = []
    for mid, vi, en, smiles, cat, aliases in MOLECULES:
        data = build(mid, smiles)
        items.append(
            {
                "id": mid,
                "name": {"vi": vi, "en": en},
                "aliases": aliases,
                "category": cat,
                **data,
                "reference": REFERENCE.get(mid),
                "experimental": EXPERIMENTAL.get(mid),
                "review_status": "pending",
            }
        )
    out = {
        "dataset": "molecules",
        "version": 1,
        "source": {
            "id": "rdkit",
            "citation": (
                f"Cấu trúc 3D sinh bằng RDKit {rdkit.__version__} (ETKDG v3 + MMFF94/UFF); "
                "phân tử siêu hóa trị: hình học VSEPR lý tưởng với độ dài liên kết = tổng bán kính "
                "cộng hóa trị Cordero 2008. Số liệu tham chiếu: NIST CCCBDB (thực nghiệm)."
            ),
            "url": "https://www.rdkit.org",
        },
        "generated_by": "scripts/data/gen_molecules.py",
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} molecules")


if __name__ == "__main__":
    main()
