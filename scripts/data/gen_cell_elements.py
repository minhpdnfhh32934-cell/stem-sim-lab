"""Generate data/cell_elements.json for "Các nguyên tố hoá học và nước" (SH10 KNTT Bài 4, #255).

Sources (every value is copied as printed, never estimated):
- The share of each element in the human body by mass: SGK Sinh học 10, bộ Kết nối tri thức với
  cuộc sống (NXB Giáo dục Việt Nam), Bài 4, Hình 4.1 "Tỉ lệ các nguyên tố hoá học trong cơ thể
  người", printed page 24, read on the NXBGD training site taphuan.nxbgd.vn on 15/11/2026. The
  figure gives point values (no ranges) and one combined slice for K, S, Na, Mg, Cl (0,8 %): the
  app shows that slice as one bar and never splits it. The text on the same page names the
  macro- and trace-element groups ("Ca, P, K, S và một số nguyên tố đa lượng còn lại").
- Water's share of the human body ("khoảng 70%"): the same book, printed page 25.
- Water's heat capacity: the liquid-phase Shomate equation of the NIST Chemistry WebBook (SRD 69,
  water, CAS 7732-18-5), coefficients from M. W. Chase Jr., NIST-JANAF Thermochemical Tables,
  4th ed., J. Phys. Chem. Ref. Data Monograph 9 (1998), valid 298–500 K; evaluated here at
  298.15 K.
- Water's enthalpy of vaporization at 298.15 K: ΔfH°(gas) − ΔfH°(liquid) of the CODATA key values
  (J. D. Cox, D. D. Wagman, V. A. Medvedev, CODATA Key Values for Thermodynamics, Hemisphere,
  1984), as listed by the NIST Chemistry WebBook: −241.826 and −285.830 kJ/mol (read 15/11/2026).
- Molar mass of water from the standard atomic weights of H and O as mendeleev gives them.

Every item is written with review_status "pending" (docs/DATA_REVIEW.md, SH10-ELEM-*).

    python scripts/data/gen_cell_elements.py      (needs mendeleev, e.g. 1.3.0)
"""
import json
import pathlib

import mendeleev
from mendeleev import element

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "cell_elements.json"

SGK = {
    "id": "sgk-sh10-kntt-bai4",
    "citation": (
        "SGK Sinh học 10, bộ Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài 4 "
        "“Các nguyên tố hoá học và nước”: Hình 4.1 (tr. 24), nước trong cơ thể người (tr. 25); "
        "đọc trên taphuan.nxbgd.vn ngày 15/11/2026"
    ),
    "url": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-10.4700819489",
}

# Hình 4.1, as printed: (id, symbols in the slice, share of body mass in %, group).
FIGURE_4_1 = [
    ("O", ["O"], 65, "macro"),
    ("C", ["C"], 18, "macro"),
    ("H", ["H"], 10, "macro"),
    ("N", ["N"], 3, "macro"),
    ("Ca", ["Ca"], 1.5, "macro"),
    ("P", ["P"], 1.1, "macro"),
    ("KSNaMgCl", ["K", "S", "Na", "Mg", "Cl"], 0.8, "macro"),
    ("trace", [], 0.6, "trace"),
]
BODY_WATER_PCT = 70  # tr. 25: "Nước chiếm khoảng 70% khối lượng cơ thể người"

NIST = {
    "id": "nist-webbook-water",
    "citation": (
        "NIST Chemistry WebBook, SRD 69, Water (CAS 7732-18-5): ΔfH°gas, ΔfH°liquid (Cox, Wagman, "
        "Medvedev, CODATA Key Values for Thermodynamics, 1984) and the liquid-phase Shomate "
        "equation (Chase, NIST-JANAF Thermochemical Tables, 4th ed., 1998); đọc ngày 15/11/2026"
    ),
    "url": "https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185",
}
# Liquid-phase Shomate coefficients (298–500 K): Cp = A + B t + C t² + D t³ + E/t², t = T/1000.
SHOMATE = {"A": -203.6060, "B": 1523.290, "C": -3196.413, "D": 2474.455, "E": 3.855326}
T_REF = 298.15  # K
DF_H_GAS = -241.826  # kJ/mol, CODATA
DF_H_LIQUID = -285.830  # kJ/mol, CODATA


def shomate_cp(T: float) -> float:
    t = T / 1000
    s = SHOMATE
    return s["A"] + s["B"] * t + s["C"] * t**2 + s["D"] * t**3 + s["E"] / t**2


def main() -> None:
    items = [
        {"id": i, "symbols": sym, "share_pct": share, "group": group, "review_status": "pending"}
        for i, sym, share, group in FIGURE_4_1
    ]
    total = sum(x["share_pct"] for x in items)
    assert abs(total - 100) < 1e-9, total  # the figure's slices add up to 100 %
    m_water = 2 * element("H").atomic_weight + element("O").atomic_weight  # g/mol
    cp = shomate_cp(T_REF)  # J/(mol·K)
    dvap = DF_H_GAS - DF_H_LIQUID  # kJ/mol
    data = {
        "dataset": "cell_elements",
        "version": 1,
        "source": SGK,
        "generated_by": "scripts/data/gen_cell_elements.py",
        "items": items,
        "body_water_pct": BODY_WATER_PCT,
        "water": {
            "source": NIST,
            "atomic_weights": f"mendeleev {mendeleev.__version__}: H {element('H').atomic_weight}, O {element('O').atomic_weight}",
            "molar_mass_g_mol": round(m_water, 6),
            "shomate_liquid": SHOMATE,
            "t_ref_k": T_REF,
            "cp_molar_j_mol_k": round(cp, 4),
            "c_specific_j_g_k": round(cp / m_water, 5),
            "df_h_gas_kj_mol": DF_H_GAS,
            "df_h_liquid_kj_mol": DF_H_LIQUID,
            "dvap_h_kj_mol": round(dvap, 3),
            "l_vap_j_g": round(dvap * 1000 / m_water, 2),
            "review_status": "pending",
        },
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} slices; water c = {cp / m_water:.4f} J/(g·K), L = {dvap * 1000 / m_water:.1f} J/g")


if __name__ == "__main__":
    main()
