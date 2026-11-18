"""Generate data/nitrogen_sulfur_kntt.json: the substances, oxidation-number axes and reactions of
Hóa học 11 KNTT Chương 2 "Nitrogen – sulfur" (Bài 4–8) that the lesson shows (#255 round 2d).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's.

Source: SGK Hóa học 11 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834, read
17/11/2026: Bài 4 "Nitrogen" tr. 29–32, Bài 5 "Ammonia • Muối ammonium" tr. 33–37, Bài 6 "Một số
hợp chất của nitrogen với oxygen" tr. 38–41, Bài 7 "Sulfur và sulfur dioxide" tr. 42–47, Bài 8
"Sulfuric acid và muối sulfate" tr. 48–54. The facts are short restatements of the book's own
sentences, not copies of them; every number is the book's.

The oxidation numbers of the axis species are NOT stored: the app computes them from the formula
with its textbook rules (src/chemistry/redox/oxidation.ts), as the book's activities ask the
learner to do (tr. 30: "Sắp xếp các hợp chất sau vào vị trí tương ứng trong trục ...").

Everything is review_status "pending" (docs/DATA_REVIEW.md, HH11-NS-1, HH11-NS-2).

    python scripts/data/gen_nitrogen_sulfur_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "nitrogen_sulfur_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834"


def fact(vi: str, en: str, page: int) -> dict:
    return {"text": {"vi": vi, "en": en}, "page": page}


# (id, element, formula, Vietnamese name, English name, lesson, facts)
SUBSTANCES = [
    ("n2", "N", "N2", "Nitrogen", "Nitrogen", 4, [
        fact("Chiếm 75,5% khối lượng (78,1% thể tích) khí quyển Trái Đất.", "75.5% of the mass (78.1% of the volume) of the Earth's atmosphere.", 29),
        fact("Hai đồng vị bền: ¹⁴N (99,63%) và ¹⁵N (0,37%).", "Two stable isotopes: ¹⁴N (99.63%) and ¹⁵N (0.37%).", 29),
        fact("Ô số 7, nhóm VA, chu kì 2; độ âm điện 3,04; số oxi hóa từ −3 đến +5.", "Atomic number 7, group VA, period 2; electronegativity 3.04; oxidation numbers −3 to +5.", 30),
        fact("Liên kết ba (1 σ, 2 π), năng lượng liên kết 945 kJ/mol, phân tử không phân cực.", "A triple bond (1 σ, 2 π), bond energy 945 kJ/mol; a non-polar molecule.", 30),
        fact("Khí không màu, không mùi, không vị; hóa lỏng ở −196 °C; 1 lít nước hòa tan 0,012 lít khí nitrogen.", "A colourless, odourless, tasteless gas; liquefies at −196 °C; 1 L of water dissolves 0.012 L of nitrogen.", 30),
    ]),
    ("nh3", "N", "NH3", "Ammonia", "Ammonia", 5, [
        fact("Phân tử dạng chóp tam giác; nguyên tử N còn một cặp electron không liên kết.", "A trigonal pyramid; the N atom keeps one lone pair.", 33),
        fact("Liên kết N–H phân cực, năng lượng liên kết 386 kJ/mol.", "Polar N–H bonds, bond energy 386 kJ/mol.", 33),
        fact("Khí không màu, nhẹ hơn không khí, mùi khai và xốc; 1 lít nước hòa tan khoảng 700 lít ammonia.", "A colourless gas, lighter than air, with a sharp smell; 1 L of water dissolves about 700 L of ammonia.", 34),
        fact("Hóa lỏng ở −33,3 °C, hóa rắn ở −77,7 °C.", "Liquefies at −33.3 °C, solidifies at −77.7 °C.", 34),
        fact("Dung dịch có môi trường base yếu: quỳ tím hóa xanh, phenolphthalein hóa hồng.", "Its solution is weakly basic: litmus turns blue, phenolphthalein pink.", 34),
        fact("Sản xuất ở 400 °C – 450 °C, áp suất 150 – 200 bar, xúc tác Fe.", "Made at 400–450 °C, 150–200 bar, with an iron catalyst.", 35),
    ]),
    ("nh4", "N", "NH4^+", "Ion ammonium", "Ammonium ion", 5, [
        fact("Hầu hết muối ammonium dễ tan và phân li hoàn toàn ra ion.", "Most ammonium salts dissolve easily and dissociate completely.", 36),
        fact("Nhận biết: đun với dung dịch kiềm, có khí ammonia mùi khai bay ra.", "Test: warmed with an alkali, it gives off ammonia with its sharp smell.", 36),
        fact("Muối ammonium kém bền nhiệt, dễ bị phân hủy khi nung nóng.", "Ammonium salts are unstable to heat and decompose when heated.", 36),
    ]),
    ("nox", "N", "NO2", "Các oxide của nitrogen (NOₓ)", "Nitrogen oxides (NOₓ)", 6, [
        fact("N₂O dinitrogen oxide, NO nitrogen monoxide, NO₂ nitrogen dioxide, N₂O₄ dinitrogen tetroxide.", "N₂O dinitrogen oxide, NO nitrogen monoxide, NO₂ nitrogen dioxide, N₂O₄ dinitrogen tetroxide.", 38),
        fact("Nước mưa thường có pH khoảng 5,6; mưa có pH nhỏ hơn 5,6 là mưa acid, tác động rõ nhất khi pH dưới 4,5.", "Ordinary rain has a pH of about 5.6; rain below 5.6 is acid rain, most harmful below 4.5.", 39),
        fact("Phú dưỡng khi nitrogen trong nước đạt 300 µg/L và phosphorus đạt 20 µg/L.", "Eutrophication sets in when nitrogen in water reaches 300 µg/L and phosphorus 20 µg/L.", 40),
    ]),
    ("hno3", "N", "HNO3", "Nitric acid", "Nitric acid", 6, [
        fact("N có số oxi hóa +5, cao nhất của nitrogen: nitric acid có tính oxi hóa mạnh.", "N is at +5, nitrogen's highest: nitric acid is a strong oxidising agent.", 39),
        fact("Chất lỏng không màu, khối lượng riêng 1,53 g/mL; nóng chảy ở −42 °C, sôi ở 83 °C; tan vô hạn trong nước.", "A colourless liquid of density 1.53 g/mL; melts at −42 °C, boils at 83 °C; mixes with water in all proportions.", 39),
    ]),
    ("s", "S", "S", "Sulfur", "Sulfur", 7, [
        fact("Nguyên tố phổ biến thứ 17 trên vỏ Trái Đất, khoảng 0,03 – 0,1% khối lượng.", "The 17th most common element in the Earth's crust, about 0.03–0.1% of its mass.", 42),
        fact("Bốn đồng vị bền: ³²S (94,98%), ³³S (0,76%), ³⁴S (4,22%), ³⁶S (0,02%).", "Four stable isotopes: ³²S (94.98%), ³³S (0.76%), ³⁴S (4.22%), ³⁶S (0.02%).", 42),
        fact("Ô số 16, nhóm VIA, chu kì 3; độ âm điện 2,58; số oxi hóa từ −2 đến +6.", "Atomic number 16, group VIA, period 3; electronegativity 2.58; oxidation numbers −2 to +6.", 43),
        fact("Phân tử S₈ dạng vòng; liên kết S–S 226 kJ/mol, dài 205 pm.", "Ring-shaped S₈ molecules; S–S bonds of 226 kJ/mol and 205 pm.", 43),
        fact("Không tan trong nước, ít tan trong alcohol, tan nhiều trong carbon disulfide; nóng chảy ở 113 °C, sôi ở 445 °C.", "Insoluble in water, slightly soluble in alcohol, very soluble in carbon disulfide; melts at 113 °C, boils at 445 °C.", 43),
        fact("Hai dạng thù hình tà phương và đơn tà, chuyển nhau ở 95,5 °C.", "Two allotropes, rhombic and monoclinic, which change into each other at 95.5 °C.", 44),
    ]),
    ("so2", "S", "SO2", "Sulfur dioxide", "Sulfur dioxide", 7, [
        fact("Khí không màu, nặng hơn không khí, mùi hắc; ở 20 °C, 1 lít nước hòa tan được 40 lít sulfur dioxide.", "A colourless gas, heavier than air, with a pungent smell; at 20 °C, 1 L of water dissolves 40 L of sulfur dioxide.", 45),
        fact("Khí độc: hít phải lượng vượt ngưỡng gây viêm đường hô hấp.", "Toxic: breathing it above the limit inflames the airways.", 45),
        fact("S có số oxi hóa +4: sulfur dioxide vừa có tính oxi hóa vừa có tính khử.", "S is at +4: sulfur dioxide is both an oxidising and a reducing agent.", 46),
    ]),
    ("h2so4", "S", "H2SO4", "Sulfuric acid", "Sulfuric acid", 8, [
        fact("Chất lỏng sánh như dầu, không màu, không bay hơi, hút ẩm mạnh.", "An oily, colourless, non-volatile liquid that takes up water strongly.", 49),
        fact("Dung dịch 98% có khối lượng riêng 1,84 g/cm³, nặng gần gấp hai lần nước.", "The 98% solution has a density of 1.84 g/cm³, nearly twice that of water.", 49),
        fact("Tan vô hạn trong nước và tỏa rất nhiều nhiệt: khi pha loãng phải rót từ từ acid vào nước, không làm ngược lại.", "Mixes with water in all proportions, giving off much heat: to dilute it, pour the acid slowly into water, never the reverse.", 49),
    ]),
]

# Species placed on each axis (the book's lists, tr. 30 and tr. 43, plus the lesson's acids).
AXES = {
    "N": {"min": -3, "max": 5, "species": ["NH3", "NH4Cl", "N2", "N2O", "NO", "HNO2", "KNO2", "NO2", "HNO3", "NaNO3"], "page": 30},
    "S": {"min": -2, "max": 6, "species": ["H2S", "Al2S3", "S", "SO2", "SO3", "H2SO4", "BaSO4"], "page": 43},
}

# (id, element, reactants [(coef, formula)], products, reversible, conditions vi/en, ΔrH° kJ or None, page)
REACTIONS = [
    ("haber", "N", [(1, "N2"), (3, "H2")], [(2, "NH3")], True, ("400 °C – 450 °C, 150 – 200 bar, xúc tác Fe", "400–450 °C, 150–200 bar, iron catalyst"), -91.8, 35),
    ("n2-o2", "N", [(1, "N2"), (1, "O2")], [(2, "NO")], True, ("trên 3 000 °C hoặc tia lửa điện", "above 3000 °C or an electric spark"), 180.6, 31),
    ("nh3-burn", "N", [(4, "NH3"), (3, "O2")], [(2, "N2"), (6, "H2O")], False, ("đốt trong oxygen", "burnt in oxygen"), None, 35),
    ("ostwald", "N", [(4, "NH3"), (5, "O2")], [(4, "NO"), (6, "H2O")], False, ("800 °C – 900 °C, xúc tác Pt", "800–900 °C, platinum catalyst"), None, 35),
    ("nh3-hcl", "N", [(1, "NH3"), (1, "HCl")], [(1, "NH4Cl")], False, ("nhiệt độ thường", "room temperature"), None, 34),
    ("nh4cl-heat", "N", [(1, "NH4Cl")], [(1, "NH3"), (1, "HCl")], False, ("nung nóng", "heated"), None, 36),
    ("nh4no3-heat", "N", [(1, "NH4NO3")], [(1, "N2O"), (2, "H2O")], False, ("nung nóng", "heated"), None, 36),
    ("no2-rain", "N", [(4, "NO2"), (1, "O2"), (2, "H2O")], [(4, "HNO3")], False, ("trong khí quyển", "in the atmosphere"), None, 39),
    ("h2-s", "S", [(1, "H2"), (1, "S")], [(1, "H2S")], False, ("nhiệt độ cao", "high temperature"), -20.6, 44),
    ("al-s", "S", [(2, "Al"), (3, "S")], [(1, "Al2S3")], False, ("đun nóng", "heated"), None, 44),
    ("s-f2", "S", [(1, "S"), (3, "F2")], [(1, "SF6")], False, ("nhiệt độ thích hợp", "suitable temperature"), -1220.5, 45),
    ("s-o2", "S", [(1, "S"), (1, "O2")], [(1, "SO2")], False, ("đun nóng", "heated"), -296.8, 45),
    ("so2-h2s", "S", [(1, "SO2"), (2, "H2S")], [(3, "S"), (2, "H2O")], False, ("nhiệt độ thường", "room temperature"), None, 46),
    ("so2-no2", "S", [(1, "SO2"), (1, "NO2")], [(1, "SO3"), (1, "NO")], False, ("xúc tác nitrogen oxide", "nitrogen oxide catalyst"), None, 46),
    ("so2-rain", "S", [(2, "SO2"), (1, "O2"), (2, "H2O")], [(2, "H2SO4")], False, ("xúc tác ion kim loại trong khói bụi", "metal ions in dust as catalyst"), None, 39),
    ("caf2-h2so4", "S", [(1, "CaF2"), (1, "H2SO4")], [(1, "CaSO4"), (2, "HF")], False, ("250 °C, sulfuric acid đặc", "250 °C, concentrated sulfuric acid"), None, 50),
]


def main() -> None:
    ids = [s[0] for s in SUBSTANCES]
    assert len(ids) == len(set(ids))
    out = {
        "dataset": "nitrogen_sulfur_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-hh11-c2",
            "citation": (
                "SGK Hóa học 11 Kết nối tri thức, NXB Giáo dục Việt Nam: Chương 2 “Nitrogen – sulfur”, "
                "Bài 4 (tr. 29–32), Bài 5 (tr. 33–37), Bài 6 (tr. 38–41), Bài 7 (tr. 42–47), Bài 8 (tr. 48–54)"
            ),
            "url": READER,
        },
        "items": [
            {
                "id": i,
                "element": el,
                "formula": f,
                "name": {"vi": vi, "en": en},
                "lesson": lesson,
                "facts": facts,
                "review_status": "pending",
            }
            for i, el, f, vi, en, lesson, facts in SUBSTANCES
        ],
        "axes": AXES,
        "reactions": [
            {
                "id": i,
                "element": el,
                "reactants": [{"coef": c, "formula": f} for c, f in rs],
                "products": [{"coef": c, "formula": f} for c, f in ps],
                "reversible": rev,
                "conditions": {"vi": cvi, "en": cen},
                "dH_kJ": dh,
                "page": page,
                "review_status": "pending",
            }
            for i, el, rs, ps, rev, (cvi, cen), dh, page in REACTIONS
        ],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(SUBSTANCES)} substances, {len(REACTIONS)} reactions")


if __name__ == "__main__":
    main()
