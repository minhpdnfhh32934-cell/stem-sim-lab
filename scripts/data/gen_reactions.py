"""Generate data/reactions.json: the curated reaction library (MASTER_PROMPT §2.2, §6.3).

Every reaction has a balanced equation (checked here and again by the app's tests),
conditions, sources and review_status "pending". A mechanism is included ONLY for textbook
mechanisms that are well established; each mechanism step is an atom-mapped structure
(all atoms, hydrogens included, carry map numbers so the app can show which bonds break
and form). Coordinates:

- stable species: RDKit ETKDG v3 + MMFF94 (UFF / plain embedding for radicals, cations);
- fragments are placed rigidly so that reacting atoms are at the stated contact distances
  (approach ≈ 2.5–3.2 Å, partial bonds in transition states ≈ 1.2–2.6 Å);
- transition-state geometries are ILLUSTRATIVE (not computed by quantum chemistry), and the
  motion between key frames is an interpolation: the app labels it
  "Chuyển tiếp minh họa — không phải quỹ đạo nguyên tử thực".

    python scripts/data/gen_reactions.py
"""
import json
import pathlib
import re

import numpy as np
import rdkit
from rdkit import Chem
from rdkit.Chem import AllChem
from scipy.optimize import minimize
from scipy.spatial.transform import Rotation

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "reactions.json"


def T(vi, en):
    return {"vi": vi, "en": en}


SRC = {
    "sgk10": {"id": "sgk-hh10", "citation": "Sách giáo khoa Hóa học 10 (Chương trình GDPT 2018), NXB Giáo dục Việt Nam"},
    "sgk11": {"id": "sgk-hh11", "citation": "Sách giáo khoa Hóa học 11 (Chương trình GDPT 2018), NXB Giáo dục Việt Nam"},
    "sgk12": {"id": "sgk-hh12", "citation": "Sách giáo khoa Hóa học 12 (Chương trình GDPT 2018), NXB Giáo dục Việt Nam"},
    "clayden_sub": {"id": "clayden-sn", "citation": "J. Clayden, N. Greeves, S. Warren — Organic Chemistry, 2nd ed., OUP: chương “Nucleophilic substitution at saturated carbon”"},
    "clayden_elim": {"id": "clayden-elim", "citation": "J. Clayden, N. Greeves, S. Warren — Organic Chemistry, 2nd ed., OUP: chương “Elimination reactions”"},
    "clayden_add": {"id": "clayden-add", "citation": "J. Clayden, N. Greeves, S. Warren — Organic Chemistry, 2nd ed., OUP: chương “Electrophilic addition to alkenes”"},
    "clayden_carbonyl": {"id": "clayden-carbonyl", "citation": "J. Clayden, N. Greeves, S. Warren — Organic Chemistry, 2nd ed., OUP: chương “Nucleophilic substitution at the carbonyl (C=O) group”"},
    "clayden_radical": {"id": "clayden-radical", "citation": "J. Clayden, N. Greeves, S. Warren — Organic Chemistry, 2nd ed., OUP: chương “Radical reactions”"},
    "atkins": {"id": "atkins", "citation": "P. Atkins, J. de Paula, J. Keeler — Atkins' Physical Chemistry, OUP: acid–base proton transfer"},
    "greenwood": {"id": "greenwood", "citation": "N. N. Greenwood, A. Earnshaw — Chemistry of the Elements, 2nd ed., Butterworth-Heinemann"},
}

# ─────────────────────────────── mechanisms ───────────────────────────────
# Key frame: (kind, label, description, mapped SMILES, partial bonds [(a, b, d)],
#             contacts [(a, b, d)], arrows [((from...), (to...))] towards the NEXT frame)

TBU = "[C:1]([C:2]([H:10])([H:11])[H:12])([C:3]([H:13])([H:14])[H:15])([C:4]([H:16])([H:17])[H:18])"
TBU_PLUS = "[C+:1]([C:2]([H:10])([H:11])[H:12])([C:3]([H:13])([H:14])[H:15])[C:4]([H:16])([H:17])[H:18]"
TBU_RAD = "[C:1]([C:2]([H:10])([H:11])[H:12])([C:3]([H:13])([H:14])[H:15])[C:4]([H:16])([H:17])[H:18]"
W1 = "[O:6]([H:7])[H:8]"
W2 = "[O:9]([H:19])[H:20]"

MECHANISMS = {
    "neutralization": {
        "type": T("Chuyển proton (axit–bazơ Brønsted)", "Proton transfer (Brønsted acid–base)"),
        "note": T(
            "Trong nước, proton thực tế di chuyển qua chuỗi liên kết hydro (cơ chế Grotthuss); ở đây giản lược thành một bước chuyển proton trực tiếp.",
            "In water the proton actually hops along hydrogen-bond chains (Grotthuss mechanism); shown here simplified as one direct transfer.",
        ),
        "frames": [
            ("reactants", T("Chất đầu", "Reactants"), T("Ion H₃O⁺ và OH⁻ tiến lại gần, tạo liên kết hydro O–H···O.", "H₃O⁺ and OH⁻ approach and form an O–H···O hydrogen bond."),
             "[O+:1]([H:2])([H:3])[H:4].[O-:5][H:6]", [], [(4, 5, 1.75), (1, 5, 2.75)],
             [((5,), (4,)), ((1, 4), (1,))]),
            ("ts", T("Trạng thái chuyển tiếp (minh họa)", "Transition state (illustrative)"), T("Proton H nằm giữa hai nguyên tử O.", "The proton sits between the two oxygen atoms."),
             "[O:1]([H:2])[H:3].[O:5][H:6].[H:4]", [(1, 4, 1.22), (4, 5, 1.22)], [(1, 5, 2.44)], []),
            ("products", T("Sản phẩm", "Products"), T("Hai phân tử H₂O.", "Two water molecules."),
             "[O:1]([H:2])[H:3].[O:5]([H:6])[H:4]", [], [(1, 4, 1.9)], []),
        ],
    },
    "sn2": {
        "type": T("Thế nucleophin lưỡng phân tử (SN2)", "Bimolecular nucleophilic substitution (SN2)"),
        "note": T(
            "Một bước duy nhất: OH⁻ tấn công từ phía sau liên kết C–Br, cấu hình của C bị nghịch đảo (nghịch đảo Walden).",
            "A single step: OH⁻ attacks from the back of the C–Br bond and the carbon's configuration is inverted (Walden inversion).",
        ),
        "frames": [
            ("reactants", T("Chất đầu", "Reactants"), T("OH⁻ tiến đến C từ phía đối diện với Br.", "OH⁻ approaches C from the side opposite to Br."),
             "[C:1]([H:4])([H:5])([H:6])[Br:2].[O-:3][H:7]", [], [(3, 1, 3.0), (3, 2, 4.95)],
             [((3,), (3, 1)), ((1, 2), (2,))]),
            ("ts", T("Trạng thái chuyển tiếp", "Transition state"), T("HO···C···Br thẳng hàng; ba nguyên tử H nằm trong một mặt phẳng.", "HO···C···Br collinear; the three H atoms lie in one plane."),
             "[C:1]([H:4])([H:5])[H:6].[O:3][H:7].[Br:2]", [(3, 1, 2.0), (1, 2, 2.45)], [(3, 2, 4.45)], []),
            ("products", T("Sản phẩm", "Products"), T("CH₃OH (cấu hình nghịch đảo) và Br⁻.", "CH₃OH (inverted) and Br⁻."),
             "[C:1]([H:4])([H:5])([H:6])[O:3][H:7].[Br-:2]", [], [(1, 2, 3.3), (3, 2, 4.7)], []),
        ],
    },
    "sn1": {
        "type": T("Thế nucleophin đơn phân tử (SN1)", "Unimolecular nucleophilic substitution (SN1)"),
        "note": T(
            "Hai giai đoạn chính: (1) C–Br tự phân li tạo cacbocation bậc ba (chậm, quyết định tốc độ); (2) H₂O tấn công cacbocation; sau đó một phân tử H₂O khác nhận proton.",
            "Two main stages: (1) C–Br ionises to a tertiary carbocation (slow, rate-determining); (2) water attacks the carbocation; then another water removes a proton.",
        ),
        "frames": [
            ("reactants", T("Chất đầu", "Reactants"), T("(CH₃)₃CBr trong nước.", "(CH₃)₃CBr in water."),
             f"{TBU}[Br:5].{W1}.{W2}", [], [(6, 1, 4.2), (9, 6, 2.9)], [((1, 5), (5,))]),
            ("ts", T("Trạng thái chuyển tiếp 1 (minh họa)", "Transition state 1 (illustrative)"), T("Liên kết C–Br kéo dài và phân cực.", "The C–Br bond stretches and polarises."),
             f"{TBU_RAD}.[Br:5].{W1}.{W2}", [(1, 5, 2.6)], [(6, 1, 4.0), (9, 6, 2.9)], []),
            ("intermediate", T("Cacbocation", "Carbocation"), T("Cacbocation bậc ba phẳng (CH₃)₃C⁺ và Br⁻.", "Planar tertiary carbocation (CH₃)₃C⁺ and Br⁻."),
             f"{TBU_PLUS}.[Br-:5].{W1}.{W2}", [], [(1, 5, 3.6), (6, 1, 3.0), (9, 6, 2.9)], [((6,), (6, 1))]),
            ("intermediate", T("Ion oxoni", "Oxonium ion"), T("H₂O đã liên kết với C: (CH₃)₃C–OH₂⁺.", "Water has bonded to C: (CH₃)₃C–OH₂⁺."),
             f"{TBU}[O+:6]([H:7])[H:8].[Br-:5].{W2}", [], [(9, 8, 1.8), (1, 5, 4.2)], [((9,), (8,)), ((6, 8), (6,))]),
            ("products", T("Sản phẩm", "Products"), T("(CH₃)₃COH, H₃O⁺ và Br⁻.", "(CH₃)₃COH, H₃O⁺ and Br⁻."),
             f"{TBU}[O:6][H:7].[O+:9]([H:19])([H:20])[H:8].[Br-:5]", [], [(9, 6, 2.8), (1, 5, 4.2)], []),
        ],
    },
    "e2": {
        "type": T("Tách lưỡng phân tử (E2)", "Bimolecular elimination (E2)"),
        "note": T(
            "Một bước: bazơ lấy H ở C bên cạnh (vị trí anti so với Br), đồng thời liên kết π C=C hình thành và Br⁻ tách ra.",
            "One step: the base removes the H anti-periplanar to Br while the C=C π bond forms and Br⁻ leaves.",
        ),
        "frames": [
            ("reactants", T("Chất đầu", "Reactants"), T("OH⁻ tiến đến H ở vị trí anti so với Br.", "OH⁻ approaches the H anti to Br."),
             "[C:1]([H:5])([Br:4])([C:2]([H:6])([H:7])[H:8])[C:3]([H:9])([H:10])[H:11].[O-:12][H:13]", [], [(12, 8, 2.1), (12, 4, 5.6)],
             [((12,), (12, 8)), ((2, 8), (1, 2)), ((1, 4), (4,))]),
            ("ts", T("Trạng thái chuyển tiếp (minh họa)", "Transition state (illustrative)"), T("O···H···C và C···Br đang thay đổi cùng lúc.", "O···H···C and C···Br change at the same time."),
             "[C:1]([H:5])([C:2]([H:6])[H:7])[C:3]([H:9])([H:10])[H:11].[O:12][H:13].[H:8].[Br:4]", [(12, 8, 1.3), (8, 2, 1.45), (1, 4, 2.4)], [(12, 4, 5.4)], []),
            ("products", T("Sản phẩm", "Products"), T("Propene, H₂O và Br⁻.", "Propene, H₂O and Br⁻."),
             "[C:1]([H:5])(=[C:2]([H:6])[H:7])[C:3]([H:9])([H:10])[H:11].[O:12]([H:13])[H:8].[Br-:4]", [], [(12, 2, 3.0), (1, 4, 3.6)], []),
        ],
    },
    "e1": {
        "type": T("Tách đơn phân tử (E1)", "Unimolecular elimination (E1)"),
        "note": T(
            "Giai đoạn 1 giống SN1 (tạo cacbocation). Giai đoạn 2: một phân tử H₂O lấy H ở C bên cạnh, tạo liên kết C=C.",
            "Stage 1 is the same as SN1 (carbocation). Stage 2: a water molecule removes an H from the neighbouring C, forming C=C.",
        ),
        "frames": [
            ("reactants", T("Chất đầu", "Reactants"), T("(CH₃)₃CBr và H₂O.", "(CH₃)₃CBr and water."),
             f"{TBU}[Br:5].{W1}", [], [(6, 10, 3.2)], [((1, 5), (5,))]),
            ("intermediate", T("Cacbocation", "Carbocation"), T("(CH₃)₃C⁺ phẳng và Br⁻.", "Planar (CH₃)₃C⁺ and Br⁻."),
             f"{TBU_PLUS}.[Br-:5].{W1}", [], [(1, 5, 3.6), (6, 10, 2.2)], [((6,), (6, 10)), ((2, 10), (1, 2))]),
            ("products", T("Sản phẩm", "Products"), T("2-Methylpropene, H₃O⁺ và Br⁻.", "2-Methylpropene, H₃O⁺ and Br⁻."),
             "[C:1](=[C:2]([H:11])[H:12])([C:3]([H:13])([H:14])[H:15])[C:4]([H:16])([H:17])[H:18].[Br-:5].[O+:6]([H:7])([H:8])[H:10]", [], [(6, 2, 2.9), (1, 5, 4.0)], []),
        ],
    },
    "markovnikov": {
        "type": T("Cộng electrophin theo quy tắc Markovnikov", "Electrophilic addition (Markovnikov's rule)"),
        "note": T(
            "H⁺ cộng vào C đầu mạch tạo cacbocation bậc hai (bền hơn cacbocation bậc một), sau đó Br⁻ cộng vào C mang điện dương.",
            "H⁺ adds to the terminal carbon, giving the secondary carbocation (more stable than primary); Br⁻ then adds to the positive carbon.",
        ),
        "frames": [
            ("reactants", T("Chất đầu", "Reactants"), T("Liên kết π của propene tấn công H của HBr.", "The π bond of propene attacks the H of HBr."),
             "[C:1]([H:4])([H:5])=[C:2]([H:6])[C:3]([H:7])([H:8])[H:9].[H:10][Br:11]", [], [(10, 1, 2.3), (11, 2, 3.6)],
             [((1, 2), (1, 10)), ((10, 11), (11,))]),
            ("intermediate", T("Cacbocation bậc hai", "Secondary carbocation"), T("CH₃–C⁺H–CH₃ và Br⁻.", "CH₃–C⁺H–CH₃ and Br⁻."),
             "[C:1]([H:4])([H:5])([H:10])[C+:2]([H:6])[C:3]([H:7])([H:8])[H:9].[Br-:11]", [], [(11, 2, 3.0)], [((11,), (11, 2))]),
            ("products", T("Sản phẩm", "Product"), T("2-Bromopropane (sản phẩm chính).", "2-Bromopropane (major product)."),
             "[C:1]([H:4])([H:5])([H:10])[C:2]([H:6])([Br:11])[C:3]([H:7])([H:8])[H:9]", [], [], []),
        ],
    },
    "bromination": {
        "type": T("Cộng brom vào anken qua ion bromoni", "Bromine addition via a bromonium ion"),
        "note": T(
            "Br₂ bị phân cực khi tiến gần liên kết π, tạo ion bromoni vòng ba cạnh; Br⁻ tấn công từ phía đối diện (cộng anti).",
            "Br₂ is polarised near the π bond and forms a three-membered bromonium ion; Br⁻ attacks from the opposite face (anti addition).",
        ),
        "frames": [
            ("reactants", T("Chất đầu", "Reactants"), T("Br₂ tiến đến liên kết π của ethene.", "Br₂ approaches the π bond of ethene."),
             "[C:1]([H:3])([H:4])=[C:2]([H:5])[H:6].[Br:7][Br:8]", [], [(7, 1, 2.9), (7, 2, 2.9), (8, 1, 5.1)],
             [((1, 2), (7,)), ((7, 8), (8,))]),
            ("intermediate", T("Ion bromoni", "Bromonium ion"), T("Vòng C–C–Br⁺ và ion Br⁻ ở phía đối diện.", "C–C–Br⁺ ring with Br⁻ on the opposite face."),
             "[C:1]1([H:3])([H:4])[C:2]([H:5])([H:6])[Br+:7]1.[Br-:8]", [], [(8, 2, 3.0), (8, 7, 4.7)], [((8,), (8, 2)), ((2, 7), (7,))]),
            ("products", T("Sản phẩm", "Product"), T("1,2-Đibromoethane.", "1,2-Dibromoethane."),
             "[C:1]([H:3])([H:4])([Br:7])[C:2]([H:5])([H:6])[Br:8]", [], [], []),
        ],
    },
    "chlorination": {
        "type": T("Thế gốc tự do (phản ứng dây chuyền)", "Free-radical substitution (chain reaction)"),
        "note": T(
            "Khơi mào: ánh sáng bẻ gãy Cl₂ thành hai gốc Cl•. Phát triển mạch: Cl• + CH₄ → HCl + •CH₃; •CH₃ + Cl₂ → CH₃Cl + Cl•. Tắt mạch: hai gốc kết hợp. Hình dùng hai phân tử Cl₂ để thấy mạch được duy trì.",
            "Initiation: light splits Cl₂ into two Cl• radicals. Propagation: Cl• + CH₄ → HCl + •CH₃; •CH₃ + Cl₂ → CH₃Cl + Cl•. Termination: two radicals combine. Two Cl₂ molecules are shown so the chain can be followed.",
        ),
        "frames": [
            ("reactants", T("Chất đầu", "Reactants"), T("CH₄ và hai phân tử Cl₂; chiếu sáng (hν).", "CH₄ and two Cl₂ molecules; light (hν)."),
             "[Cl:1][Cl:2].[C:3]([H:4])([H:5])([H:6])[H:7].[Cl:8][Cl:9]", [], [(1, 7, 3.3), (3, 8, 4.2)], [((1, 2), (1,)), ((1, 2), (2,))]),
            ("intermediate", T("Khơi mào mạch", "Initiation"), T("Cl₂ → 2Cl• (gốc tự do).", "Cl₂ → 2Cl• (radicals)."),
             "[Cl:1].[Cl:2].[C:3]([H:4])([H:5])([H:6])[H:7].[Cl:8][Cl:9]", [], [(1, 7, 2.3), (3, 8, 4.2), (2, 1, 4.0)], [((1,), (1, 7)), ((3, 7), (3,))]),
            ("intermediate", T("Phát triển mạch (1)", "Propagation (1)"), T("Cl• lấy một H của CH₄ tạo HCl và gốc •CH₃.", "Cl• takes an H from CH₄, giving HCl and the •CH₃ radical."),
             "[Cl:1][H:7].[Cl:2].[C:3]([H:4])([H:5])[H:6].[Cl:8][Cl:9]", [], [(3, 8, 2.8), (2, 1, 4.5)], [((3,), (3, 8)), ((8, 9), (9,))]),
            ("intermediate", T("Phát triển mạch (2)", "Propagation (2)"), T("•CH₃ lấy một Cl của Cl₂ tạo CH₃Cl và gốc Cl• mới.", "•CH₃ takes a Cl from Cl₂, giving CH₃Cl and a new Cl•."),
             "[Cl:1][H:7].[Cl:2].[C:3]([H:4])([H:5])([H:6])[Cl:8].[Cl:9]", [], [(9, 2, 3.2)], [((9,), (9, 2)), ((2,), (9, 2))]),
            ("products", T("Tắt mạch", "Termination"), T("Hai gốc Cl• kết hợp. Tổng: CH₄ + Cl₂ → CH₃Cl + HCl.", "Two Cl• combine. Overall: CH₄ + Cl₂ → CH₃Cl + HCl."),
             "[Cl:1][H:7].[Cl:2][Cl:9].[C:3]([H:4])([H:5])([H:6])[Cl:8]", [], [], []),
        ],
    },
    "fischer": {
        "type": T("Ester hóa Fischer (xúc tác axit)", "Fischer esterification (acid catalysed)"),
        "note": T(
            "Các bước: proton hóa nhóm C=O → alcohol tấn công tạo trung gian tứ diện → chuyển proton → tách H₂O → tách proton. Oxygen của nhóm OH trong axit đi vào H₂O; oxygen của alcohol ở lại trong ester (đã được kiểm chứng bằng đồng vị ¹⁸O). Bước chuyển proton thực tế diễn ra qua dung môi.",
            "Steps: protonation of C=O → the alcohol adds to give a tetrahedral intermediate → proton transfer → loss of water → deprotonation. The acid's OH oxygen ends up in water; the alcohol oxygen stays in the ester (shown by ¹⁸O labelling). The proton transfer actually goes through the solvent.",
        ),
        "frames": [
            ("reactants", T("Chất đầu", "Reactants"), T("CH₃COOH, C₂H₅OH và H₃O⁺ (xúc tác).", "CH₃COOH, C₂H₅OH and H₃O⁺ (catalyst)."),
             "[C:1]([H:10])([H:11])([H:12])[C:2](=[O:3])[O:4][H:13].[O:5]([H:14])[C:6]([H:15])([H:16])[C:7]([H:17])([H:18])[H:19].[O+:8]([H:20])([H:21])[H:22]",
             [], [(3, 22, 1.8), (5, 2, 3.3)], [((3,), (3, 22)), ((8, 22), (8,))]),
            ("intermediate", T("Proton hóa nhóm cacbonyl", "Protonated carbonyl"), T("C của nhóm C=O⁺H trở nên dương điện hơn.", "The carbon of C=O⁺H becomes more positive."),
             "[C:1]([H:10])([H:11])([H:12])[C:2](=[O+:3][H:22])[O:4][H:13].[O:5]([H:14])[C:6]([H:15])([H:16])[C:7]([H:17])([H:18])[H:19].[O:8]([H:20])[H:21]",
             [], [(5, 2, 2.6)], [((5,), (5, 2)), ((2, 3), (3,))]),
            ("intermediate", T("Trung gian tứ diện", "Tetrahedral intermediate"), T("Alcohol đã liên kết với C; O của alcohol mang điện dương.", "The alcohol has bonded to C; its oxygen is positive."),
             "[C:1]([H:10])([H:11])([H:12])[C:2]([O:3][H:22])([O:4][H:13])[O+:5]([H:14])[C:6]([H:15])([H:16])[C:7]([H:17])([H:18])[H:19].[O:8]([H:20])[H:21]",
             [], [(8, 14, 2.2)], [((4,), (4, 14)), ((5, 14), (5,))]),
            ("intermediate", T("Chuyển proton", "Proton transfer"), T("H chuyển từ O của alcohol sang nhóm OH, tạo nhóm –OH₂⁺ dễ tách.", "H moves from the alcohol oxygen to the OH group, making a good –OH₂⁺ leaving group."),
             "[C:1]([H:10])([H:11])([H:12])[C:2]([O:3][H:22])([O+:4]([H:13])[H:14])[O:5][C:6]([H:15])([H:16])[C:7]([H:17])([H:18])[H:19].[O:8]([H:20])[H:21]",
             [], [(8, 22, 3.0)], [((3, 22), (2, 3)), ((2, 4), (4,))]),
            ("intermediate", T("Tách nước", "Loss of water"), T("H₂O tách ra; còn lại ester bị proton hóa.", "Water leaves; the protonated ester remains."),
             "[C:1]([H:10])([H:11])([H:12])[C:2](=[O+:3][H:22])[O:5][C:6]([H:15])([H:16])[C:7]([H:17])([H:18])[H:19].[O:4]([H:13])[H:14].[O:8]([H:20])[H:21]",
             [], [(8, 22, 1.8), (4, 2, 3.2)], [((8,), (8, 22)), ((3, 22), (3,))]),
            ("products", T("Sản phẩm", "Products"), T("Ethyl acetate, H₂O; H₃O⁺ được tái tạo (xúc tác).", "Ethyl acetate and water; H₃O⁺ is regenerated (catalyst)."),
             "[C:1]([H:10])([H:11])([H:12])[C:2](=[O:3])[O:5][C:6]([H:15])([H:16])[C:7]([H:17])([H:18])[H:19].[O:4]([H:13])[H:14].[O+:8]([H:20])([H:21])[H:22]",
             [], [(8, 3, 2.8), (4, 2, 3.6)], []),
        ],
    },
    "saponification": {
        "type": T("Thủy phân ester trong môi trường kiềm (BAc2)", "Base hydrolysis of an ester (BAc2)"),
        "note": T(
            "OH⁻ cộng vào C=O tạo trung gian tứ diện; ion C₂H₅O⁻ bị tách ra; cuối cùng chuyển proton tạo ion carboxylate (bước này làm phản ứng xảy ra hoàn toàn).",
            "OH⁻ adds to C=O giving a tetrahedral intermediate; C₂H₅O⁻ leaves; a final proton transfer gives the carboxylate (this makes the reaction go to completion).",
        ),
        "frames": [
            ("reactants", T("Chất đầu", "Reactants"), T("Ethyl acetate và OH⁻.", "Ethyl acetate and OH⁻."),
             "[C:1]([H:10])([H:11])([H:12])[C:2](=[O:3])[O:4][C:5]([H:13])([H:14])[C:6]([H:15])([H:16])[H:17].[O-:7][H:18]", [], [(7, 2, 2.9)],
             [((7,), (7, 2)), ((2, 3), (3,))]),
            ("intermediate", T("Trung gian tứ diện", "Tetrahedral intermediate"), T("C liên kết với 4 nhóm; O mang điện âm.", "C bonded to four groups; O is negative."),
             "[C:1]([H:10])([H:11])([H:12])[C:2]([O-:3])([O:4][C:5]([H:13])([H:14])[C:6]([H:15])([H:16])[H:17])[O:7][H:18]", [], [],
             [((3,), (2, 3)), ((2, 4), (4,))]),
            ("intermediate", T("Tách ion alkoxide", "Alkoxide leaves"), T("Tạo CH₃COOH và C₂H₅O⁻.", "CH₃COOH and C₂H₅O⁻ form."),
             "[C:1]([H:10])([H:11])([H:12])[C:2](=[O:3])[O:7][H:18].[O-:4][C:5]([H:13])([H:14])[C:6]([H:15])([H:16])[H:17]", [], [(4, 18, 1.8)],
             [((4,), (4, 18)), ((7, 18), (7,))]),
            ("products", T("Sản phẩm", "Products"), T("Ion acetate và ethanol.", "Acetate ion and ethanol."),
             "[C:1]([H:10])([H:11])([H:12])[C:2](=[O:3])[O-:7].[O:4]([H:18])[C:5]([H:13])([H:14])[C:6]([H:15])([H:16])[H:17]", [], [(4, 7, 3.2)], []),
        ],
    },
}

# ──────────────────────────────── reactions ────────────────────────────────
# equation: list of (coef, formula) per side; formulas use the app's notation (H3O^+, Cu^2+).
NO_MECH_COMBUSTION = T(
    "Cơ chế đốt cháy là chuỗi phản ứng gốc tự do gồm hàng chục bước sơ cấp; không hiển thị.",
    "Combustion proceeds through chains of dozens of radical elementary steps; not shown.",
)
NO_MECH_SIMPLE = T(
    "Chỉ hiển thị phương trình tổng; cơ chế ở mức phân tử không thuộc phạm vi thư viện.",
    "Only the overall equation is shown; the molecular mechanism is outside the library's scope.",
)

REACTIONS = [
    # Combustion / synthesis
    dict(id="h2-o2", cat="synthesis", level="10", name=T("Tổng hợp nước (đốt cháy hydrogen)", "Synthesis of water (burning hydrogen)"),
         lhs=[(2, "H2"), (1, "O2")], rhs=[(2, "H2O")], cond=T("Đốt cháy (t°) hoặc tia lửa điện", "Ignition (heat or spark)"),
         obs=T("Cháy với ngọn lửa xanh nhạt, tỏa nhiều nhiệt.", "Burns with a pale blue flame, very exothermic."), src=["sgk10"], mech=None, why=NO_MECH_COMBUSTION),
    dict(id="ch4-combustion", cat="combustion", level="11", name=T("Đốt cháy methane", "Combustion of methane"),
         lhs=[(1, "CH4"), (2, "O2")], rhs=[(1, "CO2"), (2, "H2O")], cond=T("Đốt cháy (t°)", "Ignition"),
         obs=T("Tỏa nhiều nhiệt; dùng làm nhiên liệu.", "Highly exothermic; used as a fuel."), src=["sgk11"], mech=None, why=NO_MECH_COMBUSTION),
    dict(id="c2h5oh-combustion", cat="combustion", level="11", name=T("Đốt cháy ethanol", "Combustion of ethanol"),
         lhs=[(1, "C2H5OH"), (3, "O2")], rhs=[(2, "CO2"), (3, "H2O")], cond=T("Đốt cháy (t°)", "Ignition"),
         obs=T("Ngọn lửa xanh, không khói.", "Blue, smokeless flame."), src=["sgk11"], mech=None, why=NO_MECH_COMBUSTION),
    dict(id="c3h8-combustion", cat="combustion", level="11", name=T("Đốt cháy propane", "Combustion of propane"),
         lhs=[(1, "C3H8"), (5, "O2")], rhs=[(3, "CO2"), (4, "H2O")], cond=T("Đốt cháy (t°)", "Ignition"),
         obs=T("Thành phần chính của khí đốt hóa lỏng (LPG).", "Main component of LPG."), src=["sgk11"], mech=None, why=NO_MECH_COMBUSTION),
    # Acid–base, precipitation
    dict(id="neutralization", cat="acidBase", level="11", name=T("Phản ứng trung hòa", "Neutralisation"),
         lhs=[(1, "H3O^+"), (1, "OH^-")], rhs=[(2, "H2O")], cond=T("Dung dịch nước, nhiệt độ thường", "Aqueous solution, room temperature"),
         obs=T("Phương trình ion thu gọn của mọi phản ứng axit mạnh + bazơ mạnh, ví dụ HCl + NaOH → NaCl + H₂O.", "Net ionic equation of every strong acid + strong base reaction, e.g. HCl + NaOH → NaCl + H₂O."),
         src=["sgk11", "atkins"], mech="neutralization", why=None),
    dict(id="hcl-naoh", cat="acidBase", level="11", name=T("HCl tác dụng với NaOH", "HCl with NaOH"),
         lhs=[(1, "HCl"), (1, "NaOH")], rhs=[(1, "NaCl"), (1, "H2O")], cond=T("Dung dịch nước", "Aqueous solution"),
         obs=T("Tỏa nhiệt; dung dịch sau phản ứng trung tính (pH = 7 khi đủ lượng).", "Exothermic; the final solution is neutral (pH 7 at equivalence)."), src=["sgk11"], mech=None,
         why=T("Xem cơ chế ở phản ứng “Phản ứng trung hòa” (phương trình ion thu gọn).", "See the mechanism under “Neutralisation” (net ionic equation).")),
    dict(id="agcl", cat="precipitation", level="11", name=T("Tạo kết tủa AgCl", "Precipitation of AgCl"),
         lhs=[(1, "AgNO3"), (1, "NaCl")], rhs=[(1, "AgCl"), (1, "NaNO3")], cond=T("Dung dịch nước", "Aqueous solution"),
         obs=T("Kết tủa trắng AgCl (dùng nhận biết ion Cl⁻).", "White precipitate of AgCl (test for Cl⁻)."), src=["sgk10"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="baso4", cat="precipitation", level="10", name=T("Tạo kết tủa BaSO₄", "Precipitation of BaSO₄"),
         lhs=[(1, "BaCl2"), (1, "H2SO4")], rhs=[(1, "BaSO4"), (2, "HCl")], cond=T("Dung dịch nước", "Aqueous solution"),
         obs=T("Kết tủa trắng BaSO₄ (dùng nhận biết ion SO₄²⁻).", "White precipitate of BaSO₄ (test for SO₄²⁻)."), src=["sgk10"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="caco3-hcl", cat="acidBase", level="11", name=T("Đá vôi tác dụng với axit HCl", "Limestone with hydrochloric acid"),
         lhs=[(1, "CaCO3"), (2, "HCl")], rhs=[(1, "CaCl2"), (1, "CO2"), (1, "H2O")], cond=T("Nhiệt độ thường", "Room temperature"),
         obs=T("Sủi bọt khí CO₂.", "Fizzing: CO₂ is released."), src=["sgk11"], mech=None, why=NO_MECH_SIMPLE),
    # Redox, metals
    dict(id="zn-hcl", cat="redox", level="10", name=T("Kẽm tác dụng với axit HCl", "Zinc with hydrochloric acid"),
         lhs=[(1, "Zn"), (2, "HCl")], rhs=[(1, "ZnCl2"), (1, "H2")], cond=T("Nhiệt độ thường", "Room temperature"),
         obs=T("Kẽm tan, có bọt khí H₂.", "Zinc dissolves; H₂ bubbles form."), src=["sgk10"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="fe-cuso4", cat="redox", level="12", name=T("Sắt đẩy đồng khỏi dung dịch CuSO₄", "Iron displaces copper from CuSO₄"),
         lhs=[(1, "Fe"), (1, "CuSO4")], rhs=[(1, "FeSO4"), (1, "Cu")], cond=T("Dung dịch nước", "Aqueous solution"),
         obs=T("Có lớp đồng màu đỏ bám trên sắt; màu xanh của dung dịch nhạt dần.", "Red copper coats the iron; the blue colour fades."), src=["sgk12"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="daniell", cat="redox", level="12", name=T("Pin Daniell (Zn–Cu)", "Daniell cell (Zn–Cu)"),
         lhs=[(1, "Zn"), (1, "Cu^2+")], rhs=[(1, "Zn^2+"), (1, "Cu")], cond=T("Pin điện hóa, hai dung dịch nối bằng cầu muối", "Galvanic cell with a salt bridge"),
         obs=T("Electron đi từ cực Zn (anode) sang cực Cu (cathode) qua dây dẫn.", "Electrons flow from the Zn anode to the Cu cathode through the wire."), src=["sgk12"], mech=None,
         why=T("Là phản ứng trao đổi electron qua điện cực, không có cơ chế ở mức phân tử để hiển thị.", "An electron transfer through electrodes; there is no molecular mechanism to show.")),
    dict(id="na-h2o", cat="redox", level="10", name=T("Natri tác dụng với nước", "Sodium with water"),
         lhs=[(2, "Na"), (2, "H2O")], rhs=[(2, "NaOH"), (1, "H2")], cond=T("Nhiệt độ thường (phản ứng mãnh liệt)", "Room temperature (vigorous)"),
         obs=T("Natri chạy trên mặt nước, tan dần, có khí thoát ra.", "Sodium darts on the surface and dissolves; gas is released."), src=["sgk10"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="kmno4-hcl", cat="redox", level="10", name=T("Điều chế Cl₂ từ KMnO₄ và HCl đặc", "Cl₂ from KMnO₄ and concentrated HCl"),
         lhs=[(2, "KMnO4"), (16, "HCl")], rhs=[(2, "KCl"), (2, "MnCl2"), (5, "Cl2"), (8, "H2O")], cond=T("HCl đặc, nhiệt độ thường", "Concentrated HCl, room temperature"),
         obs=T("Khí Cl₂ màu vàng lục thoát ra.", "Yellow-green Cl₂ gas is released."), src=["sgk10"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="mno2-hcl", cat="redox", level="10", name=T("Điều chế Cl₂ từ MnO₂ và HCl đặc", "Cl₂ from MnO₂ and concentrated HCl"),
         lhs=[(1, "MnO2"), (4, "HCl")], rhs=[(1, "MnCl2"), (1, "Cl2"), (2, "H2O")], cond=T("HCl đặc, đun nóng", "Concentrated HCl, heating"),
         obs=T("Khí Cl₂ màu vàng lục thoát ra.", "Yellow-green Cl₂ gas is released."), src=["sgk10"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="cu-hno3-conc", cat="redox", level="11", name=T("Đồng tác dụng với HNO₃ đặc", "Copper with concentrated HNO₃"),
         lhs=[(1, "Cu"), (4, "HNO3")], rhs=[(1, "Cu(NO3)2"), (2, "NO2"), (2, "H2O")], cond=T("HNO₃ đặc", "Concentrated HNO₃"),
         obs=T("Khí NO₂ màu nâu đỏ; dung dịch chuyển xanh.", "Red-brown NO₂ gas; the solution turns blue."), src=["sgk11"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="cu-hno3-dil", cat="redox", level="11", name=T("Đồng tác dụng với HNO₃ loãng", "Copper with dilute HNO₃"),
         lhs=[(3, "Cu"), (8, "HNO3")], rhs=[(3, "Cu(NO3)2"), (2, "NO"), (4, "H2O")], cond=T("HNO₃ loãng", "Dilute HNO₃"),
         obs=T("Khí NO không màu, hóa nâu trong không khí.", "Colourless NO, turning brown in air."), src=["sgk11"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="fe2o3-co", cat="redox", level="12", name=T("Khử Fe₂O₃ bằng CO (lò cao)", "Reduction of Fe₂O₃ by CO (blast furnace)"),
         lhs=[(1, "Fe2O3"), (3, "CO")], rhs=[(2, "Fe"), (3, "CO2")], cond=T("Nhiệt độ cao (lò cao)", "High temperature (blast furnace)"),
         obs=T("Phản ứng chính trong luyện gang.", "Main reaction in iron making."), src=["sgk12"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="thermite", cat="redox", level="12", name=T("Phản ứng nhiệt nhôm", "Thermite reaction"),
         lhs=[(2, "Al"), (1, "Fe2O3")], rhs=[(1, "Al2O3"), (2, "Fe")], cond=T("Nhiệt độ cao (mồi bằng dây Mg)", "High temperature (Mg ribbon fuse)"),
         obs=T("Tỏa rất nhiều nhiệt, sắt nóng chảy.", "Very exothermic; molten iron forms."), src=["sgk12"], mech=None, why=NO_MECH_SIMPLE),
    # Decomposition
    dict(id="caco3-decomp", cat="decomposition", level="10", name=T("Nhiệt phân đá vôi", "Thermal decomposition of limestone"),
         lhs=[(1, "CaCO3")], rhs=[(1, "CaO"), (1, "CO2")], cond=T("Nung nóng (khoảng 900 °C)", "Heating (about 900 °C)"),
         obs=T("Sản xuất vôi sống.", "Production of quicklime."), src=["sgk10"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="h2o2-decomp", cat="decomposition", level="10", name=T("Phân hủy H₂O₂ (xúc tác MnO₂)", "Decomposition of H₂O₂ (MnO₂ catalyst)"),
         lhs=[(2, "H2O2")], rhs=[(2, "H2O"), (1, "O2")], cond=T("Xúc tác MnO₂, nhiệt độ thường", "MnO₂ catalyst, room temperature"),
         obs=T("Sủi bọt khí O₂; ví dụ về ảnh hưởng của chất xúc tác đến tốc độ phản ứng.", "O₂ bubbles; an example of catalysis."), src=["sgk10"], mech=None,
         why=T("Cơ chế trên bề mặt xúc tác MnO₂ chưa được xác lập đơn giản; không hiển thị.", "The surface mechanism on MnO₂ has no simple established description; not shown.")),
    dict(id="nh4cl-decomp", cat="decomposition", level="11", name=T("Nhiệt phân NH₄Cl", "Thermal decomposition of NH₄Cl"),
         lhs=[(1, "NH4Cl")], rhs=[(1, "NH3"), (1, "HCl")], cond=T("Đun nóng; phản ứng thuận nghịch khi làm lạnh", "Heating; reverses on cooling"), rev=True,
         obs=T("NH₄Cl “thăng hoa” rồi tái tạo ở chỗ lạnh.", "NH₄Cl seems to sublime and reforms where it is cool."), src=["sgk11"], mech=None, why=NO_MECH_SIMPLE),
    # Equilibria (industry)
    dict(id="haber", cat="equilibrium", level="11", name=T("Tổng hợp ammonia (Haber)", "Ammonia synthesis (Haber)"),
         lhs=[(1, "N2"), (3, "H2")], rhs=[(2, "NH3")], rev=True, cond=T("Xúc tác Fe, 400–450 °C, 200 bar", "Fe catalyst, 400–450 °C, 200 bar"),
         obs=T("Phản ứng thuận tỏa nhiệt; tăng áp suất làm cân bằng chuyển dịch sang phải.", "Forward reaction is exothermic; higher pressure shifts the equilibrium to the right."), src=["sgk11"], mech=None,
         why=T("Cơ chế xúc tác bề mặt Fe gồm nhiều bước hấp phụ; không hiển thị.", "The surface mechanism on Fe has many adsorption steps; not shown.")),
    dict(id="contact", cat="equilibrium", level="11", name=T("Oxi hóa SO₂ thành SO₃ (phương pháp tiếp xúc)", "SO₂ → SO₃ (contact process)"),
         lhs=[(2, "SO2"), (1, "O2")], rhs=[(2, "SO3")], rev=True, cond=T("Xúc tác V₂O₅, 450 °C", "V₂O₅ catalyst, 450 °C"),
         obs=T("Giai đoạn chính trong sản xuất H₂SO₄.", "Key step in making H₂SO₄."), src=["sgk11"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="ostwald", cat="redox", level="11", name=T("Oxi hóa ammonia (Ostwald)", "Oxidation of ammonia (Ostwald)"),
         lhs=[(4, "NH3"), (5, "O2")], rhs=[(4, "NO"), (6, "H2O")], cond=T("Xúc tác Pt, khoảng 850 °C", "Pt catalyst, about 850 °C"),
         obs=T("Giai đoạn đầu sản xuất HNO₃.", "First step in making HNO₃."), src=["sgk11"], mech=None, why=NO_MECH_SIMPLE),
    # Organic
    dict(id="ch4-cl2", cat="organic", level="11", name=T("Thế chlorine vào methane", "Chlorination of methane"),
         lhs=[(1, "CH4"), (1, "Cl2")], rhs=[(1, "CH3Cl"), (1, "HCl")], cond=T("Ánh sáng (hν)", "Light (hν)"),
         obs=T("Màu vàng lục của Cl₂ nhạt dần. Có thể tiếp tục thế tạo CH₂Cl₂, CHCl₃, CCl₄.", "The yellow-green colour of Cl₂ fades. Further substitution gives CH₂Cl₂, CHCl₃, CCl₄."),
         src=["sgk11", "clayden_radical"], mech="chlorination", why=None),
    dict(id="c2h4-br2", cat="organic", level="11", name=T("Ethene làm mất màu nước brom", "Ethene decolourises bromine water"),
         lhs=[(1, "C2H4"), (1, "Br2")], rhs=[(1, "C2H4Br2")], cond=T("Nhiệt độ thường", "Room temperature"),
         obs=T("Dung dịch brom mất màu (nhận biết anken).", "Bromine is decolourised (test for alkenes)."), src=["sgk11", "clayden_add"], mech="bromination", why=None),
    dict(id="propene-hbr", cat="organic", level="11", name=T("Cộng HBr vào propene (quy tắc Markovnikov)", "HBr addition to propene (Markovnikov)"),
         lhs=[(1, "C3H6"), (1, "HBr")], rhs=[(1, "C3H7Br")], cond=T("Nhiệt độ thường", "Room temperature"),
         obs=T("Sản phẩm chính: 2-bromopropane; sản phẩm phụ: 1-bromopropane.", "Major product: 2-bromopropane; minor: 1-bromopropane."), src=["sgk11", "clayden_add"], mech="markovnikov", why=None),
    dict(id="c2h4-h2", cat="organic", level="11", name=T("Hydrogen hóa ethene", "Hydrogenation of ethene"),
         lhs=[(1, "C2H4"), (1, "H2")], rhs=[(1, "C2H6")], cond=T("Xúc tác Ni, đun nóng", "Ni catalyst, heating"),
         obs=T("Anken chuyển thành ankan.", "The alkene becomes an alkane."), src=["sgk11"], mech=None,
         why=T("Cơ chế trên bề mặt kim loại xúc tác; không hiển thị.", "Surface mechanism on the metal catalyst; not shown.")),
    dict(id="c2h4-h2o", cat="organic", level="11", name=T("Hydrat hóa ethene", "Hydration of ethene"),
         lhs=[(1, "C2H4"), (1, "H2O")], rhs=[(1, "C2H5OH")], cond=T("Xúc tác H₃PO₄ (hoặc H₂SO₄), đun nóng, áp suất cao", "H₃PO₄ (or H₂SO₄) catalyst, heat, high pressure"),
         obs=T("Điều chế ethanol trong công nghiệp.", "Industrial ethanol production."), src=["sgk11"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="sn2-ch3br", cat="organic", level="11", name=T("Thủy phân CH₃Br bằng OH⁻ (SN2)", "Hydrolysis of CH₃Br by OH⁻ (SN2)"),
         lhs=[(1, "CH3Br"), (1, "OH^-")], rhs=[(1, "CH3OH"), (1, "Br^-")], cond=T("Dung dịch NaOH, đun nóng", "NaOH solution, heating"),
         obs=T("Dẫn xuất halogen bậc một phản ứng theo cơ chế SN2.", "Primary halides react by SN2."), src=["sgk11", "clayden_sub"], mech="sn2", why=None),
    dict(id="sn1-tbubr", cat="organic", level="11", name=T("Thủy phân (CH₃)₃CBr trong nước (SN1)", "Hydrolysis of (CH₃)₃CBr in water (SN1)"),
         lhs=[(1, "C4H9Br"), (2, "H2O")], rhs=[(1, "C4H9OH"), (1, "H3O^+"), (1, "Br^-")], cond=T("Dung môi nước (phân cực, protic)", "Water (polar protic solvent)"),
         obs=T("Dẫn xuất halogen bậc ba phản ứng theo cơ chế SN1. Tương đương: (CH₃)₃CBr + H₂O → (CH₃)₃COH + HBr.", "Tertiary halides react by SN1. Equivalent to (CH₃)₃CBr + H₂O → (CH₃)₃COH + HBr."),
         src=["clayden_sub"], mech="sn1", why=None),
    dict(id="e2-ipbr", cat="organic", level="11", name=T("Tách HBr khỏi 2-bromopropane (E2)", "Elimination of HBr from 2-bromopropane (E2)"),
         lhs=[(1, "C3H7Br"), (1, "OH^-")], rhs=[(1, "C3H6"), (1, "H2O"), (1, "Br^-")], cond=T("KOH trong ethanol, đun nóng", "KOH in ethanol, heating"),
         obs=T("Tạo propene. Trong nước (không có ethanol) phản ứng thế cạnh tranh mạnh hơn.", "Gives propene. In water (no ethanol) substitution competes more."), src=["sgk11", "clayden_elim"], mech="e2", why=None),
    dict(id="e1-tbubr", cat="organic", level="11", name=T("Tách HBr khỏi (CH₃)₃CBr (E1)", "Elimination of HBr from (CH₃)₃CBr (E1)"),
         lhs=[(1, "C4H9Br"), (1, "H2O")], rhs=[(1, "C4H8"), (1, "H3O^+"), (1, "Br^-")], cond=T("Đun nóng trong dung môi phân cực", "Heating in a polar solvent"),
         obs=T("Cạnh tranh với SN1; nhiệt độ cao ưu tiên tách.", "Competes with SN1; higher temperature favours elimination."), src=["clayden_elim"], mech="e1", why=None),
    dict(id="esterification", cat="organic", level="12", name=T("Ester hóa: CH₃COOH + C₂H₅OH", "Esterification: CH₃COOH + C₂H₅OH"),
         lhs=[(1, "CH3COOH"), (1, "C2H5OH")], rhs=[(1, "CH3COOC2H5"), (1, "H2O")], rev=True, cond=T("H₂SO₄ đặc (xúc tác), đun nóng", "Concentrated H₂SO₄ (catalyst), heating"),
         obs=T("Ethyl acetate có mùi thơm; phản ứng thuận nghịch.", "Ethyl acetate smells fruity; the reaction is reversible."), src=["sgk12", "clayden_carbonyl"], mech="fischer", why=None),
    dict(id="saponification", cat="organic", level="12", name=T("Thủy phân ethyl acetate trong NaOH", "Hydrolysis of ethyl acetate in NaOH"),
         lhs=[(1, "CH3COOC2H5"), (1, "OH^-")], rhs=[(1, "CH3COO^-"), (1, "C2H5OH")], cond=T("Dung dịch NaOH, đun nóng", "NaOH solution, heating"),
         obs=T("Phản ứng một chiều (xà phòng hóa).", "Goes to completion (saponification)."), src=["sgk12", "clayden_carbonyl"], mech="saponification", why=None),
    dict(id="fermentation", cat="organic", level="12", name=T("Lên men rượu từ glucose", "Alcoholic fermentation of glucose"),
         lhs=[(1, "C6H12O6")], rhs=[(2, "C2H5OH"), (2, "CO2")], cond=T("Enzyme của nấm men, 30–35 °C", "Yeast enzymes, 30–35 °C"),
         obs=T("Có khí CO₂ thoát ra.", "CO₂ is released."), src=["sgk12"], mech=None,
         why=T("Chuỗi đường phân và lên men gồm nhiều bước enzyme; không hiển thị.", "Glycolysis and fermentation involve many enzyme steps; not shown.")),
    dict(id="silver-mirror", cat="organic", level="11", name=T("Phản ứng tráng bạc của acetaldehyde", "Silver mirror test (acetaldehyde)"),
         lhs=[(1, "CH3CHO"), (2, "AgNO3"), (3, "NH3"), (1, "H2O")], rhs=[(1, "CH3COONH4"), (2, "Ag"), (2, "NH4NO3")], cond=T("Dung dịch AgNO₃/NH₃, đun nhẹ", "AgNO₃ in aqueous NH₃, gentle warming"),
         obs=T("Lớp bạc sáng bám trên thành ống nghiệm.", "A shiny silver layer coats the tube."), src=["sgk11"], mech=None, why=NO_MECH_SIMPLE),
    dict(id="etoh-cuo", cat="organic", level="11", name=T("Oxi hóa ethanol bằng CuO", "Oxidation of ethanol by CuO"),
         lhs=[(1, "C2H5OH"), (1, "CuO")], rhs=[(1, "CH3CHO"), (1, "Cu"), (1, "H2O")], cond=T("Đun nóng", "Heating"),
         obs=T("CuO màu đen chuyển thành Cu màu đỏ.", "Black CuO turns into red Cu."), src=["sgk11"], mech=None, why=NO_MECH_SIMPLE),
]

# ─────────────────────────────── geometry ───────────────────────────────


def parse_mapped(smiles: str) -> Chem.Mol:
    params = Chem.SmilesParserParams()
    params.removeHs = False
    mol = Chem.MolFromSmiles(smiles, params)
    if mol is None:
        raise ValueError(f"bad SMILES {smiles}")
    for a in mol.GetAtoms():
        if a.GetAtomMapNum() == 0:
            raise ValueError(f"unmapped atom {a.GetSymbol()} in {smiles}")
        a.SetNoImplicit(True)
    Chem.SanitizeMol(mol)
    return mol


def embed_fragment(frag: Chem.Mol) -> np.ndarray:
    n = frag.GetNumAtoms()
    if n == 1:
        return np.zeros((1, 3))
    m = Chem.Mol(frag)
    m.UpdatePropertyCache(strict=False)
    Chem.GetSymmSSSR(m)  # fragments come unsanitised: ring info is needed by the force fields
    p = AllChem.ETKDGv3()
    p.randomSeed = 7
    if AllChem.EmbedMolecule(m, p) != 0:
        p.useRandomCoords = True
        if AllChem.EmbedMolecule(m, p) != 0:
            raise RuntimeError(f"embed failed: {Chem.MolToSmiles(frag)}")
    try:
        if AllChem.MMFFHasAllMoleculeParams(m):
            AllChem.MMFFOptimizeMolecule(m, maxIters=2000)
        elif AllChem.UFFHasAllMoleculeParams(m):
            AllChem.UFFOptimizeMolecule(m, maxIters=2000)
    except Exception:  # noqa: BLE001 - keep the ETKDG geometry
        pass
    conf = m.GetConformer()
    return np.array([list(conf.GetAtomPosition(i)) for i in range(n)])


def place(mol: Chem.Mol, contacts):
    """Rigid-body placement of fragments so that contact distances are met without clashes."""
    frags = Chem.GetMolFrags(mol, asMols=False, sanitizeFrags=False)
    frag_mols = Chem.GetMolFrags(mol, asMols=True, sanitizeFrags=False)
    local = []
    for idxs, fm in zip(frags, frag_mols):
        xyz = embed_fragment(fm)
        local.append(xyz - xyz.mean(axis=0))
    mapidx = {a.GetAtomMapNum(): a.GetIdx() for a in mol.GetAtoms()}
    owner = {}
    for f, idxs in enumerate(frags):
        for k, i in enumerate(idxs):
            owner[i] = (f, k)
    heavy = np.array([a.GetAtomicNum() > 1 for a in mol.GetAtoms()])
    cons = [(mapidx[a], mapidx[b], d) for a, b, d in contacts]
    contact_pairs = {(min(i, j), max(i, j)) for i, j, _ in cons}
    nf = len(frags)

    def coords(x):
        out = np.zeros((mol.GetNumAtoms(), 3))
        for f, idxs in enumerate(frags):
            if f == 0:
                R, t = np.eye(3), np.zeros(3)
            else:
                p = x[6 * (f - 1): 6 * f]
                R = Rotation.from_rotvec(p[:3]).as_matrix()
                t = p[3:]
            pts = local[f] @ R.T + t
            for k, i in enumerate(idxs):
                out[i] = pts[k]
        return out

    def energy(x):
        c = coords(x)
        e = 0.0
        for i, j, d in cons:
            e += 10 * (np.linalg.norm(c[i] - c[j]) - d) ** 2
        for i in range(len(c)):
            for j in range(i + 1, len(c)):
                if owner[i][0] == owner[j][0] or (i, j) in contact_pairs:
                    continue
                dmin = 2.6 if heavy[i] and heavy[j] else 2.0 if (heavy[i] or heavy[j]) else 1.8
                d = np.linalg.norm(c[i] - c[j])
                if d < dmin:
                    e += 5 * (dmin - d) ** 2
        return e

    if nf == 1:
        return coords(np.zeros(0))
    rng = np.random.default_rng(11)
    best = None
    for attempt in range(24):
        x0 = np.concatenate([np.concatenate([rng.normal(size=3), rng.normal(size=3) * 3 + [4 * (f + 1), 0, 0]]) for f in range(nf - 1)])
        r = minimize(energy, x0, method="L-BFGS-B")
        if best is None or r.fun < best.fun:
            best = r
    return coords(best.x)


def kabsch(P, Q):
    """Rotation+translation that best maps P onto Q (both N×3)."""
    pc, qc = P.mean(axis=0), Q.mean(axis=0)
    H = (P - pc).T @ (Q - qc)
    U, _, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    D = np.diag([1, 1, d])
    R = Vt.T @ D @ U.T
    return R, qc - pc @ R.T


def build_mechanism(key: str):
    spec = MECHANISMS[key]
    frames = []
    prev = None
    for kind, label, desc, smiles, partial, contacts, arrows in spec["frames"]:
        mol = parse_mapped(smiles)
        xyz = place(mol, list(partial) + list(contacts))
        maps = [a.GetAtomMapNum() for a in mol.GetAtoms()]
        order = np.argsort(maps)
        xyz = xyz[order]
        maps_sorted = sorted(maps)
        if prev is not None:
            if maps_sorted != prev[0]:
                raise ValueError(f"{key}: atom maps differ between frames")
            R, t = kabsch(xyz, prev[1])
            xyz = xyz @ R.T + t
        else:
            xyz = xyz - xyz.mean(axis=0)
        prev = (maps_sorted, xyz)
        by_map = {a.GetAtomMapNum(): a for a in mol.GetAtoms()}
        atoms = []
        for k, m in enumerate(maps_sorted):
            a = by_map[m]
            atoms.append({
                "map": m,
                "el": a.GetSymbol(),
                "xyz": [round(float(v), 3) for v in xyz[k]],
                "charge": a.GetFormalCharge(),
                "radical": a.GetNumRadicalElectrons(),
            })
        bonds = [{
            "a": b.GetBeginAtom().GetAtomMapNum(),
            "b": b.GetEndAtom().GetAtomMapNum(),
            "order": int(b.GetBondTypeAsDouble()),
        } for b in mol.GetBonds()]
        frames.append({
            "kind": kind,
            "label": label,
            "description": desc,
            "atoms": atoms,
            "bonds": bonds,
            "partial": [{"a": a, "b": b} for a, b, _ in partial],
            "arrows": [{"from": list(f), "to": list(t)} for f, t in arrows],
            # Transition states carry partial charges only (atoms written neutral): the
            # total is stored so the app can show it, e.g. [HO···CH3···Br]‡⁻.
            "total_charge": frames[0]["total_charge"] if frames else sum(a["charge"] for a in atoms),
        })
    return {"type": spec["type"], "note": spec["note"], "frames": frames}


# ─────────────────────────────── validation ───────────────────────────────
EL = re.compile(r"([A-Z][a-z]?)(\d*)")


def formula_counts(f: str):
    body = re.sub(r"\^.*$", "", f)
    counts = {}

    def parse(s, mult):
        i = 0
        while i < len(s):
            if s[i] == "(":
                depth, j = 1, i + 1
                while depth:
                    depth += {"(": 1, ")": -1}.get(s[j], 0)
                    j += 1
                m = re.match(r"\d*", s[j:])
                k = int(m.group(0) or 1)
                parse(s[i + 1: j - 1], mult * k)
                i = j + len(m.group(0))
                continue
            m = EL.match(s, i)
            if not m:
                raise ValueError(f)
            counts[m.group(1)] = counts.get(m.group(1), 0) + mult * int(m.group(2) or 1)
            i = m.end()

    parse(body, 1)
    m = re.search(r"\^(\d*)([+-])$", f)
    charge = (int(m.group(1) or 1) * (1 if m.group(2) == "+" else -1)) if m else 0
    return counts, charge


def check_balance(r):
    tot = {}
    q = 0
    for sign, side in ((1, r["lhs"]), (-1, r["rhs"])):
        for coef, f in side:
            c, ch = formula_counts(f)
            for el, n in c.items():
                tot[el] = tot.get(el, 0) + sign * coef * n
            q += sign * coef * ch
    bad = {k: v for k, v in tot.items() if v}
    if bad or q:
        raise ValueError(f"{r['id']} not balanced: {bad} charge {q}")


def main() -> None:
    items = []
    for r in REACTIONS:
        check_balance(r)
        items.append({
            "id": r["id"],
            "category": r["cat"],
            "level": r["level"],
            "name": r["name"],
            "reactants": [{"coef": c, "formula": f} for c, f in r["lhs"]],
            "products": [{"coef": c, "formula": f} for c, f in r["rhs"]],
            "reversible": r.get("rev", False),
            "conditions": r["cond"],
            "observation": r["obs"],
            "sources": [SRC[s] for s in r["src"]],
            "mechanism": build_mechanism(r["mech"]) if r["mech"] else None,
            "no_mechanism_reason": r["why"],
            "review_status": "pending",
        })
    out = {
        "dataset": "reactions",
        "version": 1,
        "source": {
            "id": "curated",
            "citation": (
                "Thư viện phản ứng tuyển chọn theo SGK Hóa học 10–12 (GDPT 2018) và Clayden, Organic "
                f"Chemistry (2nd ed.); cấu trúc 3D các bước cơ chế sinh bằng RDKit {rdkit.__version__}"
            ),
        },
        "generated_by": "scripts/data/gen_reactions.py",
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n_mech = sum(1 for i in items if i["mechanism"])
    print(f"wrote {len(items)} reactions ({n_mech} with mechanisms)")


if __name__ == "__main__":
    main()
