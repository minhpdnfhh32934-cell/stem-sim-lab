"""Generate data/cell_dna_zoom.json: the sizes of the lesson "Từ tế bào đến DNA" (one zoom from a
eukaryotic cell down to the DNA double helix), each with its source and printed page.

Sources (page images of the official textbooks on NXBGD's training reader
https://taphuan.nxbgd.vn/tap-huan/doc-sach/<book>, read on 2026-11-02; image `page-N` is printed
page N - 1):
  - SGK Sinh học 10, bộ Kết nối tri thức với cuộc sống: Bài 7 (tr. 44: text and H 7.1 "Kích thước
    của một số loại tế bào và cấp độ dưới tế bào"), Bài 8 (tr. 49: the nucleus).
  - SGK Sinh học 12, bộ Kết nối tri thức với cuộc sống: Bài 7 "Cấu trúc và chức năng của nhiễm sắc
    thể" (tr. 36 text, tr. 37 text and H 7.1 "Cấu trúc siêu hiển vi của NST ở sinh vật nhân thực",
    tr. 38 H 7.2: two sister chromatids joined at the centromere — wording only, no number).
  - Ou et al. 2017, Science 357: eaag0025 (ChromEMT), introduction: 147 bp around the histone
    octamer, an 11-nm core particle, and evidence against the 30-nm fibre in cells.

Only numbers printed in these sources are written here; nothing is derived or rounded. The B-DNA
proportions (2 nm, 3,4 nm per turn, 10 bp per turn) are not repeated: the app reads them from
`src/biology/central/dogma3d/bdna.ts` (DATA_REVIEW DOG3D-1), and SGK Sinh học 12 H 7.1 prints the
same 2 nm (`dnaWidthNm` below, checked against bdna.ts by a unit test). Everything is
review_status "pending" (DATA_REVIEW DNAZ-*).

    python scripts/data/gen_cell_dna_zoom.py
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "cell_dna_zoom.json"
ACCESSED = "2026-11-02"

SOURCES = {
    "sgk-sh10-kntt": {
        "id": "sgk-sh10-kntt",
        "citation": "Sinh học 10, bộ sách Kết nối tri thức với cuộc sống (Chương trình GDPT 2018), NXB Giáo dục Việt Nam",
        "url": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-10.4700819489",
    },
    "sgk-sh12-kntt": {
        "id": "sgk-sh12-kntt",
        "citation": "Sinh học 12, bộ sách Kết nối tri thức với cuộc sống (Chương trình GDPT 2018), NXB Giáo dục Việt Nam",
        "url": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-12.4701665546",
    },
    "ou-2017": {
        "id": "ou-2017",
        "citation": "H. D. Ou et al. — ChromEMT: Visualizing 3D chromatin structure and compaction in interphase and mitotic cells, Science 357 (2017) eaag0025",
        "url": "https://doi.org/10.1126/science.aag0025",
    },
}


def size(value, unit, source, pages, where):
    """One printed number: `value` in `unit` ('nm', 'µm' or 'count'), where it is printed."""
    return {
        "value": value,
        "unit": unit,
        "source": source,
        "pages": pages,
        "where": where,
        "review_status": "pending",
    }


SIZES = {
    # H 7.1 draws "Tế bào động vật và thực vật" above the 10 µm–100 µm stretch of its scale.
    "eukCellMinUm": size(10, "µm", "sgk-sh10-kntt", [44], "H 7.1"),
    "eukCellMaxUm": size(100, "µm", "sgk-sh10-kntt", [44], "H 7.1"),
    # "Phần lớn nhân tế bào có dạng hình cầu, với đường kính khoảng 5 µm".
    "nucleusUm": size(5, "µm", "sgk-sh10-kntt", [49], "Bài 8, mục II.1"),
    # Metaphase: "mỗi chromatid có đường kính khoảng 700 nm" (text), "700 nm" (H 7.1).
    "chromatidNm": size(700, "nm", "sgk-sh12-kntt", [37], "Bài 7, mục I (kì đầu, kì giữa); H 7.1"),
    # "Chuỗi các nucleosome có đường kính khoảng 10 nm"; "Sợi nhiễm sắc đường kính 10 nm".
    "fibreNm": size(10, "nm", "sgk-sh12-kntt", [36, 37], "Bài 7, mục I (kì trung gian, kì đầu); H 7.1"),
    # "Mỗi nucleosome gồm 8 phân tử protein dạng histone thuộc 4 loại khác nhau, bên ngoài quấn
    # quanh bởi một đoạn DNA gồm 146 cặp nucleotide."
    "histones": size(8, "count", "sgk-sh12-kntt", [36], "Bài 7, mục I (kì trung gian)"),
    "histoneKinds": size(4, "count", "sgk-sh12-kntt", [36], "Bài 7, mục I (kì trung gian)"),
    "nucleosomeBp": size(146, "count", "sgk-sh12-kntt", [36], "Bài 7, mục I (kì trung gian)"),
    # H 7.1 marks the double helix "2 nm".
    "dnaWidthNm": size(2, "nm", "sgk-sh12-kntt", [37], "H 7.1"),
    # Ou et al. 2017, introduction (a newer structure than the textbook's figure).
    "nucleosomeBpOu": size(147, "count", "ou-2017", [], "Introduction (online article, no printed page)"),
    "coreParticleNmOu": size(11, "nm", "ou-2017", [], "Introduction (online article, no printed page)"),
}


def main() -> None:
    data = {
        "dataset": "cell_dna_zoom",
        "version": 1,
        "accessed": ACCESSED,
        "generated_by": "scripts/data/gen_cell_dna_zoom.py",
        "sources": SOURCES,
        "sizes": SIZES,
    }
    for key, item in SIZES.items():
        assert item["source"] in SOURCES, key
        assert item["value"] > 0, key
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(OUT.parents[1])}: {len(SIZES)} sizes")


if __name__ == "__main__":
    main()
