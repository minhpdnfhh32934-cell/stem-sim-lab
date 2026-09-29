"""Generate data/elements.json (118 elements) from the `mendeleev` package.

Sources (as bundled in mendeleev, see https://mendeleev.readthedocs.io/en/stable/data.html):
- atomic weights: IUPAC standard/conventional atomic weights (CIAAW);
- Pauling electronegativity;
- covalent radii: Cordero et al., Dalton Trans. 2008, 2832-2838 (single-bond, pm);
- ground-state electron configurations: NIST Atomic Spectra Database (includes the
  exceptions Cr, Cu, Nb, Mo, Ru, Rh, Pd, Ag, Pt, Au, La, Ce, Gd, Ac, Th, Pa, U, Np, Cm, ...);
- first ionisation energy: NIST;
- CPK and Jmol colours.

Every item is written with review_status "pending": a teacher checks it before switching to
"verified". Vietnamese traditional names (natri, kali, sắt...) are listed as aliases because
the 2018 curriculum uses IUPAC names; they are also pending review.

    python scripts/data/gen_elements.py
"""
import json
import pathlib

import mendeleev
from mendeleev import element

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "elements.json"

# Traditional Vietnamese names still found in older textbooks and everyday use.
VI_ALIASES = {
    "H": ["hiđro", "hidro"], "He": ["heli"], "Li": ["liti"], "Be": ["beri"], "B": ["bo"],
    "C": ["cacbon"], "N": ["nitơ"], "O": ["oxi"], "F": ["flo"], "Ne": ["neon"],
    "Na": ["natri"], "Mg": ["magie"], "Al": ["nhôm"], "Si": ["silic"], "P": ["photpho"],
    "S": ["lưu huỳnh"], "Cl": ["clo"], "Ar": ["agon"], "K": ["kali"], "Ca": ["canxi"],
    "Cr": ["crom"], "Mn": ["mangan"], "Fe": ["sắt"], "Co": ["coban"], "Ni": ["niken"],
    "Cu": ["đồng"], "Zn": ["kẽm"], "Br": ["brom"], "Kr": ["kripton"], "Ag": ["bạc"],
    "Sn": ["thiếc"], "I": ["iot"], "Xe": ["xenon"], "Ba": ["bari"], "Pt": ["platin", "bạch kim"],
    "Au": ["vàng"], "Hg": ["thủy ngân"], "Pb": ["chì"], "Rn": ["rađon"], "U": ["urani"],
    "Sr": ["stronti"], "Cs": ["xesi"], "Rb": ["rubiđi"], "Ti": ["titan"], "V": ["vanađi"],
    "As": ["asen"], "Se": ["selen"], "Sb": ["antimon"], "W": ["vonfram"], "Bi": ["bitmut"],
}

SERIES = {
    "Nonmetals": "nonmetal",
    "Noble gases": "nobleGas",
    "Alkali metals": "alkaliMetal",
    "Alkaline earth metals": "alkalineEarthMetal",
    "Metalloids": "metalloid",
    "Halogens": "halogen",
    "Poor metals": "postTransitionMetal",
    "Transition metals": "transitionMetal",
    "Lanthanides": "lanthanide",
    "Actinides": "actinide",
}

# IUPAC gives no standard atomic weight for these: show the mass number of the longest-lived
# isotope in brackets instead (Th, Pa, U do have standard atomic weights).
def no_standard_weight(z: int) -> bool:
    return z in (43, 61) or (z >= 84 and z not in (90, 91, 92))


def main() -> None:
    items = []
    for z in range(1, 119):
        e = element(z)
        conf = [[n, l, int(k)] for (n, l), k in e.ec.conf.items()]
        core = e.ec.get_largest_core()
        items.append(
            {
                "z": z,
                "symbol": e.symbol,
                "name": e.name,
                "aliases_vi": VI_ALIASES.get(e.symbol, []),
                "period": e.period,
                "group": e.group_id,
                "block": e.block,
                "category": SERIES[e.series],
                "atomic_weight": e.atomic_weight,
                "mass_number_only": no_standard_weight(z),
                "en_pauling": e.en_pauling,
                "covalent_radius_pm": round(e.covalent_radius_cordero, 1)
                if e.covalent_radius_cordero is not None
                else None,
                "ionization_energy_ev": round(e.ionenergies[1], 4) if e.ionenergies.get(1) else None,
                "configuration": conf,
                "noble_core": core[0] if core else None,
                "cpk_color": e.cpk_color,
                "jmol_color": e.jmol_color,
                "review_status": "pending",
            }
        )
    data = {
        "dataset": "elements",
        "version": 1,
        "source": {
            "id": "mendeleev",
            "citation": (
                f"mendeleev {mendeleev.__version__} (L. M. Mentel): IUPAC/CIAAW atomic weights, "
                "Pauling electronegativity, Cordero et al. 2008 covalent radii, "
                "NIST ASD ground-state configurations and ionisation energies, CPK/Jmol colours"
            ),
            "url": "https://mendeleev.readthedocs.io/en/stable/data.html",
        },
        "generated_by": "scripts/data/gen_elements.py",
        "items": items,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} elements to {OUT}")


if __name__ == "__main__":
    main()
