"""Generate data/complexes_kntt.json: the complexes of Hóa học 12 KNTT Bài 28 "Sơ lược về phức chất"
and Bài 29 "Một số tính chất và ứng dụng của phức chất" (#255 round 4f).

User decision 15/11/2026 ("bám sát chương trình của sách"): every complex, colour and reaction is
the textbook's.

Source: SGK Hóa học 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102, read
17/11/2026:
  - Bài 28 tr. 134: [Co(NH3)6]3+, [Zn(OH)4]2−, [Fe(CO)5] and question 1 ([Cu(H2O)6]2+, [CoF6]3−,
    [Ni(CO)4], [PtCl2(NH3)2]); tr. 135: [Ag(NH3)2]OH and Bảng 28.1 (tetrahedral and square planar
    with 4 ligands, octahedral with 6); tr. 136: donor–acceptor bonds, question 2 ([Ag(NH3)2]+,
    [CoF6]3−), aqua complexes "mostly octahedral", [Fe(H2O)6]2+, [Co(H2O)6]3+, question 3 (Ni2+,
    Zn2+ aqua complexes are octahedral);
  - Bài 29 tr. 138: signs of complex formation ([Al(OH)3(H2O)3], [Ag(NH3)2]+, [CuCl4]2−,
    [Cu(OH)2(H2O)4], [Cu(NH3)4(H2O)2]2+ and their colours); tr. 139: the colour table;
    tr. 140: ligand substitutions, question 3 (Co2+ aqua complex is octahedral, with NH3 the new
    complex is octahedral too), cisplatin (square planar structure drawn).

A complex is written by its parts: the central atom and its charge, and the ligands (each with the
donor atom the bond starts from). Its charge and coordination number are computed by the app.

Everything is review_status "pending".

    python scripts/data/gen_complexes_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "complexes_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102"

# Ligands: formula (formula-reader text), charge, donor atom.
LIGANDS = {
    "NH3": (0, "N"),
    "H2O": (0, "O"),
    "OH": (-1, "O"),
    "CO": (0, "C"),
    "F": (-1, "F"),
    "Cl": (-1, "Cl"),
    "CN": (-1, "C"),
}

# Complexes: (id, central atom, its charge, [(ligand, count)], printed charge, geometry the book
# states or None, colour (vi, en) or None, page, note on where the geometry comes from).
COMPLEXES = [
    ("co_nh3_6_3", "Co", 3, [("NH3", 6)], 3, None, None, 134, None),
    ("zn_oh_4", "Zn", 2, [("OH", 4)], -2, None, None, 134, None),
    ("fe_co_5", "Fe", 0, [("CO", 5)], 0, None, None, 134, None),
    ("cu_h2o_6", "Cu", 2, [("H2O", 6)], 2, "octahedral", ("xanh", "blue"), 134, "aqua"),
    ("co_f_6", "Co", 3, [("F", 6)], -3, None, None, 134, None),
    ("ni_co_4", "Ni", 0, [("CO", 4)], 0, None, None, 134, None),
    ("cisplatin", "Pt", 2, [("Cl", 2), ("NH3", 2)], 0, "square_planar", None, 140, "cisplatin"),
    ("ag_nh3_2", "Ag", 1, [("NH3", 2)], 1, None, None, 135, None),
    ("fe_h2o_6_2", "Fe", 2, [("H2O", 6)], 2, "octahedral", ("lục nhạt", "pale green"), 136, "aqua"),
    ("co_h2o_6_3", "Co", 3, [("H2O", 6)], 3, "octahedral", None, 136, "aqua"),
    ("ni_h2o_6", "Ni", 2, [("H2O", 6)], 2, "octahedral", None, 136, "q3"),
    ("zn_h2o_6", "Zn", 2, [("H2O", 6)], 2, "octahedral", None, 136, "q3"),
    ("al_oh_3_h2o_3", "Al", 3, [("OH", 3), ("H2O", 3)], 0, None, None, 138, None),
    ("cucl4", "Cu", 2, [("Cl", 4)], -2, None, ("vàng", "yellow"), 138, None),
    ("cu_oh_2_h2o_4", "Cu", 2, [("OH", 2), ("H2O", 4)], 0, None, ("xanh nhạt (kết tủa)", "pale blue (a precipitate)"), 138, None),
    ("cu_nh3_4_h2o_2", "Cu", 2, [("NH3", 4), ("H2O", 2)], 2, None, ("xanh lam", "deep blue"), 138, None),
    ("cr_h2o_6", "Cr", 3, [("H2O", 6)], 3, "octahedral", ("xanh tím", "violet-blue"), 139, "aqua"),
    ("cr_oh_6", "Cr", 3, [("OH", 6)], -3, None, ("xanh rêu", "moss green"), 139, None),
    ("fe_h2o_6_3", "Fe", 3, [("H2O", 6)], 3, "octahedral", ("vàng nhạt", "pale yellow"), 139, "aqua"),
    ("co_h2o_6_2", "Co", 2, [("H2O", 6)], 2, "octahedral", ("hồng đỏ", "pinkish red"), 139, "q3b"),
    ("co_nh3_6_2", "Co", 2, [("NH3", 6)], 2, "octahedral", ("vàng nâu", "yellowish brown"), 139, "q3b"),
    ("ptcl4", "Pt", 2, [("Cl", 4)], -2, None, None, 140, None),
    ("ptcl3_nh3", "Pt", 2, [("Cl", 3), ("NH3", 1)], -1, None, None, 140, None),
    ("fe_cn_6", "Fe", 2, [("CN", 6)], -4, None, None, 140, None),
]

# Ligand substitutions (tr. 140): (id, complex before, entering ligand, count, complex after,
# leaving ligand, count, page).
SUBSTITUTIONS = [
    ("pt", "ptcl4", "NH3", 1, "ptcl3_nh3", "Cl", 1, 140),
    ("fe", "fe_h2o_6_2", "CN", 6, "fe_cn_6", "H2O", 6, 140),
    ("cu", "cu_h2o_6", "Cl", 4, "cucl4", "H2O", 6, 140),
    ("co", "co_h2o_6_2", "NH3", 6, "co_nh3_6_2", "H2O", 6, 140),
]


def charge(cx) -> int:
    _id, _m, q, ligands, *_ = cx
    return q + sum(LIGANDS[l][0] * n for l, n in ligands)


def main() -> None:
    by_id = {c[0]: c for c in COMPLEXES}
    for c in COMPLEXES:
        # The printed charge is the central atom's plus the ligands' (tr. 134).
        assert charge(c) == c[4], c[0]
        cn = sum(n for _l, n in c[3])
        # Bảng 28.1: octahedral has 6 ligands, square planar 4.
        if c[5] == "octahedral":
            assert cn == 6, c[0]
        if c[5] == "square_planar":
            assert cn == 4, c[0]
    for sid, before, lin, nin, after, lout, nout, _p in SUBSTITUTIONS:
        b, a = by_id[before], by_id[after]
        # Charge is conserved: before + entering = after + leaving.
        assert charge(b) + LIGANDS[lin][0] * nin == charge(a) + LIGANDS[lout][0] * nout, sid
    out = {
        "dataset": "complexes_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-hh12-b28-29",
            "citation": (
                "SGK Hóa học 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Bài 28 “Sơ lược về phức chất” "
                "(Bảng 28.1, tr. 134–137), Bài 29 “Một số tính chất và ứng dụng của phức chất” (bảng màu sắc, "
                "phản ứng thế phối tử, tr. 138–141)"
            ),
            "url": READER,
        },
        "ligands": {k: {"charge": q, "donor": d} for k, (q, d) in LIGANDS.items()},
        "items": [
            {
                "id": i, "metal": m, "metal_charge": q,
                "ligands": [{"ligand": l, "count": n} for l, n in lig],
                "charge": ch, "geometry": g,
                "colour": {"vi": col[0], "en": col[1]} if col else None,
                "page": p, "geometry_from": gf, "review_status": "pending",
            }
            for i, m, q, lig, ch, g, col, p, gf in COMPLEXES
        ],
        "substitutions": [
            {"id": s, "before": b, "entering": li, "entering_count": ni, "after": a,
             "leaving": lo, "leaving_count": no, "page": p}
            for s, b, li, ni, a, lo, no, p in SUBSTITUTIONS
        ],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(COMPLEXES)} complexes, {len(SUBSTITUTIONS)} substitutions")


if __name__ == "__main__":
    main()
