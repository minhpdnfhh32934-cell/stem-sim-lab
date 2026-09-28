"""Generate data/constants.json from SciPy's CODATA tables.

Source of truth: CODATA recommended values published by NIST, as shipped in
`scipy.constants` (SciPy >= 1.15 ships CODATA 2022). Re-run after upgrading SciPy:

    python scripts/data/gen_constants.py

Every item is written with review_status "pending": a teacher confirms it against
https://physics.nist.gov/cuu/Constants/ before switching it to "verified".
"""
import json
import math
import pathlib

import scipy
import scipy.constants as sc
from scipy.constants import _codata

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "constants.json"
EDITION = _codata._current_codata  # e.g. "CODATA 2022"

# (id, CODATA key, symbol, Vietnamese name, English name)
SELECTED = [
    ("c", "speed of light in vacuum", "c", "Tốc độ ánh sáng trong chân không", "Speed of light in vacuum"),
    ("h", "Planck constant", "h", "Hằng số Planck", "Planck constant"),
    ("hbar", "reduced Planck constant", "\\hbar", "Hằng số Planck rút gọn", "Reduced Planck constant"),
    ("e", "elementary charge", "e", "Điện tích nguyên tố", "Elementary charge"),
    ("kB", "Boltzmann constant", "k_B", "Hằng số Boltzmann", "Boltzmann constant"),
    ("NA", "Avogadro constant", "N_A", "Hằng số Avogadro", "Avogadro constant"),
    ("R", "molar gas constant", "R", "Hằng số khí lý tưởng", "Molar gas constant"),
    ("F", "Faraday constant", "F", "Hằng số Faraday", "Faraday constant"),
    ("G", "Newtonian constant of gravitation", "G", "Hằng số hấp dẫn", "Newtonian constant of gravitation"),
    ("eps0", "vacuum electric permittivity", "\\varepsilon_0", "Hằng số điện môi chân không", "Vacuum electric permittivity"),
    ("mu0", "vacuum mag. permeability", "\\mu_0", "Độ từ thẩm chân không", "Vacuum magnetic permeability"),
    ("me", "electron mass", "m_e", "Khối lượng electron", "Electron mass"),
    ("mp", "proton mass", "m_p", "Khối lượng proton", "Proton mass"),
    ("mn", "neutron mass", "m_n", "Khối lượng neutron", "Neutron mass"),
    ("mu", "atomic mass constant", "m_u", "Hằng số khối lượng nguyên tử (1 u)", "Atomic mass constant (1 u)"),
    ("a0", "Bohr radius", "a_0", "Bán kính Bohr", "Bohr radius"),
    ("Rinf", "Rydberg constant", "R_\\infty", "Hằng số Rydberg", "Rydberg constant"),
    ("RinfhcEv", "Rydberg constant times hc in eV", "R_\\infty hc", "Năng lượng Rydberg", "Rydberg energy"),
    ("sigma", "Stefan-Boltzmann constant", "\\sigma", "Hằng số Stefan–Boltzmann", "Stefan–Boltzmann constant"),
    ("eV", "electron volt", "\\text{eV}", "Electron-volt", "Electron volt"),
    ("gn", "standard acceleration of gravity", "g_n", "Gia tốc trọng trường chuẩn", "Standard acceleration of gravity"),
    ("atm", "standard atmosphere", "\\text{atm}", "Áp suất khí quyển chuẩn", "Standard atmosphere"),
    ("Vm", "molar volume of ideal gas (273.15 K, 101.325 kPa)", "V_m", "Thể tích mol khí lý tưởng (0 °C, 1 atm)", "Molar volume of ideal gas (0 °C, 1 atm)"),
]

UNIT_FIX = {
    "m^3 kg^-1 s^-2": "m^3/(kg*s^2)",
    "J Hz^-1": "J/Hz",
    "J K^-1": "J/K",
    "mol^-1": "1/mol",
    "J mol^-1 K^-1": "J/(mol*K)",
    "C mol^-1": "C/mol",
    "F m^-1": "F/m",
    "N A^-2": "N/A^2",
    "m^-1": "1/m",
    "W m^-2 K^-4": "W/(m^2*K^4)",
    "m s^-1": "m/s",
    "m s^-2": "m/s^2",
    "m^3 mol^-1": "m^3/mol",
    "J s": "J*s",
}


def main() -> None:
    items = []
    for cid, key, symbol, vi, en in SELECTED:
        value, unit, uncertainty = sc.physical_constants[key]
        items.append(
            {
                "id": cid,
                "symbol": symbol,
                "name": {"vi": vi, "en": en},
                "value": value,
                "unit": UNIT_FIX.get(unit, unit),
                "uncertainty": uncertainty,
                "exact": uncertainty == 0.0,
                "codata_key": key,
                "review_status": "pending",
            }
        )
    # Derived: Coulomb constant k = 1 / (4 pi eps0) — computed, not a CODATA entry.
    eps0 = sc.physical_constants["vacuum electric permittivity"]
    k = 1.0 / (4.0 * math.pi * eps0[0])
    items.append(
        {
            "id": "kC",
            "symbol": "k",
            "name": {"vi": "Hằng số Coulomb (tính từ ε₀)", "en": "Coulomb constant (derived from ε₀)"},
            "value": k,
            "unit": "N*m^2/C^2",
            "uncertainty": k * eps0[2] / eps0[0],
            "exact": False,
            "codata_key": None,
            "derived_from": "k = 1/(4π ε₀)",
            "review_status": "pending",
        }
    )
    dataset = {
        "dataset": "physical_constants",
        "version": 1,
        "source": {
            "id": "codata",
            "citation": f"{EDITION} recommended values of the fundamental physical constants (NIST), via SciPy {scipy.__version__} scipy.constants",
            "url": "https://physics.nist.gov/cuu/Constants/",
        },
        "generated_by": "scripts/data/gen_constants.py",
        "items": items,
    }
    OUT.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} constants ({EDITION}) to {OUT}")


if __name__ == "__main__":
    main()
