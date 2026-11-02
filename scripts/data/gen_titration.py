"""Generate data/titration.json: water's ion product at 25 °C and acid–base indicator ranges.

Kw: IAPWS R11-24 (2024), Revised Release on the Ionization Constant of H2O, Eqs. (2)–(4) with the
Table 1 parameters. The code is checked against every Table 2 test value, and the 25 °C result
against the Table 3 value (13.99 at 0.1 MPa). Water density at 25 °C and 0.1 MPa from the IAPWS-95
formulation (Wagner & Pruss 2002), as Table 3 uses. IAPWS Kw is on the molality scale (mol/kg);
the app writes [H+][OH-] in mol/L, so pKw is moved to that scale with c = m·rho (dilute solution):
pKw(mol/L) = pKw(mol/kg) − 2·lg(rho / (kg/L)).

Indicators: transition ranges and the colour names on each side, from the table "Common laboratory
indicators" of the English Wikipedia article "pH indicator" (revision 1354116288). Sources differ by
0.1–0.3 pH at the ends (docs/DATA_REVIEW.md TIT-2). The screen colour of each named colour is a CSS
named colour (W3C CSS Color 4) chosen by that name (orchid for purple-pink, transparent for
colourless), an illustration, not a measured colour.

review_status "pending" until a teacher checks it.

    python scripts/data/gen_titration.py
"""
import json
import math
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "titration.json"
ACCESSED = "2026-11-02"

IAPWS = {
    "id": "iapws-r11-24",
    "citation": "IAPWS R11-24, Revised Release on the Ionization Constant of H2O (2024), Eqs. (2)–(4), Table 1; based on Bandura & Lvov, J. Phys. Chem. Ref. Data 35, 15 (2006) and Arcis et al., J. Phys. Chem. Ref. Data 53, 023103 (2024)",
    "url": "https://iapws.org/documents/release/Ionization.download",
}
IAPWS95 = {
    "id": "iapws-95",
    "citation": "W. Wagner, A. Pruss, The IAPWS Formulation 1995 for the Thermodynamic Properties of Ordinary Water Substance, J. Phys. Chem. Ref. Data 31, 387 (2002): density of liquid water at 25 °C, 0.1 MPa",
}
INDICATOR_SOURCE = {
    "id": "wikipedia-ph-indicator",
    "citation": f"Wikipedia, \"pH indicator\", table \"Common laboratory indicators\" (revision 1354116288 of 14 May 2026, read {ACCESSED}); the article cites D. C. Harris, Exploring Chemical Analysis, 3rd ed., W. H. Freeman (2005)",
    "url": "https://en.wikipedia.org/w/index.php?title=PH_indicator&oldid=1354116288",
}
CSS_COLOURS = {
    "id": "w3c-css-color-4",
    "citation": "W3C, CSS Color Module Level 4, §6.1 Named Colors (screen colour of a colour name; illustration only)",
    "url": "https://www.w3.org/TR/css-color-4/#named-colors",
}

# IAPWS R11-24 Table 1.
N = 6
ALPHA = (-0.702132, 8681.05, -24145.1)
BETA = (0.813876, -51.4471, -0.469920)
MW = 18.015268  # g/mol
# Table 2: (T / K, density / g cm^-3, pKw).
TABLE_2 = [
    (300, 1.0, 13.906672),
    (600, 0.07, 20.161651),
    (600, 0.7, 11.147093),
    (800, 0.2, 14.487671),
    (800, 1.2, 6.4058649),
    (1270, 0.0, 35.081557),
]
T_25C = 298.15
RHO_25C = 0.99704702  # g/cm^3, IAPWS-95 at 298.15 K, 0.1 MPa
TABLE_3_25C = 13.99  # Table 3, 25 °C, 0.1 MPa (two decimals)
UNCERTAINTY_PK = 0.05  # IAPWS R11-24 §5: liquid below 200 °C and 200 MPa

RED = ("đỏ", "red", "red")
YELLOW = ("vàng", "yellow", "yellow")
BLUE = ("xanh lam", "blue", "blue")
COLOURLESS = ("không màu", "colourless", "transparent")
PURPLE_PINK = ("hồng tím", "purple-pink", "orchid")
# (id, vi name, en name, colours, ranges): colours[i] turns into colours[i + 1] over ranges[i].
# Phenolphthalein has the table's two rows (first and second transition).
INDICATORS = [
    ("methylOrange", "Methyl da cam", "Methyl orange", [RED, YELLOW], [(3.1, 4.4)]),
    ("methylRed", "Methyl đỏ", "Methyl red", [RED, YELLOW], [(4.4, 6.2)]),
    ("bromothymolBlue", "Bromothymol xanh", "Bromothymol blue", [YELLOW, BLUE], [(6.0, 7.6)]),
    ("phenolphthalein", "Phenolphthalein", "Phenolphthalein", [COLOURLESS, PURPLE_PINK, COLOURLESS], [(8.3, 10.0), (12.0, 13.0)]),
]


def pkw(t: float, rho: float) -> float:
    """IAPWS R11-24 Eqs. (2)–(4): pKw at temperature t (K) and water density rho (g/cm^3)."""
    z = rho * math.exp(ALPHA[0] + ALPHA[1] / t + ALPHA[2] / t**2 * rho ** (2 / 3))
    pkw_g = 0.61415 + 48251.33 / t - 67707.93 / t**2 + 10102100 / t**3
    return (
        -2 * N * (math.log10(1 + z) - z / (z + 1) * rho * (BETA[0] + BETA[1] / t + BETA[2] * rho))
        + pkw_g
        + 2 * math.log10(MW / 1000)
    )


def colour(vi: str, en: str, css: str) -> dict:
    return {"name": {"vi": vi, "en": en}, "css": css}


def main() -> None:
    for t, rho, expected in TABLE_2:
        got = pkw(t, rho)
        assert abs(got - expected) < 5e-6, (t, rho, got, expected)
    value = pkw(T_25C, RHO_25C)
    assert round(value, 2) == TABLE_3_25C, value
    molar = round(value - 2 * math.log10(RHO_25C), 4)
    water = {
        "T_K": T_25C,
        "p_MPa": 0.1,
        "density_g_cm3": RHO_25C,
        "pKw_molal": round(value, 4),
        "pKw": molar,
        "uncertainty_pK": UNCERTAINTY_PK,
        "source": IAPWS,
        "density_source": IAPWS95,
        "review_status": "pending",
    }
    items = []
    for ident, vi, en, colours, ranges in INDICATORS:
        ends = [x for r in ranges for x in r]
        assert len(colours) == len(ranges) + 1 and ends == sorted(set(ends)), ident
        items.append({
            "id": ident,
            "name": {"vi": vi, "en": en},
            "colours": [colour(*c) for c in colours],
            "ranges": [list(r) for r in ranges],
            "source": INDICATOR_SOURCE,
            "display_source": CSS_COLOURS,
            "review_status": "pending",
        })
    out = {
        "dataset": "titration",
        "version": 1,
        "review_status": "pending",
        "accessed": ACCESSED,
        "source": IAPWS,
        "generated_by": "scripts/data/gen_titration.py",
        "water": water,
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote pKw(25 C) = {molar} mol/L scale ({value:.6f} mol/kg); {len(items)} indicators")


if __name__ == "__main__":
    main()
