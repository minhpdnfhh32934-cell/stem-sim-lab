"""Generate data/derivatives_kntt.json: halogen derivatives, alcohols, phenol, carbonyl compounds
and carboxylic acids of Hóa học 11 KNTT Chương 5 (Bài 19 "Dẫn xuất halogen", Bài 20 "Alcohol",
Bài 21 "Phenol") and Chương 6 (Bài 23 "Hợp chất carbonyl", Bài 24 "Carboxylic acid") (#255 round 2g).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Hóa học 11 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834, read
17/11/2026:
  - Bài 19: C–X bond energies (tr. 114); substitution and HX elimination, Zaitsev's rule with the
    2-bromobutane example and questions 5–6 (tr. 115–116);
  - Bài 20: propane / dimethyl ether / ethanol (tr. 122); Bảng 20.3 boiling points and solubility
    at 20 °C (tr. 123; the book cites Solomons, Fryhle, Snyder 2016); reactions and the
    pentan-2-ol example (tr. 123–127), ΔrH° of ethanol's combustion (tr. 125);
  - Bài 21: phenol's melting and boiling points and solubility (tr. 130); reactions (tr. 130–131);
  - Bài 23: butane / propanal / propan-1-ol (tr. 138); Bảng 23.1 (tr. 139; the book cites Brown
    2018); reactions (tr. 139–143);
  - Bài 24: alkane / aldehyde / alcohol / acid of similar molar mass (tr. 147; Hart, Hadad, Craine
    2011); Bảng 24.2 (tr. 148; same source); Bảng 24.3 dissociation constants and percentages at
    0,1 M (tr. 148; Stoker 2013); reactions (tr. 149–151).

Two numbers are kept as printed although they disagree with the book itself or with arithmetic,
and are listed in docs/DATA_REVIEW.md (HH11-DER-1): propan-1-ol boils at 97,2 °C in Bảng 20.3 and
tr. 147 but at 97,1 °C on tr. 138 (97,2 °C is used); Bảng 24.3 gives 1,2 % for propanoic acid at 0,1 M while its
constant 1,3·10⁻⁵ gives 1,1 %. One equation is corrected: the iodoform reaction of ethanal
(tr. 142) is printed with "H₂O" but balances only with 3H₂O (the note says so on screen).

Everything is review_status "pending".

    python scripts/data/gen_derivatives_kntt.py
"""
import json
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "derivatives_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834"

# Book's atomic masses (Bài 12, tr. 72): used to check the molar masses printed in the comparisons.
MASS = {"C": 12, "H": 1, "O": 16}

# Tables as printed: (id, class, name, condensed formula, C count, mp °C or None, bp °C, solubility,
# solubility temperature °C, table label, page, open-chain monofunctional member of the series).
# Solubility: a number (g/100 g water), "miscible" (tan vô hạn) or "insoluble" (không tan).
COMPOUNDS = [
    ("methanol", "alcohol", "methanol", "CH3OH", 1, None, 64.7, "miscible", 20, "Bảng 20.3", 123, True),
    ("ethanol", "alcohol", "ethanol", "CH3CH2OH", 2, None, 78.3, "miscible", 20, "Bảng 20.3", 123, True),
    ("propan-1-ol", "alcohol", "propan-1-ol", "CH3CH2CH2OH", 3, None, 97.2, "miscible", 20, "Bảng 20.3", 123, True),
    ("butan-1-ol", "alcohol", "butan-1-ol", "CH3CH2CH2CH2OH", 4, None, 117.7, 8.3, 20, "Bảng 20.3", 123, True),
    ("pentan-1-ol", "alcohol", "pentan-1-ol", "CH3CH2CH2CH2CH2OH", 5, None, 138, 2.2, 20, "Bảng 20.3", 123, True),
    ("ethylene-glycol", "alcohol", "ethylene glycol", "HOCH2CH2OH", 2, None, 197, "miscible", 20, "Bảng 20.3", 123, False),
    ("glycerol", "alcohol", "glycerol", "HOCH2CH(OH)CH2OH", 3, None, 290, "miscible", 20, "Bảng 20.3", 123, False),
    ("phenol", "phenol", "phenol", "C6H5OH", 6, 43, 181.8, 8.42, 25, "tr. 130", 130, False),
    ("methanal", "aldehyde", "methanal", "HCHO", 1, None, -21, "miscible", 20, "Bảng 23.1", 139, True),
    ("ethanal", "aldehyde", "ethanal", "CH3CHO", 2, None, 20, "miscible", 20, "Bảng 23.1", 139, True),
    ("propanal", "aldehyde", "propanal", "CH3CH2CHO", 3, None, 49, 20, 20, "Bảng 23.1", 139, True),
    ("butanal", "aldehyde", "butanal", "CH3CH2CH2CHO", 4, None, 76, 7, 20, "Bảng 23.1", 139, True),
    ("propanone", "ketone", "propanone", "CH3COCH3", 3, None, 56, "miscible", 20, "Bảng 23.1", 139, True),
    ("butanone", "ketone", "butanone", "CH3COCH2CH3", 4, None, 80, 26, 20, "Bảng 23.1", 139, True),
    ("pentan-3-one", "ketone", "pentan-3-one", "CH3CH2COCH2CH3", 5, None, 101, 5, 20, "Bảng 23.1", 139, True),
    ("methanoic-acid", "acid", "methanoic acid", "HCOOH", 1, 8, 101, "miscible", 25, "Bảng 24.2", 148, True),
    ("ethanoic-acid", "acid", "ethanoic acid", "CH3COOH", 2, 17, 118, "miscible", 25, "Bảng 24.2", 148, True),
    ("propanoic-acid", "acid", "propanoic acid", "CH3CH2COOH", 3, -22, 141, "miscible", 25, "Bảng 24.2", 148, True),
    ("butanoic-acid", "acid", "butanoic acid", "CH3[CH2]2COOH", 4, -8, 164, "miscible", 25, "Bảng 24.2", 148, True),
    ("pentanoic-acid", "acid", "pentanoic acid", "CH3[CH2]3COOH", 5, -34, 186, 4.97, 25, "Bảng 24.2", 148, True),
    ("hexanoic-acid", "acid", "hexanoic acid", "CH3[CH2]4COOH", 6, -1.5, 205, 1.0, 25, "Bảng 24.2", 148, True),
    ("decanoic-acid", "acid", "decanoic acid", "CH3[CH2]8COOH", 10, 31, 270, 0.01, 25, "Bảng 24.2", 148, True),
]

# The book's side-by-side comparisons of compounds of similar molar mass: (id, chapter, page,
# source note, [(class, name, formula, M as printed or None, bp °C, solubility or None)]). The
# question on tr. 138 (butane, propanal, propan-1-ol) is the first three rows of tr. 147, except
# that it prints 97,1 °C for propan-1-ol: tr. 147 and Bảng 20.3 (97,2 °C) are used.
COMPARISONS = [
    ("c20", 5, 122, None, [
        ("alkane", "propane", "CH3CH2CH3", 44, -42.1, "insoluble"),
        ("ether", "dimethyl ether", "CH3OCH3", 46, -24.9, 7.4),
        ("alcohol", "ethanol", "CH3CH2OH", 46, 78.3, "miscible"),
    ]),
    ("c24", 6, 147, "Hart, Hadad, Craine 2011", [
        ("alkane", "butane", "CH3CH2CH2CH3", 58, -0.5, None),
        ("aldehyde", "propanal", "CH3CH2CHO", 58, 49, None),
        ("alcohol", "propan-1-ol", "CH3CH2CH2OH", 60, 97.2, None),
        ("acid", "acetic acid", "CH3COOH", 60, 118, None),
    ]),
]

# C–X bond energies (kJ/mol), tr. 114.
BONDS = [("C–F", 486), ("C–Cl", 327), ("C–Br", 285), ("C–I", 214)]

# Bảng 24.3 (tr. 148): (formula, name, Ka, percent dissociated in 0,1 M as printed).
ACIDS = [
    ("HCOOH", "methanoic acid", 1.8e-4, 4.2),
    ("CH3COOH", "ethanoic acid", 1.8e-5, 1.3),
    ("CH3CH2COOH", "propanoic acid", 1.3e-5, 1.2),
    ("CH3CH2CH2COOH", "butanoic acid", 1.5e-5, 1.2),
]

# Eliminations (Zaitsev's rule): (id, kind, substrate name, condensed, molecular, carbon skeleton,
# carbon bearing X or OH, conditions vi/en, page, book's main product or None when the book only
# asks, [(β-carbon, product condensed, product name, product molecular)]).
# The skeleton lists C–C bonds; a β-carbon's degree (bậc) is its number of carbon neighbours.
ELIMINATIONS = [
    ("bromoethane", "HX", "bromoethane", "CH3CH2Br", "C2H5Br", [(1, 2)], 1,
     ("NaOH/C2H5OH, t°", "NaOH in ethanol, heat"), 115, "ethene",
     [(2, "CH2=CH2", "ethene", "C2H4")]),
    ("2-bromobutane", "HX", "2-bromobutane", "CH3CHBrCH2CH3", "C4H9Br", [(1, 2), (2, 3), (3, 4)], 2,
     ("NaOH/C2H5OH, t°", "NaOH in ethanol, heat"), 116, "but-2-ene",
     [(1, "CH2=CHCH2CH3", "but-1-ene", "C4H8"), (3, "CH3CH=CHCH3", "but-2-ene", "C4H8")]),
    ("2-chloropropane", "HX", "2-chloropropane", "CH3CHClCH3", "C3H7Cl", [(1, 2), (2, 3)], 2,
     ("NaOH/C2H5OH, t°", "NaOH in ethanol, heat"), 116, None,
     [(1, "CH2=CHCH3", "propene", "C3H6"), (3, "CH2=CHCH3", "propene", "C3H6")]),
    ("2-bromo-2-methylbutane", "HX", "2-bromo-2-methylbutane", "CH3CBr(CH3)CH2CH3", "C5H11Br",
     [(1, 2), (2, 3), (3, 4), (2, 5)], 2,
     ("NaOH/C2H5OH, t°", "NaOH in ethanol, heat"), 116, None,
     [(1, "CH2=C(CH3)CH2CH3", "2-methylbut-1-ene", "C5H10"),
      (3, "CH3C(CH3)=CHCH3", "2-methylbut-2-ene", "C5H10"),
      (5, "CH2=C(CH3)CH2CH3", "2-methylbut-1-ene", "C5H10")]),
    ("ethanol", "H2O", "ethanol", "C2H5OH", "C2H6O", [(1, 2)], 1,
     ("H2SO4 đặc, 180 °C", "concentrated H2SO4, 180 °C"), 123, "ethene",
     [(2, "CH2=CH2", "ethene", "C2H4")]),
    ("butan-2-ol", "H2O", "butan-2-ol", "CH3CH(OH)CH2CH3", "C4H10O", [(1, 2), (2, 3), (3, 4)], 2,
     ("H2SO4 đặc, t°", "concentrated H2SO4, heat"), 124, None,
     [(1, "CH2=CHCH2CH3", "but-1-ene", "C4H8"), (3, "CH3CH=CHCH3", "but-2-ene", "C4H8")]),
    ("pentan-2-ol", "H2O", "pentan-2-ol", "CH3CH2CH2CH(OH)CH3", "C5H12O", [(1, 2), (2, 3), (3, 4), (4, 5)], 2,
     ("H2SO4 đặc, t°", "concentrated H2SO4, heat"), 124, "pent-2-ene",
     [(1, "CH2=CHCH2CH2CH3", "pent-1-ene", "C5H10"), (3, "CH3CH=CHCH2CH3", "pent-2-ene", "C5H10")]),
]

# The book's equations: (chapter, class, kind vi, kind en, reactants, products, conditions vi,
# conditions en, ΔrH° kJ or None, page, reversible, general (R… — not atom-checked), note vi, note en).
R = []


def rx(ch, cls, kvi, ken, rs, ps, cvi="", cen="", dh=None, p=0, rev=False, general=False, nvi="", nen=""):
    R.append((ch, cls, kvi, ken, rs, ps, cvi, cen, dh, p, rev, general, nvi, nen))


rx(5, "halide", "Thế nguyên tử halogen", "Halogen substitution",
   [(1, "CH3CH2CH2Cl"), (1, "NaOH")], [(1, "CH3CH2CH2OH"), (1, "NaCl")], "t°", "heat", p=115)
rx(5, "halide", "Tách hydrogen halide", "Hydrogen halide elimination",
   [(1, "CH3CH2Br")], [(1, "CH2=CH2"), (1, "HBr")], "NaOH/C2H5OH, t°", "NaOH in ethanol, heat", p=115)
rx(5, "alcohol", "Thế H của nhóm –OH", "Replacing the H of –OH",
   [(2, "ROH"), (2, "Na")], [(2, "RONa"), (1, "H2")], p=123, general=True)
rx(5, "alcohol", "Tạo ether", "Ether formation",
   [(1, "C2H5OH"), (1, "HOC2H5")], [(1, "C2H5–O–C2H5"), (1, "H2O")], "H2SO4 đặc, 140 °C",
   "concentrated H2SO4, 140 °C", p=123)
rx(5, "alcohol", "Tạo alkene", "Alkene formation",
   [(1, "C2H5OH")], [(1, "CH2=CH2"), (1, "H2O")], "H2SO4 đặc, 180 °C", "concentrated H2SO4, 180 °C", p=123)
rx(5, "alcohol", "Oxi hóa bằng CuO (bậc I)", "Oxidation by CuO (primary)",
   [(1, "CH3CH2OH"), (1, "CuO")], [(1, "CH3CH=O"), (1, "Cu"), (1, "H2O")], "t°", "heat", p=124)
rx(5, "alcohol", "Oxi hóa bằng CuO (bậc II)", "Oxidation by CuO (secondary)",
   [(1, "CH3CH(OH)CH3"), (1, "CuO")], [(1, "CH3COCH3"), (1, "Cu"), (1, "H2O")], "t°", "heat", p=124)
rx(5, "alcohol", "Đốt cháy", "Combustion",
   [(1, "C2H5OH"), (3, "O2")], [(2, "CO2"), (3, "H2O")], "t°", "heat", dh=-1367, p=125)
rx(5, "alcohol", "Polyalcohol với Cu(OH)2", "Polyalcohol with Cu(OH)2",
   [(2, "HOCH2CH2OH"), (1, "Cu(OH)2")], [(1, "(HOCH2CH2O)2Cu"), (2, "H2O")],
   "dung dịch xanh lam đậm", "deep blue solution", p=125)
rx(5, "alcohol", "Hydrate hóa ethylene", "Hydration of ethylene",
   [(1, "CH2=CH2"), (1, "H2O")], [(1, "C2H5OH")], "H3PO4, t°", "H3PO4, heat", p=127)
rx(5, "alcohol", "Lên men glucose", "Fermentation of glucose",
   [(1, "C6H12O6")], [(2, "C2H5OH"), (2, "CO2")], "enzyme", "enzyme", p=127)
rx(5, "phenol", "Với dung dịch NaOH", "With NaOH solution",
   [(1, "C6H5OH"), (1, "NaOH")], [(1, "C6H5ONa"), (1, "H2O")], p=130)
rx(5, "phenol", "Với dung dịch Na2CO3", "With Na2CO3 solution",
   [(1, "C6H5OH"), (1, "Na2CO3")], [(1, "C6H5ONa"), (1, "NaHCO3")], p=130, rev=True)
rx(5, "phenol", "Với nước bromine", "With bromine water",
   [(1, "C6H5OH"), (3, "Br2")], [(1, "C6H2Br3OH"), (3, "HBr")], "kết tủa trắng 2,4,6-tribromophenol",
   "white precipitate of 2,4,6-tribromophenol", p=131)
rx(6, "carbonyl", "Khử aldehyde", "Reducing an aldehyde",
   [(1, "CH3CH=O"), (2, "[H]")], [(1, "CH3CH2OH")], "NaBH4", "NaBH4", p=139)
rx(6, "carbonyl", "Khử ketone", "Reducing a ketone",
   [(1, "CH3COCH3"), (2, "[H]")], [(1, "CH3CH(OH)CH3")], "NaBH4", "NaBH4", p=139)
rx(6, "carbonyl", "Oxi hóa bằng nước bromine", "Oxidation by bromine water",
   [(1, "CH3CHO"), (1, "Br2"), (1, "H2O")], [(1, "CH3COOH"), (2, "HBr")], p=140)
rx(6, "carbonyl", "Tráng bạc (thuốc thử Tollens)", "Silver mirror (Tollens’ reagent)",
   [(1, "CH3CHO"), (2, "[Ag(NH3)2]OH")], [(1, "CH3COONH4"), (2, "Ag"), (3, "NH3"), (1, "H2O")],
   "t°", "heat", p=140)
rx(6, "carbonyl", "Oxi hóa bằng Cu(OH)2", "Oxidation by Cu(OH)2",
   [(1, "RCHO"), (2, "Cu(OH)2"), (1, "NaOH")], [(1, "RCOONa"), (1, "Cu2O"), (3, "H2O")],
   "t°, kết tủa đỏ gạch Cu2O", "heat, brick-red Cu2O precipitate", p=141, general=True)
rx(6, "carbonyl", "Cộng HCN", "Adding HCN",
   [(1, "CH3CHO"), (1, "HCN")], [(1, "CH3CH(OH)CN")], p=142)
rx(6, "carbonyl", "Cộng HCN", "Adding HCN",
   [(1, "CH3COCH3"), (1, "HCN")], [(1, "(CH3)2C(OH)CN")], p=142)
rx(6, "carbonyl", "Tạo iodoform", "Iodoform reaction",
   [(1, "C2H5COCH3"), (3, "I2"), (4, "NaOH")], [(1, "C2H5COONa"), (1, "CHI3"), (3, "NaI"), (3, "H2O")],
   "kết tủa vàng CHI3", "yellow CHI3 precipitate", p=142)
rx(6, "carbonyl", "Tạo iodoform", "Iodoform reaction",
   [(1, "CH3CHO"), (3, "I2"), (4, "NaOH")], [(1, "HCOONa"), (1, "CHI3"), (3, "NaI"), (3, "H2O")],
   "kết tủa vàng CHI3", "yellow CHI3 precipitate", p=142,
   nvi="Sách in “+ H2O”; cân bằng số nguyên tử H và O cần 3H2O.",
   nen="The book prints “+ H2O”; balancing H and O needs 3H2O.")
rx(6, "carbonyl", "Oxi hóa ethylene", "Oxidising ethylene",
   [(2, "CH2=CH2"), (1, "O2")], [(2, "CH3CHO")], "PdCl2/CuCl2", "PdCl2/CuCl2", p=143)
rx(6, "acid", "Với kim loại", "With a metal",
   [(2, "CH3COOH"), (1, "Zn")], [(1, "(CH3COO)2Zn"), (1, "H2")], p=149)
rx(6, "acid", "Với muối carbonate", "With a carbonate",
   [(2, "CH3COOH"), (1, "CaCO3")], [(1, "(CH3COO)2Ca"), (1, "H2O"), (1, "CO2")], p=149)
rx(6, "acid", "Với base", "With a base",
   [(2, "CH3COOH"), (1, "Ca(OH)2")], [(1, "(CH3COO)2Ca"), (2, "H2O")], p=149)
rx(6, "acid", "Với oxide base", "With a basic oxide",
   [(2, "CH3COOH"), (1, "CuO")], [(1, "(CH3COO)2Cu"), (1, "H2O")], p=149)
rx(6, "acid", "Ester hóa", "Esterification",
   [(1, "CH3COOH"), (1, "CH3OH")], [(1, "CH3COOCH3"), (1, "H2O")], "H2SO4 đặc, t°",
   "concentrated H2SO4, heat", p=150, rev=True)
rx(6, "acid", "Lên men giấm", "Vinegar fermentation",
   [(1, "C2H5OH"), (1, "O2")], [(1, "CH3COOH"), (1, "H2O")], "men giấm", "acetic bacteria", p=151)
rx(6, "acid", "Oxi hóa alkane", "Oxidising an alkane",
   [(2, "CH3CH2CH2CH3"), (5, "O2")], [(4, "CH3COOH"), (2, "H2O")], "xúc tác, t°, áp suất",
   "catalyst, heat, pressure", p=151)


def counts(formula: str) -> dict:
    """Element counts with nested () and []; structural marks (=, –) and [H]'s brackets ignored."""
    s = formula.replace("=", "").replace("–", "")
    stack: list = [{}]
    i = 0
    while i < len(s):
        ch = s[i]
        if ch in "([":
            stack.append({})
            i += 1
        elif ch in ")]":
            m = re.match(r"\d*", s[i + 1:]).group()
            inner = stack.pop()
            for el, n in inner.items():
                stack[-1][el] = stack[-1].get(el, 0) + n * int(m or 1)
            i += 1 + len(m)
        else:
            m = re.match(r"([A-Z][a-z]?)(\d*)", s[i:])
            assert m, (formula, s[i:])
            el, n = m.group(1), int(m.group(2) or 1)
            stack[-1][el] = stack[-1].get(el, 0) + n
            i += len(m.group())
    assert len(stack) == 1, formula
    return stack[0]


def side(terms) -> dict:
    out: dict = {}
    for k, f in terms:
        for el, n in counts(f).items():
            out[el] = out.get(el, 0) + k * n
    return out


def sol(v):
    if v is None:
        return None
    if isinstance(v, str):
        return {"kind": v, "g": None}
    return {"kind": "value", "g": v}


def main() -> None:
    for cid, cls, name, f, n, mp, bp, s, st, table, page, series in COMPOUNDS:
        assert counts(f).get("C") == n, (cid, f)
        assert mp is None or mp < bp, cid
    for cid, _ch, _p, _src, rows in COMPARISONS:
        for _cls, name, f, M, *_ in rows:
            if M is not None:
                c = counts(f)
                assert sum(MASS[e] * k for e, k in c.items()) == M, (cid, name, M)
    for f, name, ka, pct in ACIDS:
        # The printed percentage at 0,1 M against the exact weak-acid solution (one decimal place).
        c = 0.1
        alpha = (-ka + math.sqrt(ka * ka + 4 * ka * c)) / (2 * c)
        assert abs(100 * alpha - pct) < 0.11, (name, 100 * alpha, pct)
    for eid, kind, name, cond, mol, bonds, xc, _cv, _p, main_book, opts in ELIMINATIONS:
        lost = {"HX": None, "H2O": {"H": 2, "O": 1}}[kind]
        sub = counts(mol)
        for beta, _pc, pname, pmol in opts:
            assert (xc, beta) in bonds or (beta, xc) in bonds, (eid, beta)
            prod = counts(pmol)
            diff = {e: sub.get(e, 0) - prod.get(e, 0) for e in set(sub) | set(prod)}
            diff = {e: k for e, k in diff.items() if k}
            if lost:
                assert diff == lost, (eid, pname, diff)
            else:
                assert diff.get("H") == 1 and len(diff) == 2 and sum(diff.values()) == 2, (eid, pname, diff)
        if main_book:
            assert main_book in [o[2] for o in opts], eid
    for ch, cls, kvi, _ke, rs, ps, *_rest in R:
        general = _rest[5]
        if not general:
            assert side(rs) == side(ps), (kvi, side(rs), side(ps))

    def degree(bonds, c):
        return sum(1 for a, b in bonds if c in (a, b))

    out = {
        "dataset": "derivatives_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-hh11-c5-c6",
            "citation": (
                "SGK Hóa học 11 Kết nối tri thức, NXB Giáo dục Việt Nam: Chương 5 “Dẫn xuất halogen – "
                "alcohol – phenol” (Bài 19–21, tr. 112–133) và Chương 6 “Hợp chất carbonyl – carboxylic "
                "acid” (Bài 23–24, tr. 136–152); Bảng 20.3, 23.1, 24.2, 24.3 sách ghi nguồn Solomons "
                "(2016), Brown (2018), Hart (2011), Stoker (2013)"
            ),
            "url": READER,
        },
        "items": [
            {
                "id": cid,
                "class": cls,
                "name": name,
                "formula": f,
                "carbons": n,
                "mp_C": mp,
                "bp_C": bp,
                "solubility": sol(s),
                "solubility_T_C": st,
                "table": table,
                "page": page,
                "series": series,
                "review_status": "pending",
            }
            for cid, cls, name, f, n, mp, bp, s, st, table, page, series in COMPOUNDS
        ],
        "comparisons": [
            {
                "id": cid,
                "chapter": ch,
                "page": p,
                "note": src,
                "rows": [
                    {"class": cls, "name": name, "formula": f, "M": M, "bp_C": bp, "solubility": sol(s)}
                    for cls, name, f, M, bp, s in rows
                ],
            }
            for cid, ch, p, src, rows in COMPARISONS
        ],
        "bonds": [{"bond": b, "energy_kJ": e, "page": 114} for b, e in BONDS],
        "acids": [{"formula": f, "name": name, "Ka": ka, "percent_01M": pct, "page": 148} for f, name, ka, pct in ACIDS],
        "eliminations": [
            {
                "id": eid,
                "kind": kind,
                "name": name,
                "formula": cond,
                "molecular": mol,
                "conditions": {"vi": cv[0], "en": cv[1]},
                "page": p,
                "book_main": main_book,
                "x_carbon": xc,
                "group": "OH" if kind == "H2O" else next(e for e in counts(mol) if e in ("F", "Cl", "Br", "I")),
                "options": [
                    {"carbon": beta, "degree": degree(bonds, beta), "formula": pc, "name": pname, "molecular": pmol}
                    for beta, pc, pname, pmol in opts
                ],
            }
            for eid, kind, name, cond, mol, bonds, xc, cv, p, main_book, opts in ELIMINATIONS
        ],
        "reactions": [
            {
                "chapter": ch,
                "class": cls,
                "kind": {"vi": kvi, "en": ken},
                "reactants": [{"coef": k, "formula": f} for k, f in rs],
                "products": [{"coef": k, "formula": f} for k, f in ps],
                # The book prints no condition for some reactions: a dash, never an invented one.
                "conditions": {"vi": cvi or "—", "en": cen or "—"},
                "dH_kJ": dh,
                "page": p,
                "reversible": rev,
                "general": general,
                "note": {"vi": nvi, "en": nen} if nvi else None,
            }
            for ch, cls, kvi, ken, rs, ps, cvi, cen, dh, p, rev, general, nvi, nen in R
        ],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(COMPOUNDS)} compounds, {len(R)} reactions")


if __name__ == "__main__":
    main()
