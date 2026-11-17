"""Generate data/evolution_kntt.json: the tables of Sinh học 12 KNTT Bài 19 "Các bằng chứng tiến hoá"
and Bài 22 "Tiến hoá lớn và quá trình phát sinh chủng loại" that the lessons use (#255 round 5c).

User decision 15/11/2026 ("bám sát chương trình của sách"): every value is the textbook's; the
events of Bảng 22.1 are summarised in SimLab's own words.

Source: SGK Sinh học 12 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), page images in
NXBGD's reader, read 17/11/2026:
  - Bài 19 tr. 99 (Bảng 19.1, from Hoefnagels 2014): the number of amino acids of cytochrome C that
    differ from the human protein, for eight species;
  - Bài 22 tr. 116 (Bảng 22.1): eons, eras and periods with their times (million years ago) and
    main events; tr. 115: prokaryote fossils 3,5 billion years old, eukaryote fossils 1,8 billion;
    tr. 118–119 (Hình 22.4): Ardipithecus ramidus about 4,4 million years ago, Australopithecus 4 to
    2,5 million, Homo from 2,5 million to 500 000, Neanderthals/Denisovans and Homo sapiens parting
    550 000 to 760 000 years ago, Homo sapiens formed 300 000 to 200 000 years ago.

Everything is review_status "pending".

    python scripts/data/gen_evolution_kntt.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "evolution_kntt.json"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-12.4701665546"

# Bảng 19.1: (id, name vi, name en, amino acids that differ from human cytochrome C).
CYTOCHROME_C = [
    ("chimp", "Tinh tinh", "Chimpanzee", 0),
    ("rhesus", "Khỉ Rhesus", "Rhesus monkey", 1),
    ("rabbit", "Thỏ", "Rabbit", 9),
    ("cow", "Bò", "Cow", 10),
    ("pigeon", "Bồ câu", "Pigeon", 12),
    ("frog", "Ếch ương", "Bullfrog", 18),
    ("fly", "Ruồi giấm", "Fruit fly", 25),
    ("yeast", "Nấm men", "Yeast", 40),
]

# Bảng 22.1: (eon, era, period id, period vi, period en, from, to (None = now), event vi, event en).
GEOLOGIC = [
    ("Phanerozoic", "Cenozoic", "quaternary", "Quaternary (Đệ tứ)", "Quaternary", 1.8, None,
     "Loài người xuất hiện; nhiều thực vật và thú lớn tuyệt chủng.",
     "Humans appear; many plants and large mammals die out."),
    ("Phanerozoic", "Cenozoic", "tertiary", "Tertiary (Đệ tam)", "Tertiary", 65, 1.8,
     "Phát sinh các nhóm linh trưởng, thêm nhiều thú, chim, côn trùng; thực vật có hoa ngự trị.",
     "Primates arise, more mammals, birds and insects; flowering plants dominate."),
    ("Phanerozoic", "Mesozoic", "cretaceous", "Cretaceous (Phấn trắng)", "Cretaceous", 144, 65,
     "Khủng long đạt đỉnh cao rồi tuyệt diệt cuối kỉ; thực vật có hoa phân hóa mạnh.",
     "Dinosaurs peak, then die out at the end; flowering plants diversify."),
    ("Phanerozoic", "Mesozoic", "jurassic", "Jurassic", "Jurassic", 206, 144,
     "Khủng long phát sinh nhiều loài và ngự trị; xuất hiện chim cổ đầu tiên; thực vật hạt trần ngự trị, thực vật có hoa xuất hiện.",
     "Dinosaurs spread and dominate; the first ancient birds; gymnosperms dominate, flowering plants appear."),
    ("Phanerozoic", "Mesozoic", "triassic", "Triassic (Tam điệp)", "Triassic", 248, 206,
     "Xuất hiện khủng long và động vật có vú đầu tiên; thực vật hạt trần và dương xỉ ngự trị.",
     "Dinosaurs and the first mammals appear; gymnosperms and ferns dominate."),
    ("Phanerozoic", "Paleozoic", "permian", "Permian", "Permian", 290, 248,
     "Tuyệt diệt nhiều loài động vật; bò sát phân hóa; phát sinh ngành Thông, Tuế.",
     "Many animals die out; reptiles diversify; conifers and cycads arise."),
    ("Phanerozoic", "Paleozoic", "carboniferous", "Carboniferous (Than đá)", "Carboniferous", 354, 290,
     "Xuất hiện nhiều côn trùng; lưỡng cư ngự trị, bò sát đầu tiên; dương xỉ, rêu, thực vật hạt trần phát triển.",
     "Many insects; amphibians dominate, the first reptiles; ferns, mosses and gymnosperms flourish."),
    ("Phanerozoic", "Paleozoic", "devonian", "Devonian", "Devonian", 417, 354,
     "Tuyệt diệt nhiều động vật biển; xuất hiện lưỡng cư; phát sinh thực vật hạt trần.",
     "Many sea animals die out; amphibians appear; gymnosperms arise."),
    ("Phanerozoic", "Paleozoic", "silurian", "Silurian", "Silurian", 443, 417,
     "Động vật chân khớp và động vật không xương sống lên cạn; thực vật có mạch xuất hiện.",
     "Arthropods and other invertebrates move onto land; vascular plants appear."),
    ("Phanerozoic", "Paleozoic", "ordovician", "Ordovician", "Ordovician", 490, 443,
     "Tuyệt diệt nhiều loài; xuất hiện cá không hàm; thực vật lên cạn.",
     "Many species die out; jawless fish appear; plants move onto land."),
    ("Phanerozoic", "Paleozoic", "cambrian", "Cambrian", "Cambrian", 543, 490,
     "“Bùng nổ” các loài động vật không xương sống; xuất hiện động vật có dây sống.",
     "An “explosion” of invertebrates; the first chordates."),
    ("Proterozoic", None, "proterozoic", "Proterozoic (Nguyên sinh)", "Proterozoic", 2500, 543,
     "Oxygen tích lũy trong khí quyển nhờ quang hợp; sinh vật nhân thực đơn bào và đa bào cổ nhất xuất hiện.",
     "Oxygen builds up in the air from photosynthesis; the oldest single- and many-celled eukaryotes appear."),
    ("Archean", None, "archean", "Archean (Thái cổ)", "Archean", 3800, 2500,
     "Xuất hiện các tế bào vi khuẩn và vi khuẩn cổ đầu tiên.",
     "The first bacteria and archaea appear."),
]
# Eons and eras as Bảng 22.1 prints them.
NAMES = {
    "Phanerozoic": "Phanerozoic (Hiển sinh)", "Proterozoic": "Proterozoic (Nguyên sinh)",
    "Archean": "Archean (Thái cổ)", "Cenozoic": "Cenozoic (Tân sinh)",
    "Mesozoic": "Mesozoic (Trung sinh)", "Paleozoic": "Paleozoic (Cổ sinh)",
}
EARTH_FORMED = 4600  # million years ago (Bảng 22.1)
PROKARYOTE_FOSSILS = 3500  # tr. 115
EUKARYOTE_FOSSILS = 1800  # tr. 115

# Hình 22.4 and tr. 118–119, in millions of years ago: (id, name, from, to (None = now)).
HOMININS = [
    ("ardipithecus", "Ardipithecus ramidus", 4.4, 4.4),
    ("australopithecus", "Australopithecus", 4, 2.5),
    ("homo", "Homo", 2.5, 0.5),
    ("sapiens", "Homo sapiens", 0.3, None),
]


def main() -> None:
    diffs = [d for *_x, d in CYTOCHROME_C]
    assert diffs == sorted(diffs), "Bảng 19.1 is ordered by closeness to humans"
    # Periods follow each other with no gap: one period's start is the next one's end.
    for older, newer in zip(GEOLOGIC[1:], GEOLOGIC[:-1]):
        assert older[6] == newer[5], (older[2], newer[2])
    assert GEOLOGIC[-1][5] < EARTH_FORMED
    out = {
        "dataset": "evolution_kntt",
        "version": 1,
        "accessed": "2026-11-17",
        "review_status": "pending",
        "source": {
            "id": "sgk-sh12-b19-22",
            "citation": (
                "SGK Sinh học 12 Kết nối tri thức, NXB Giáo dục Việt Nam: Bài 19 (Bảng 19.1, tr. 99, sách dẫn "
                "Hoefnagels 2014), Bài 22 (Bảng 22.1, tr. 116; tr. 115; Hình 22.4, tr. 118–119)"
            ),
            "url": READER,
        },
        "items": [
            {"id": i, "name": {"vi": vi, "en": en}, "cytochrome_c_diff": d, "review_status": "pending"}
            for i, vi, en, d in CYTOCHROME_C
        ],
        "geologic": [
            {"eon": eon, "era": era, "id": pid, "name": {"vi": nvi, "en": nen}, "from_mya": a,
             "to_mya": b, "event": {"vi": evi, "en": een}}
            for eon, era, pid, nvi, nen, a, b, evi, een in GEOLOGIC
        ],
        "names": NAMES,
        "earth_formed_mya": EARTH_FORMED,
        "prokaryote_fossils_mya": PROKARYOTE_FOSSILS,
        "eukaryote_fossils_mya": EUKARYOTE_FOSSILS,
        "hominins": [{"id": i, "name": n, "from_mya": a, "to_mya": b} for i, n, a, b in HOMININS],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(CYTOCHROME_C)} species, {len(GEOLOGIC)} periods")


if __name__ == "__main__":
    main()
