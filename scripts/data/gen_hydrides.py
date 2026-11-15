"""Generate data/hydrides.json: normal boiling points of the hydrides of groups 14–17 for
"Liên kết hydrogen và tương tác van der Waals" (Hoá học 10 KNTT Bài 13, #255).

Every value is copied as the page gives it (number, unit, the reference the page cites); nothing
is remembered or estimated. The user's rule (16/11/2026, "bám sát chương trình của sách"): the
textbook's value wherever the book gives one, the other sources only where it does not.

0. SGK Hoá học 10 "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), read as page images
   in NXBGD's reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983 on
   15–16/11/2026: Bài 13, Bảng 13.1 (printed page 65: H2O, H2S, CH4) and Bài 22, Bảng 22.2
   (printed page 113: HF, HCl, HBr, HI). The NIST or PubChem value of those hydrides is kept as a
   second source (`second`). The book itself gives H2S two values: −60,75 °C in Bảng 13.1 and
   −60,28 °C in the question that opens Bài 13 (printed page 64); the table's is used, the other
   is written in the note.
1. NIST Chemistry WebBook, SRD 69 (https://webbook.nist.gov/chemistry/): the compound's "Phase
   change data" page (`cbook.cgi?ID=C<CAS>&Mask=4`), row T_boil. NIST gives one for CH4, H2O, H2S
   and HF only (CH4 and H2O: NIST's average "AVG" of several values, reference "N/A"); all four
   are in the book, so NIST is their second source.
2. Where that page has no T_boil: PubChem, "Chemical and Physical Properties > Experimental
   Properties > Boiling Point" of the compound (PUG-View JSON `.../pug_view/data/compound/<CID>/
   JSON?heading=Boiling+Point`), the entry contributed by the Hazardous Substances Data Bank
   (HSDB), which cites a printed handbook (CRC Handbook or Merck Index).
3. None of the three has one (SnH4, H2Te): no value; the chart leaves a gap and says so.

Pages read on 2026-11-15. The values are not fetched at build time: re-read the pages and edit the
tables below to update. Group and period come from data/elements.json in the app. Everything is
review_status "pending" (docs/DATA_REVIEW.md, HH10-BOND-*).

    python scripts/data/gen_hydrides.py
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[2] / "data" / "hydrides.json"
ACCESSED = "2026-11-15"
NIST_PAGE = "https://webbook.nist.gov/cgi/cbook.cgi?ID=C{cas}&Mask=4"
PUBCHEM_PAGE = "https://pubchem.ncbi.nlm.nih.gov/compound/{cid}#section=Boiling-Point"
PUBCHEM_JSON = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON?heading=Boiling+Point"
SGK_READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983"
SGK = 'SGK Hoá học 10 "Kết nối tri thức với cuộc sống", NXB Giáo dục Việt Nam'

# The textbook's boiling points t_s (°C) as printed (comma decimal): (value, text, lesson/table, page).
BOOK = {
    "h2o": (100.0, "100", "Bài 13, Bảng 13.1", 65),
    "h2s": (-60.75, "−60,75", "Bài 13, Bảng 13.1", 65),
    "ch4": (-161.58, "−161,58", "Bài 13, Bảng 13.1", 65),
    "hf": (19.5, "+19,5", "Bài 22, Bảng 22.2", 113),
    "hcl": (-84.9, "−84,9", "Bài 22, Bảng 22.2", 113),
    "hbr": (-66.7, "−66,7", "Bài 22, Bảng 22.2", 113),
    "hi": (-35.8, "−35,8", "Bài 22, Bảng 22.2", 113),
}
BOOK_NOTE = {
    "h2s": "SGK ghi hai giá trị cho H2S: −60,75 °C ở Bảng 13.1 (tr. 65) và −60,28 °C ở câu hỏi mở đầu Bài 13 (tr. 64); dùng số của bảng.",
}

# id, formula, central element, CAS number (the NIST page is looked up by it), PubChem CID.
HYDRIDES = [
    ("ch4", "CH4", "C", "74-82-8", 297),
    ("sih4", "SiH4", "Si", "7803-62-5", 23953),
    ("geh4", "GeH4", "Ge", "7782-65-2", 23984),
    ("snh4", "SnH4", "Sn", "2406-52-2", 123161),
    ("nh3", "NH3", "N", "7664-41-7", 222),
    ("ph3", "PH3", "P", "7803-51-2", 24404),
    ("ash3", "AsH3", "As", "7784-42-1", 23969),
    ("sbh3", "SbH3", "Sb", "7803-52-3", 9359),
    ("h2o", "H2O", "O", "7732-18-5", 962),
    ("h2s", "H2S", "S", "7783-06-4", 402),
    ("h2se", "H2Se", "Se", "7783-07-5", 533),
    ("h2te", "H2Te", "Te", "7783-09-7", 21765),
    ("hf", "HF", "F", "7664-39-3", 14917),
    ("hcl", "HCl", "Cl", "7647-01-0", 313),
    ("hbr", "HBr", "Br", "10035-10-6", 260),
    ("hi", "HI", "I", "10034-85-2", 24841),
]

# NIST WebBook T_boil rows, as printed: value text, unit, method, reference, comment.
NIST = {
    "ch4": {
        "as_given": "111. ± 2.", "value": 111.0, "uncertainty": 2.0, "unit": "K", "method": "AVG",
        "reference": "N/A", "comment": "Average of 13 values",
    },
    "h2o": {
        "as_given": "373.17 ± 0.04", "value": 373.17, "uncertainty": 0.04, "unit": "K", "method": "AVG",
        "reference": "N/A", "comment": "Average of 7 values",
    },
    "h2s": {
        "as_given": "212.87", "value": 212.87, "unit": "K", "method": "N/A",
        "reference": (
            "Goodwin, R.D., Hydrogen sulfide provisional thermophysical properties from 188 to 700K "
            "at pressures to 75 MPa, Report, NBSIR-83-1694; NTIS No. PB84-122704, 177 pp., 1983."
        ),
        "comment": "Uncertainty assigned by TRC = 0.07 K; TRC",
    },
    "hf": {
        "as_given": "292.7", "value": 292.7, "unit": "K", "method": "N/A",
        "reference": (
            "Streng, A.G., Miscibility and Compatibility of Some Liquid and Solidified Gases at Low "
            "Temperature, J. Chem. Eng. Data, 1971, 16, 357."
        ),
        "comment": "Uncertainty assigned by TRC = 0.25 K; TRC",
    },
}

# PubChem "Boiling Point", HSDB entry: the text as given, its number, the HSDB record and the
# reference HSDB cites (runs of spaces in PubChem's reference strings collapsed to one).
PUBCHEM = {
    "sih4": {
        "as_given": "-112 °C", "value": -112.0, "record": "https://pubchem.ncbi.nlm.nih.gov/source/hsdb/6351",
        "reference": "O'Neil, M.J. (ed.). The Merck Index - An Encyclopedia of Chemicals, Drugs, and Biologicals. 13th Edition, Whitehouse Station, NJ: Merck and Co., Inc., 2001., p. 1523",
    },
    "geh4": {
        "as_given": "-88.1 °C", "value": -88.1, "record": "https://pubchem.ncbi.nlm.nih.gov/source/hsdb/7911",
        "reference": "Lide, D.R. CRC Handbook of Chemistry and Physics 88TH Edition 2007-2008. CRC Press, Taylor & Francis, Boca Raton, FL 2007, p. 4-65",
    },
    "nh3": {
        "as_given": "-33.35 °C at 760 mm Hg", "value": -33.35, "record": "https://pubchem.ncbi.nlm.nih.gov/source/hsdb/162",
        "reference": "O'Neil, M.J. (ed.). The Merck Index - An Encyclopedia of Chemicals, Drugs, and Biologicals. Cambridge, UK: Royal Society of Chemistry, 2013., p. 88",
    },
    "ph3": {
        "as_given": "-87.75 °C", "value": -87.75, "record": "https://pubchem.ncbi.nlm.nih.gov/source/hsdb/1233",
        "reference": "Haynes, W.M. (ed.). CRC Handbook of Chemistry and Physics. 95th Edition. CRC Press LLC, Boca Raton: FL 2014-2015, p. 4-80",
    },
    "ash3": {
        "as_given": "-62.5 °C", "value": -62.5, "record": "https://pubchem.ncbi.nlm.nih.gov/source/hsdb/510",
        "reference": "Haynes, W.M. (ed.) CRC Handbook of Chemistry and Physics. 91st ed. Boca Raton, FL: CRC Press Inc., 2010-2011, p. 4-49",
    },
    "sbh3": {
        "as_given": "-17 °C", "value": -17.0, "record": "https://pubchem.ncbi.nlm.nih.gov/source/hsdb/785",
        "reference": "Haynes, W.M. (ed.). CRC Handbook of Chemistry and Physics. 95th Edition. CRC Press LLC, Boca Raton: FL 2014-2015, p. 4-48",
    },
    "h2se": {
        "as_given": "-41.3 °C", "value": -41.3, "record": "https://pubchem.ncbi.nlm.nih.gov/source/hsdb/548",
        "reference": "O'Neil, M.J. (ed.). The Merck Index - An Encyclopedia of Chemicals, Drugs, and Biologicals. Whitehouse Station, NJ: Merck and Co., Inc., 2006., p. 831",
    },
    "hcl": {
        "as_given": "-85.05 °C at 760 mm Hg", "value": -85.05, "record": "https://pubchem.ncbi.nlm.nih.gov/source/hsdb/545",
        "reference": "O'Neil, M.J. (ed.). The Merck Index - An Encyclopedia of Chemicals, Drugs, and Biologicals. Cambridge, UK: Royal Society of Chemistry, 2013., p. 888",
    },
    "hbr": {
        "as_given": "-66.38 °C", "value": -66.38, "record": "https://pubchem.ncbi.nlm.nih.gov/source/hsdb/570",
        "reference": "Rumble J. (ed.). CRC Handbook of Chemistry and Physics. 99th ed. Cleveland: CRC Press Inc., 2018., p. 4-44",
    },
    "hi": {
        "as_given": "-35.1 °C at 760 mm Hg", "value": -35.1, "record": "https://pubchem.ncbi.nlm.nih.gov/source/hsdb/2155",
        "reference": "O'Neil, M.J. (ed.). The Merck Index - An Encyclopedia of Chemicals, Drugs, and Biologicals. 13th Edition, Whitehouse Station, NJ: Merck and Co., Inc., 2001., p. 858",
    },
}

MISSING = (
    "Trang NIST WebBook (dữ liệu chuyển pha) không có nhiệt độ sôi T_boil và PubChem không có mục "
    "Boiling Point cho chất này (đọc ngày 15/11/2026): chưa có số liệu có nguồn, biểu đồ để trống."
)


def book_value(hid: str):
    value, text, where, page = BOOK[hid]
    return {
        "value": value,
        "unit": "°C",
        "as_given": f"{text} °C",
        "source": "sgk",
        "url": SGK_READER,
        "reference": f"{SGK}, {where}, tr. {page}",
        "note": BOOK_NOTE.get(hid, f"{where}: nhiệt độ sôi t_s (°C) như sách in."),
    }


def boiling_point(hid: str, cas: str, cid: int):
    """The value shown: the textbook's where it gives one, else NIST, else PubChem."""
    if hid in BOOK:
        return book_value(hid)
    return other_source(hid, cas, cid)


def other_source(hid: str, cas: str, cid: int):
    if hid in NIST:
        n = NIST[hid]
        return {
            "value": n["value"],
            **({"uncertainty": n["uncertainty"]} if "uncertainty" in n else {}),
            "unit": n["unit"],
            "as_given": f"{n['as_given']} {n['unit']}",
            "source": "nist",
            "url": NIST_PAGE.format(cas=cas.replace("-", "")),
            "reference": n["reference"],
            "note": f"NIST: method {n['method']}; {n['comment']}",
        }
    if hid in PUBCHEM:
        p = PUBCHEM[hid]
        return {
            "value": p["value"],
            "unit": "°C",
            "as_given": p["as_given"],
            "source": "pubchem",
            "url": PUBCHEM_PAGE.format(cid=cid),
            "reference": p["reference"],
            "note": (
                "PubChem, Experimental Properties > Boiling Point, entry from the Hazardous "
                f"Substances Data Bank ({p['record']}); read via {PUBCHEM_JSON.format(cid=cid)}. "
                f"NIST WebBook {NIST_PAGE.format(cas=cas.replace('-', ''))} lists no T_boil."
            ),
        }
    return None


def main() -> None:
    items = []
    for hid, formula, el, cas, cid in HYDRIDES:
        bp = boiling_point(hid, cas, cid)
        second = other_source(hid, cas, cid) if hid in BOOK else None
        items.append({
            "id": hid,
            "formula": formula,
            "element": el,
            "cas": cas,
            "pubchem_cid": cid,
            "boiling_point": bp,
            **({"second": second} if second else {}),
            **({} if bp else {"missing": MISSING}),
            "review_status": "pending",
        })
    out = {
        "dataset": "hydrides",
        "version": 1,
        "accessed": ACCESSED,
        "source": {
            "id": "sgk-hh10-hydride-bp",
            "citation": (
                "Nhiệt độ sôi thường: SGK Hoá học 10 Kết nối tri thức (Bảng 13.1 tr. 65; Bảng 22.2 "
                "tr. 113) cho các chất sách ghi; chất sách không ghi: NIST Chemistry WebBook, SRD 69 "
                "(P. J. Linstrom, W. G. Mallard, eds.), hoặc PubChem (NCBI), mục Boiling Point do "
                "Hazardous Substances Data Bank cung cấp, kèm tài liệu gốc từng giá trị. NIST/PubChem "
                "còn được ghi làm nguồn thứ hai cho các chất có trong sách. Đọc ngày 15–16/11/2026."
            ),
            "url": SGK_READER,
        },
        "generated_by": "scripts/data/gen_hydrides.py",
        "items": items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} hydrides ({sum(1 for i in items if i['boiling_point'])} with a value)")


if __name__ == "__main__":
    main()
