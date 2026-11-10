"""Generates tests/teaching/teaching-heldout-2.json: the second held-out set for the AI Teacher.

30 items (HOLD2-01 … HOLD2-30), 10 per subject, 2 of each type (misconception, trap, followup,
concept, problem), same schema and scoring as tests/teaching/teaching-heldout.json
(scripts/teaching/rubric.mjs). Patterns are matched on the answer folded to ASCII lower case
(no accents, đ → d, subscript digits as digits; superscripts stay).

Sources: questions and reference answers are original (no textbook/SGK text). Conceptual facts
follow the OpenStax textbooks named in each item; numbers come from the app's own data tables
(data/elements.json, data/genetic_code.json) and closed forms the app's engines use, and
tests/teaching-heldout-2.test.ts checks every number against those engines. Every item is
review_status "pending" until a teacher reviews it (docs/DATA_REVIEW.md, HOLD2-*).

Run: python scripts/data/gen_teaching_heldout2.py   (never edit the JSON by hand)
"""

from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "tests" / "teaching" / "teaching-heldout-2.json"

ELEMENTS = {e["symbol"]: e for e in json.loads((ROOT / "data" / "elements.json").read_text("utf-8"))["items"]}
CODONS = {c["codon"]: c for c in json.loads((ROOT / "data" / "genetic_code.json").read_text("utf-8"))["items"]}

# ---------------------------------------------------------------- shared patterns

# An explicit "no" or correction (keyFacts[0] of misconception and trap items).
NO = (
    r"(^|[.!?:] )[*_ ]*khong( phai| dung| han)?( (vay|the|dau))?[*_ ]*[,.!:]"
    r"|khong (dung|phai)\b|chua (dung|chinh xac)|\bsai\b|nham"
)
# The learner's answer is corrected (keyFacts[0] of followup items).
CORRECTED = r"chua (dung|chinh xac)|\bsai\b|khong (dung|phai)\b|nham"
# Agreeing with a wrong premise, at a sentence opening only.
AGREE = r"(^|[.!?:] )[*_ ]*(dung|chinh xac)([*_ ]*[.!,]| (vay|the|roi)\b)|^[*_ ]*(vang|phai|co)[*_ ]*[,.!]"
# Praising a wrong answer.
PRAISE = (
    r"(em|ban) (da )?(tra loi|giai|tinh|noi|lam) (rat |hoan toan )?(dung|chinh xac)\b"
    r"(?![^.;!?]{0,40}(nhung|mot phan))"
    r"|(^|[.!?:] )[*_ ]*(dung|chinh xac)([*_ ]*[.!,]| (roi|vay)\b)|^[*_ ]*(gioi|tuyet( voi)?|rat tot)[*_ ]*[,.!]"
)
# A unit written after a number, plain or in LaTeX ("8 m/s", "8\,\text{m/s}").
UNIT_GAP = r" ?(\\[,;: ])? ?(\\(text|mathrm|rm)\{ ?)?\(?"


def wrong(phrase: str) -> str:
    """A wrong statement, unless negated just before, called wrong just after, or asked back."""
    guard = r"(?<!(\bkhong|\bchang|\bneu|nham|tuong rang|nghi rang|cho rang|sai lam)\b[^.;!?]{0,40})"
    after = r"(?![^.;!?]{0,30}(sai|chua dung|khong dung|khong phai))"
    return f"(?:{guard}(?:{phrase}){after})(?![^.;!?]*\\?)"


def num(value: str) -> str:
    """A number as written ("0,25" or "0.25"), not part of a longer one."""
    whole, _, frac = value.partition(",")
    if frac:
        return rf"(?<![\d.,]){whole}[,.]{frac}\d*"
    return rf"(?<![\d.,]){whole}(?![\d]|[,.]\d)"


def vi(x: float, digits: int) -> str:
    return f"{x:.{digits}f}".replace(".", ",")


def openstax(book: str, *chapters: str) -> str:
    names = " and ".join(f"'{c}'" for c in chapters)
    return f"OpenStax {book}, chapter {names}. Written by Claude on 2026-11-10 for HOLD2; pending teacher review"


ENGINE = "Number from SimLab's own engine/data ({}), checked in tests/teaching-heldout-2.test.ts. Written by Claude on 2026-11-10 for HOLD2; pending teacher review"

# ---------------------------------------------------------------- numbers from the app's data

PENDULUM_T = 2 * math.pi * math.sqrt(1.6 / 10)  # small-angle period, the app's pendulum card
CENTRIPETAL_A = 2**2 / 0.5  # a = v²/r (src/physics/circular/model.ts)
M_CO2 = ELEMENTS["C"]["atomic_weight"] + 2 * ELEMENTS["O"]["atomic_weight"]
N_CO2 = 11 / M_CO2
NA_CONFIG = " ".join(f"{n}{l}{k}" for n, l, k in ELEMENTS["Na"]["configuration"])
CHAIN = [CODONS[c] for c in ("AUG", "UUU", "GGC", "UAA")]
assert vi(PENDULUM_T, 2) == "2,51"
assert CENTRIPETAL_A == 8
assert vi(N_CO2, 2) == "0,25" and round(M_CO2) == 44
assert NA_CONFIG == "1s2 2s2 2p6 3s1"
assert [c["three"] for c in CHAIN[:3]] == ["Met", "Phe", "Gly"] and CHAIN[3]["stop"]


def item(id_: int, subject: str, type_: str, question: str, key_facts, must_not, expected: str,
         key_points: list[str], reference: str, **extra) -> dict:
    out = {"id": f"HOLD2-{id_:02d}", "subject": subject, "type": type_}
    if "history" in extra:
        out["history"] = extra.pop("history")
    out.update({"question": question, "keyFacts": key_facts, "mustNot": must_not})
    out.update(extra)
    out.update({"expected": expected, "keyPoints": key_points, "reference": reference, "review_status": "pending"})
    return out


def ask(teacher: str, user: str) -> list[dict]:
    return [{"role": "user", "content": user}, {"role": "assistant", "content": teacher}]


ITEMS = [
    # ------------------------------------------------------------ physics
    item(
        1, "physics", "misconception",
        "Có phải một cốc nước sôi chứa nhiều nhiệt năng hơn cả một bể bơi nước ấm, vì cốc nước nóng hơn không ạ?",
        [
            [NO],
            [r"nhiet do (chi |khong )?(cho biet|the hien|phan anh|do|quyet dinh)|(phu thuoc|tuy thuoc|con tuy)[^.;]{0,40}(khoi luong|luong nuoc|so (luong )?phan tu)|khoi luong[^.;]{0,30}(lon|nhieu) hon"],
            [r"be boi[^.;]{0,80}(nhieu|lon) hon|(nhieu|lon) hon[^.;]{0,60}be boi"],
        ],
        [AGREE, wrong(r"coc nuoc (soi )?(chua|co) (nhieu|lon) (nhiet nang |noi nang |nhiet )?hon")],
        "Không phải vậy em ạ. Nhiệt độ cho biết mức nóng lạnh (động năng trung bình của các phân tử), còn nhiệt năng (nội năng) của một vật còn phụ thuộc vào khối lượng, tức là số phân tử. Cốc nước sôi nóng hơn nhưng chỉ có ít nước, còn bể bơi có khối lượng nước lớn hơn rất nhiều, nên nội năng của bể bơi lớn hơn nhiều so với cốc nước. Câu hỏi kiểm tra: nếu đổ cốc nước sôi vào bể bơi thì nhiệt truyền từ đâu sang đâu?",
        ["Không: nhiệt độ khác nhiệt năng (nội năng)", "Nội năng phụ thuộc cả khối lượng (số phân tử)", "Bể bơi có nội năng lớn hơn nhiều dù nhiệt độ thấp hơn"],
        openstax("College Physics 2e", "Temperature, Kinetic Theory, and the Gas Laws", "Heat and Heat Transfer Methods"),
    ),
    item(
        2, "physics", "misconception",
        "Có phải dòng điện bị bóng đèn “dùng hết” một phần, nên cường độ dòng điện ở dây dẫn sau bóng đèn nhỏ hơn ở dây dẫn trước bóng đèn không ạ?",
        [
            [NO],
            [r"(cuong do )?dong dien[^.;]{0,60}(nhu nhau|bang nhau|khong doi|giong nhau|khong (bi )?(giam|mat|hao hut))|(nhu nhau|bang nhau)[^.;]{0,40}(moi|cac) (diem|cho|vi tri)|i_?\{?1\}? ?= ?i_?\{?2"],
            [r"nang luong|dien nang|chuyen hoa|bao toan dien tich|dien tich (khong|chang) (mat|bi tieu hao)"],
        ],
        [AGREE, wrong(r"dong dien (bi )?(dung het|tieu hao|mat di)")],
        "Không đúng em ạ. Trong một mạch nối tiếp, cường độ dòng điện tại mọi điểm là như nhau: dòng điện trước và sau bóng đèn bằng nhau, vì điện tích không mất đi (bảo toàn điện tích). Thứ bóng đèn “dùng” là năng lượng: điện năng được chuyển hóa thành nhiệt và ánh sáng, nên hiệu điện thế giảm khi qua đèn, còn cường độ dòng điện thì không giảm. Câu hỏi kiểm tra: nếu mắc một ampe kế trước và một ampe kế sau bóng đèn thì hai số chỉ thế nào?",
        ["Không: trong mạch nối tiếp cường độ dòng điện như nhau ở mọi điểm", "Điện tích được bảo toàn", "Đèn chuyển hóa điện năng (năng lượng), hiệu điện thế giảm qua đèn"],
        openstax("College Physics 2e", "Electric Current, Resistance, and Ohm's Law", "Circuits, Bioelectricity, and DC Instruments"),
    ),
    item(
        3, "physics", "trap",
        "Vật nổi được trên nước là vì vật nhẹ. Vậy một con tàu bằng thép nặng hàng nghìn tấn chắc chắn không thể nổi, đúng không ạ?",
        [
            [NO + r"|tau (van )?(noi|co the noi)"],
            [r"ac-?si-?met|archimedes|luc day|luc nang"],
            [r"khoi luong rieng|the tich (nuoc )?(bi )?(chiem|chiem cho)|(chiem|choan) (mot )?(the tich|luong) nuoc|nuoc (bi )?(chiem cho|day ra)|rong ben trong|khong khi ben trong|(nhieu|chua) khong khi"],
        ],
        [AGREE, wrong(r"(tau|con tau)[^.;!?]{0,20}(khong the|khong) noi")],
        "Không phải vậy em ạ: con tàu thép vẫn nổi được. Vật nổi hay chìm không chỉ do nặng hay nhẹ, mà do lực đẩy Ác-si-mét so với trọng lượng của vật. Thân tàu rỗng, bên trong có nhiều không khí, nên tàu chiếm một thể tích nước rất lớn; khi trọng lượng phần nước bị tàu chiếm chỗ bằng trọng lượng của tàu thì lực đẩy cân bằng với trọng lực và tàu nổi. Nói cách khác, khối lượng riêng trung bình của cả con tàu (thép cùng không khí bên trong) nhỏ hơn của nước. Câu hỏi kiểm tra: vì sao một khối thép đặc cùng khối lượng lại chìm?",
        ["Không: tàu thép vẫn nổi", "Lực đẩy Ác-si-mét bằng trọng lượng phần nước bị chiếm chỗ", "Thân tàu rỗng: khối lượng riêng trung bình nhỏ hơn của nước"],
        openstax("College Physics 2e", "Fluid Statics"),
        trap={"note": "Cho rằng vật nổi chỉ vì nhẹ. Vật nổi khi lực đẩy Ác-si-mét (trọng lượng phần chất lỏng bị chiếm chỗ) cân bằng trọng lượng; thân tàu rỗng nên khối lượng riêng trung bình nhỏ hơn nước.", "premise": True},
    ),
    item(
        4, "physics", "trap",
        "Công suất bằng lực nhân với quãng đường, nên máy có công suất lớn hơn thì lúc nào cũng sinh công nhiều hơn, đúng không ạ?",
        [
            [NO],
            [r"cong suat[^.;]{0,40}(la |bang )?(cong|a)[^.;]{0,30}(chia|tren|/)[^.;]{0,10}(thoi gian|t\b)|p ?= ?a ?/ ?t|\\frac\{ ?a ?\}\{ ?t|cong (thuc hien )?trong (mot )?don vi thoi gian"],
            [r"(phu thuoc|tuy thuoc|con tuy)[^.;]{0,40}thoi gian|thoi gian[^.;]{0,60}(it|ngan|lau|dai) hon|(chay|hoat dong|lam viec) (lau|it|ngan)"],
        ],
        [AGREE],
        "Chưa đúng em ạ. Lực nhân quãng đường (A = F·s) là công, không phải công suất. Công suất là công thực hiện trong một đơn vị thời gian: P = A/t. Vì vậy máy có công suất lớn chỉ sinh công nhanh hơn; công sinh ra còn phụ thuộc vào thời gian máy chạy. Một máy công suất nhỏ chạy lâu vẫn có thể sinh công nhiều hơn một máy công suất lớn chạy trong thời gian ngắn. Câu hỏi kiểm tra: máy 1000 W chạy 10 s và máy 500 W chạy 30 s, máy nào sinh công nhiều hơn?",
        ["Không: A = F·s là công, không phải công suất", "Công suất P = A/t (công trong một đơn vị thời gian)", "Công sinh ra còn phụ thuộc thời gian"],
        openstax("College Physics 2e", "Work, Energy, and Energy Resources"),
        trap={"note": "Nhầm công (A = F·s) với công suất (P = A/t) và cho rằng công suất lớn thì công luôn lớn; công còn phụ thuộc thời gian.", "premise": True},
    ),
    item(
        5, "physics", "followup",
        "Dạ, 2 N ạ.",
        [
            [CORRECTED],
            [num("20") + UNIT_GAP + r"n\b|(=|la|bang) ?20\b(?![.,]\d)|2 ?[.·×*x] ?10\b"],
        ],
        [PRAISE, wrong(r"trong luong[^.;!?\d]{0,30}(=|la|bang) ?2" + UNIT_GAP + r"n\b")],
        "Chưa đúng em ạ. Trọng lượng P = m·g = 2 · 10 = 20 N. Con số 2 là khối lượng của vật (đơn vị kg); em cần nhân với gia tốc trọng trường g mới ra trọng lượng (đơn vị N). Câu hỏi kiểm tra: mang vật này lên Mặt Trăng, nơi g nhỏ hơn, thì khối lượng hay trọng lượng của nó thay đổi?",
        ["Chưa đúng", "P = m·g = 2·10 = 20 N", "2 là khối lượng (kg), chưa nhân với g"],
        openstax("College Physics 2e", "Dynamics: Force and Newton's Laws of Motion"),
        history=ask(
            "Trọng lượng là độ lớn của trọng lực tác dụng lên vật, tính bằng P = m·g. Câu hỏi kiểm tra: một vật khối lượng 2 kg ở nơi có g = 10 m/s² thì trọng lượng bằng bao nhiêu?",
            "Trọng lượng của một vật được tính thế nào ạ?",
        ),
        derivation="P = m·g = 2·10 = 20 N. Câu trả lời 2 N lấy khối lượng làm trọng lượng.",
    ),
    item(
        6, "physics", "followup",
        "Dạ, 4 J ạ.",
        [
            [CORRECTED],
            [num("8") + UNIT_GAP + r"j\b|(=|la|bang) ?8\b(?![.,]\d)|16 ?/ ?2|1/2 ?[.·×*]? ?1 ?[.·×*]? ?(16|4 ?(\^ ?\{?2\}?|²))"],
        ],
        [PRAISE, wrong(r"(dong nang|w_?\{?d\}?)[^.;!?\d]{0,30}(=|la|bang) ?4" + UNIT_GAP + r"j\b")],
        "Chưa đúng em ạ. Wđ = ½·m·v² = ½ · 1 · 4² = ½ · 16 = 8 J. Em đã quên bình phương tốc độ: phải lấy 4² = 16 rồi mới nhân với ½ và với khối lượng. Câu hỏi kiểm tra: nếu tốc độ tăng gấp đôi thành 8 m/s thì động năng tăng mấy lần?",
        ["Chưa đúng", "Wđ = ½·m·v² = ½·1·4² = 8 J", "Lỗi: quên bình phương tốc độ"],
        openstax("College Physics 2e", "Work, Energy, and Energy Resources"),
        history=ask(
            "Động năng của một vật khối lượng m chuyển động với tốc độ v là Wđ = ½·m·v². Câu hỏi kiểm tra: một vật 1 kg chuyển động với tốc độ 4 m/s thì động năng bằng bao nhiêu?",
            "Động năng tính bằng công thức nào ạ?",
        ),
        derivation="Wđ = ½·1·4² = 8 J. Câu trả lời 4 J là ½·1·4·2 hoặc 1·4 (không bình phương v).",
    ),
    item(
        7, "physics", "concept",
        "Vì sao khi xe buýt đang chạy mà phanh gấp, hành khách đứng trên xe bị chúi người về phía trước?",
        [
            [r"quan tinh"],
            [r"(giu|duy tri|tiep tuc)[^.;]{0,40}(chuyen dong|van toc|toc do)|xu huong[^.;]{0,40}(chuyen dong|giu)|dinh luat (i|1|mot)\b|newton (i|1|mot)\b"],
            [r"(chan|ban chan|phan duoi)[^.;]{0,60}(giam toc|dung lai|cham lai)|(xe|san xe)[^.;]{0,40}(dung lai|giam toc|cham lai)"],
        ],
        [wrong(r"(luc|mot luc) (day|xo|keo)[^.;!?]{0,30}(nguoi|hanh khach)[^.;!?]{0,20}(ve )?phia truoc")],
        "Do quán tính em ạ. Khi xe đang chạy, cả xe và người cùng chuyển động về phía trước. Lúc phanh gấp, xe và bàn chân của hành khách (nhờ ma sát với sàn xe) bị giảm tốc rất nhanh, còn phần thân trên của người chưa kịp thay đổi vận tốc nên vẫn có xu hướng tiếp tục chuyển động về phía trước như cũ (định luật I Newton). Vì vậy người bị chúi về phía trước; không có lực nào đẩy người về phía trước cả. Câu hỏi kiểm tra: khi xe đang đứng yên mà đột ngột chạy tới, hành khách bị ngả về phía nào?",
        ["Quán tính (định luật I Newton)", "Thân người có xu hướng giữ vận tốc cũ", "Xe và chân bị hãm lại, không có lực đẩy người về phía trước"],
        openstax("College Physics 2e", "Dynamics: Force and Newton's Laws of Motion"),
    ),
    item(
        8, "physics", "concept",
        "Âm thanh có truyền được trong chân không không? Vì sao?",
        [
            [r"khong (the )?truyen|khong lan truyen"],
            [r"(can|phai co|nho|qua) (mot )?moi truong|moi truong (vat chat|truyen am)|chat ran|chat long|chat khi"],
            [r"(song co|dao dong)[^.;]{0,60}(phan tu|hat)|phan tu[^.;]{0,40}dao dong|khong co (phan tu|hat|vat chat|khong khi)"],
        ],
        [wrong(r"am (thanh )?(van |co the )?truyen (duoc )?(trong|qua) (moi truong )?chan khong")],
        "Không, âm thanh không truyền được trong chân không. Âm là sóng cơ: nó lan truyền nhờ các phần tử của môi trường (chất rắn, chất lỏng, chất khí) dao động và truyền dao động cho nhau. Trong chân không không có phần tử vật chất nào để dao động nên âm không lan truyền được. Vì thế các nhà du hành ngoài không gian phải liên lạc bằng sóng vô tuyến. Câu hỏi kiểm tra: ánh sáng có truyền được trong chân không không?",
        ["Không truyền được", "Âm là sóng cơ, cần môi trường (rắn, lỏng, khí)", "Chân không không có phần tử vật chất để dao động"],
        openstax("College Physics 2e", "Physics of Hearing"),
    ),
    item(
        9, "physics", "problem",
        "Một con lắc đơn dài 1,6 m dao động với biên độ nhỏ ở nơi có gia tốc trọng trường g = 10 m/s². Tính chu kì dao động của con lắc.",
        [
            [r"(?<![\d.,])2[,.]5[0-2]\d*" + UNIT_GAP + r"(s\b|giay)|(≈|=|la|bang|xap xi) ?2[,.]5[0-2]\d*|0[,.]8 ?(\\cdot ?)?(π|\\pi|pi)\b"],
            [r"2 ?(\\cdot ?)?(π|\\pi|pi) ?(\\cdot ?|[.·×*] ?)?(\\sqrt|√|can)|√ ?\(? ?l ?/ ?g|\\sqrt\{ ?\\frac\{ ?l|can (bac hai )?(cua )?(l ?/ ?g|1[,.]6 ?/ ?10)|0[,.]16\b"],
        ],
        [wrong(r"(?<![\d.,])(0[,.]4|15[,.]7|1[,.]0[01]?)\d*" + UNIT_GAP + r"(s\b|giay)")],
        "Với dao động nhỏ, chu kì con lắc đơn là T = 2π·√(l/g). Thay số: l/g = 1,6/10 = 0,16 và √0,16 = 0,4, nên T = 2π · 0,4 = 0,8π ≈ 2,51 s. Chu kì không phụ thuộc vào khối lượng quả nặng (khi biên độ nhỏ).",
        ["T = 2π·√(l/g)", "l/g = 0,16, √0,16 = 0,4", "T = 0,8π ≈ 2,51 s", "Sai điển hình: 0,4 s (quên 2π), ≈ 1,0 s (quên căn), ≈ 15,7 s (đảo l và g)"],
        ENGINE.format("src/physics/pendulum, numericPeriodPendulum at a small amplitude"),
        derivation=f"T = 2π·√(1,6/10) = 0,8π = {vi(PENDULUM_T, 4)} s ≈ 2,51 s. mustNot: 0,4 s = √0,16 (quên 2π), 2π·0,16 ≈ 1,01 s (quên căn), 2π·√(10/1,6) ≈ 15,7 s (đảo l và g).",
    ),
    item(
        10, "physics", "problem",
        "Một vật nhỏ chuyển động tròn đều trên quỹ đạo bán kính 0,5 m với tốc độ 2 m/s. Tính gia tốc hướng tâm của vật.",
        [
            [num("8") + UNIT_GAP + r"m ?/ ?s|(=|la|bang) ?8\b(?![.,]\d)"],
            [r"v ?(\^ ?\{?2\}?|²) ?/ ?r|\\frac\{ ?v ?\^ ?\{?2\}? ?\}\{ ?r|4 ?/ ?0[,.]5|2 ?(\^ ?\{?2\}?|²) ?/ ?0[,.]5|\\frac\{ ?4 ?\}\{ ?0[,.]5"],
        ],
        [wrong(r"(?<![\d.,])(4|1|16)(?![\d]|[,.]\d)" + UNIT_GAP + r"m ?/ ?s ?(\^ ?\{?2\}?|²)")],
        "Gia tốc hướng tâm a = v²/r = 2²/0,5 = 4/0,5 = 8 m/s², hướng vào tâm quỹ đạo. Tốc độ không đổi nhưng hướng của vận tốc luôn thay đổi, nên vật vẫn có gia tốc.",
        ["a = v²/r", "a = 4/0,5 = 8 m/s²", "Hướng vào tâm", "Sai điển hình: 4 m/s² (v/r), 1 m/s² (v·r), 16 m/s²"],
        ENGINE.format("src/physics/circular/model.ts, circular().aC"),
        derivation="a = v²/r = 4/0,5 = 8 m/s². mustNot: v/r = 4 m/s², v·r = 1 m/s², v²/r² = 16 m/s².",
    ),
    # ------------------------------------------------------------ chemistry
    item(
        11, "chemistry", "misconception",
        "Có phải mọi chất rắn khi đun nóng đều phải nóng chảy thành chất lỏng trước rồi mới chuyển thành hơi không ạ?",
        [
            [NO],
            [r"thang hoa"],
            [r"\biot\b|\bi2\b|da kho|co2 (ran|o the ran)|bang phien|naphtalen|naphthalene|long nao"],
        ],
        [AGREE, wrong(r"(moi|tat ca( cac)?) chat ran (deu )?(phai )?(nong chay|hoa long) (truoc|roi)")],
        "Không phải em ạ. Có những chất rắn chuyển thẳng thành hơi mà không qua thể lỏng; hiện tượng này gọi là sự thăng hoa. Ví dụ: iot (I₂) khi đun nhẹ tạo hơi màu tím, đá khô (CO₂ rắn) ở áp suất thường bay hơi thẳng mà không chảy lỏng, băng phiến cũng thăng hoa dần ở nhiệt độ phòng. Một chất nóng chảy hay thăng hoa còn tùy vào nhiệt độ và áp suất. Câu hỏi kiểm tra: vì sao đá khô được gọi là “khô”?",
        ["Không: có chất thăng hoa (rắn → hơi)", "Ví dụ iot, đá khô (CO₂ rắn), băng phiến", "Phụ thuộc nhiệt độ và áp suất"],
        openstax("Chemistry 2e", "Liquids and Solids"),
    ),
    item(
        12, "chemistry", "misconception",
        "Có phải dung dịch axit mạnh lúc nào cũng có pH nhỏ hơn dung dịch axit yếu, dù nồng độ của chúng khác nhau thế nào không ạ?",
        [
            [NO],
            [r"(phu thuoc|tuy thuoc|con tuy)[^.;]{0,30}nong do|cung nong do|\bloang\b|\bdac\b"],
            [r"(phan li|dien li|phan ly)[^.;]{0,40}(hoan toan|mot phan|khong hoan toan)|(hoan toan|mot phan)[^.;]{0,30}(phan li|dien li|phan ly)"],
        ],
        [AGREE],
        "Không phải lúc nào cũng vậy em ạ. Axit mạnh phân li hoàn toàn, axit yếu chỉ phân li một phần, nhưng pH còn phụ thuộc vào nồng độ. Ví dụ dung dịch HCl rất loãng 10⁻⁵ M có pH = 5, còn dung dịch CH₃COOH 0,1 M có pH khoảng 2,9 (Ka ≈ 1,8·10⁻⁵ ở 25 °C). Vậy một axit yếu đặc hơn có thể có pH thấp hơn một axit mạnh rất loãng. Chỉ khi cùng nồng độ thì axit mạnh mới có pH nhỏ hơn. Câu hỏi kiểm tra: dung dịch HCl 0,01 M có pH bằng bao nhiêu?",
        ["Không: pH còn phụ thuộc nồng độ", "Axit mạnh phân li hoàn toàn, axit yếu phân li một phần", "Ví dụ HCl 10⁻⁵ M (pH 5) và CH₃COOH 0,1 M (pH ≈ 2,9)"],
        openstax("Chemistry 2e", "Acid-Base Equilibria"),
        derivation="CH₃COOH 0,1 M, Ka = 1,8·10⁻⁵: x²/(0,1 − x) = 1,8·10⁻⁵ ⇒ x ≈ 1,33·10⁻³ M ⇒ pH ≈ 2,88. HCl 10⁻⁵ M: [H⁺] = 10⁻⁵ M ⇒ pH = 5 (bỏ qua sự điện li của nước).",
    ),
    item(
        13, "chemistry", "trap",
        "Vì nguyên tử trung hòa về điện nên trong mọi nguyên tử, số proton luôn bằng số nơtron, đúng không ạ?",
        [
            [NO],
            [r"(so )?proton[^.;]{0,40}(bang|=)[^.;]{0,20}(so )?electron|so p ?= ?so e|\bp ?= ?e\b"],
            [r"(notron|neutron)[^.;]{0,60}(khong mang dien|khong co dien tich|khong (nhat thiet|can|phai) bang|co the khac|khac nhau|nhieu hon)|dong vi"],
        ],
        [AGREE],
        "Không đúng em ạ. Nguyên tử trung hòa về điện vì số proton (mang điện dương) bằng số electron (mang điện âm). Nơtron không mang điện nên số nơtron không cần bằng số proton. Ví dụ nguyên tử ³⁵Cl có 17 proton nhưng 18 nơtron; các đồng vị của cùng một nguyên tố có số nơtron khác nhau. Câu hỏi kiểm tra: nguyên tử ³⁷Cl có bao nhiêu nơtron?",
        ["Không: trung hòa điện là số proton = số electron", "Nơtron không mang điện, số nơtron có thể khác số proton", "Ví dụ ³⁵Cl: 17 p, 18 n; đồng vị"],
        openstax("Chemistry 2e", "Atoms, Molecules, and Ions"),
        trap={"note": "Nhầm điều kiện trung hòa điện: số proton bằng số electron, không phải số nơtron (nơtron không mang điện).", "premise": True},
    ),
    item(
        14, "chemistry", "trap",
        "Phản ứng tỏa nhiệt thì luôn xảy ra nhanh. Vì đốt than là phản ứng tỏa nhiệt, nên than để ngoài không khí ở nhiệt độ phòng sẽ tự bốc cháy ngay, đúng không ạ?",
        [
            [NO + r"|khong (tu )?(boc )?chay"],
            [r"nang luong hoat hoa|(phai|can) (duoc )?(dot|moi|nung|dun)|moi lua|dot nong"],
            [r"khong cho biet[^.;]{0,30}toc do|toc do[^.;]{0,30}(khong|chang) (lien quan|phu thuoc)|(toa nhiet|thu nhiet)[^.;]{0,60}khong (quyet dinh|lien quan)"],
        ],
        [AGREE],
        "Không phải vậy em ạ: than để ngoài không khí không tự bốc cháy. Phản ứng tỏa nhiệt chỉ cho biết phản ứng giải phóng năng lượng; nó không cho biết tốc độ phản ứng nhanh hay chậm. Muốn than cháy, phải đốt nóng (mồi lửa) để cung cấp năng lượng hoạt hóa ban đầu; khi đã cháy, nhiệt tỏa ra lại làm nóng phần than bên cạnh nên phản ứng tự duy trì. Câu hỏi kiểm tra: vì sao que diêm phải quẹt mới cháy?",
        ["Không: tỏa nhiệt không có nghĩa là nhanh", "Tốc độ phụ thuộc năng lượng hoạt hóa, cần mồi (đốt nóng)", "Khi đã cháy, nhiệt tỏa ra duy trì phản ứng"],
        openstax("Chemistry 2e", "Kinetics", "Thermochemistry"),
        trap={"note": "Nhầm phản ứng tỏa nhiệt với phản ứng nhanh: nhiệt phản ứng không quyết định tốc độ; than cần năng lượng hoạt hóa (mồi) mới cháy.", "premise": True},
    ),
    item(
        15, "chemistry", "followup",
        "Dạ, 1s² 2s² 2p⁶ 3s² ạ.",
        [
            [CORRECTED],
            [r"3s ?(\^ ?\{?1\}?|¹|1)(?!\d)"],
            [r"(12|muoi hai) electron|(11|muoi mot) electron|z ?= ?11|\bmg\b|magie|magnesium"],
        ],
        [PRAISE],
        "Chưa đúng em ạ. Natri có Z = 11 nên có 11 electron; cấu hình em viết có 2 + 2 + 6 + 2 = 12 electron (đó là cấu hình của magie). Cấu hình đúng của Na là 1s² 2s² 2p⁶ 3s¹, viết gọn [Ne] 3s¹. Câu hỏi kiểm tra: Na có mấy electron ở lớp ngoài cùng?",
        ["Chưa đúng", "Na có 11 electron: 1s² 2s² 2p⁶ 3s¹ ([Ne] 3s¹)", "Cấu hình đã viết có 12 electron (Mg)"],
        ENGINE.format("data/elements.json, the configuration of Na"),
        history=ask(
            "Cấu hình electron cho biết các electron của nguyên tử được phân bố vào các phân lớp như thế nào. Câu hỏi kiểm tra: em viết cấu hình electron của nguyên tử natri (Z = 11) nhé?",
            "Cấu hình electron cho biết điều gì ạ?",
        ),
        derivation=f"Na (Z = 11): {NA_CONFIG} (bảng dữ liệu của app). Cấu hình đã viết có 12 electron.",
    ),
    item(
        16, "chemistry", "followup",
        "Dạ, 9 mol ạ.",
        [
            [CORRECTED],
            [num("0,5") + UNIT_GAP + r"mol|(=|la|bang|≈) ?0[,.]5\b|9 ?/ ?18|\\frac\{ ?9 ?\}\{ ?18"],
            [r"\b18\b"],
        ],
        [PRAISE, wrong(r"(?<![\d.,])9" + UNIT_GAP + r"mol\b")],
        "Chưa đúng em ạ. Khối lượng mol của nước M = 2·1 + 16 = 18 g/mol, nên n = m/M = 9/18 = 0,5 mol. Con số 9 là khối lượng (gam), em cần chia cho khối lượng mol. Câu hỏi kiểm tra: 36 gam nước thì có bao nhiêu mol?",
        ["Chưa đúng", "M(H₂O) = 18 g/mol", "n = 9/18 = 0,5 mol"],
        ENGINE.format("molarMass in src/chemistry/formula.ts, with the masses the question gives"),
        history=ask(
            "Số mol n = m/M, với m là khối lượng chất (g) và M là khối lượng mol (g/mol). Câu hỏi kiểm tra: 9 gam nước (H₂O) có bao nhiêu mol? Cho H = 1, O = 16.",
            "Số mol được tính thế nào ạ?",
        ),
        derivation="M = 2·1 + 16 = 18 g/mol (theo số đề cho); n = 9/18 = 0,5 mol.",
    ),
    item(
        17, "chemistry", "concept",
        "Vì sao nước (H₂O) sôi ở 100 °C, cao hơn nhiều so với H₂S, dù phân tử H₂S nặng hơn?",
        [
            [r"lien ket hi?dro|lien ket hydro|hydrogen bond"],
            [r"(oxi|oxy)[^.;]{0,60}(do )?am dien (lon|manh|cao)|(do )?am dien[^.;]{0,40}(oxi|oxy)|luu huynh[^.;]{0,40}(am dien )?(yeu|nho|kem)"],
            [r"(can|ton|phai cung cap) (nhieu )?(nang luong|nhiet)[^.;]{0,40}(pha vo|tach|be gay|thang)|(giua|cac) (cac )?phan tu[^.;]{0,40}(hut nhau|lien ket)"],
        ],
        [wrong(r"(pha vo|be gay|tach) (cac )?lien ket (cong hoa tri|o ?[-–] ?h)")],
        "Vì giữa các phân tử nước có liên kết hiđro. Oxi có độ âm điện lớn nên liên kết O–H phân cực mạnh: nguyên tử H của phân tử này hút cặp electron tự do của O ở phân tử bên cạnh. Lưu huỳnh có độ âm điện nhỏ hơn nhiều nên giữa các phân tử H₂S hầu như không có liên kết hiđro, chúng chỉ hút nhau yếu. Muốn nước sôi phải cung cấp nhiều năng lượng để tách các phân tử khỏi liên kết hiđro, nên nhiệt độ sôi của nước cao hơn (H₂S sôi ở khoảng −60 °C). Khi sôi, các liên kết cộng hóa trị O–H bên trong mỗi phân tử không bị phá vỡ.",
        ["Liên kết hiđro giữa các phân tử nước", "O có độ âm điện lớn, S nhỏ hơn: H₂S hầu như không có liên kết hiđro", "Cần nhiều năng lượng để tách các phân tử; liên kết O–H trong phân tử không bị phá"],
        openstax("Chemistry 2e", "Liquids and Solids"),
    ),
    item(
        18, "chemistry", "concept",
        "Vì sao kim loại dẫn điện tốt?",
        [
            [r"electron tu do|e tu do|electron (linh dong|chuyen dong tu do|khong bi giu chat)|bien electron|dam may electron"],
            [r"(chuyen dong|di chuyen)[^.;]{0,40}(co huong|thanh dong|theo (mot )?huong)|hieu dien the|dien truong"],
            [r"lien ket kim loai|ion (kim loai )?duong|cation|mang tinh the"],
        ],
        [],
        "Vì trong kim loại có rất nhiều electron tự do. Ở mạng tinh thể kim loại, các ion dương nằm ở các nút mạng, còn electron hóa trị không bị giữ chặt ở một nguyên tử nào mà chuyển động tự do giữa các ion (liên kết kim loại). Khi đặt một hiệu điện thế vào hai đầu dây kim loại, các electron tự do này chuyển động có hướng và tạo thành dòng điện. Câu hỏi kiểm tra: vì sao muối ăn ở thể rắn không dẫn điện?",
        ["Kim loại có nhiều electron tự do", "Liên kết kim loại: ion dương ở nút mạng, electron chuyển động giữa các ion", "Có hiệu điện thế: electron chuyển động có hướng thành dòng điện"],
        openstax("Chemistry 2e", "Liquids and Solids"),
    ),
    item(
        19, "chemistry", "problem",
        "Cân bằng phương trình phản ứng đốt cháy etan: C2H6 + O2 → CO2 + H2O.",
        [
            [r"2 ?c2h6 ?\+ ?7 ?o2 ?(→|->|=|⟶|tao thanh) ?4 ?co2 ?\+ ?6 ?h2o|2 ?c_?\{?2\}?h_?\{?6\}? ?\+ ?7 ?o_?\{?2\}? ?(→|->|=|⟶|\\to|\\rightarrow) ?4 ?co_?\{?2\}? ?\+ ?6 ?h_?\{?2\}?o"],
        ],
        [wrong(r"(?<![\d])c2h6 ?\+ ?3[,.]5 ?o2|2 ?c2h6 ?\+ ?7 ?o2 ?(→|->|=) ?2 ?co2")],
        "Phương trình đã cân bằng: 2C₂H₆ + 7O₂ → 4CO₂ + 6H₂O (hệ số 2 : 7 : 4 : 6). Kiểm tra: vế trái có 4 C, 12 H và 14 O; vế phải 4CO₂ có 4 C và 8 O, 6H₂O có 12 H và 6 O, tổng 14 O.",
        ["2C₂H₆ + 7O₂ → 4CO₂ + 6H₂O", "Đếm nguyên tử: C 4 = 4, H 12 = 12, O 14 = 14", "Hệ số nguyên nhỏ nhất (không để 3,5 O₂)"],
        ENGINE.format("balance in src/chemistry/balance.ts"),
        derivation="Bộ cân bằng của app: hệ số 2, 7, 4, 6. C: 2·2 = 4; H: 2·6 = 6·2 = 12; O: 7·2 = 14 = 4·2 + 6.",
    ),
    item(
        20, "chemistry", "problem",
        "Tính số mol phân tử có trong 11 gam khí cacbon đioxit (CO2).",
        [
            [num("0,25") + UNIT_GAP + r"mol|(=|la|bang|≈) ?0[,.]25\b|\\frac\{ ?1 ?\}\{ ?4|1 ?/ ?4 ?mol"],
            [r"\b44\b|44[,.]0"],
        ],
        [wrong(num("4") + UNIT_GAP + r"mol\b"), wrong(r"(?<![\d.,])0[,.]5" + UNIT_GAP + r"mol\b")],
        "Khối lượng mol của CO₂: M = 12 + 2·16 = 44 g/mol. Số mol n = m/M = 11/44 = 0,25 mol.",
        ["M(CO₂) = 44 g/mol", "n = 11/44 = 0,25 mol", "Sai điển hình: 4 mol (chia ngược 44/11), 0,5 mol"],
        ENGINE.format("molarMass in src/chemistry/formula.ts (standard atomic weights)"),
        derivation=f"M(CO₂) = {vi(M_CO2, 3)} g/mol (nguyên tử khối chuẩn trong bảng của app; làm tròn 44); n = 11/{vi(M_CO2, 3)} = {vi(N_CO2, 4)} ≈ 0,25 mol.",
    ),
    # ------------------------------------------------------------ biology
    item(
        21, "biology", "misconception",
        "Có phải tế bào thực vật không có ti thể, vì đã có lục lạp để tạo năng lượng rồi không ạ?",
        [
            [NO],
            [r"thuc vat( thi)? (van |cung |deu )?co (ca )?ti the|co ca (ti the|luc lap) (va|lan) (ti the|luc lap)|ti the (van |cung )?(co|ton tai) (ca )?o (te bao )?thuc vat"],
            [r"ho hap( te bao)?|\batp\b"],
        ],
        [AGREE, wrong(r"(te bao )?thuc vat (thi )?khong (can |co )ti the")],
        "Không phải em ạ. Tế bào thực vật có cả lục lạp và ti thể. Lục lạp thực hiện quang hợp, biến năng lượng ánh sáng thành năng lượng hóa học trong đường. Ti thể thực hiện hô hấp tế bào, phân giải chất hữu cơ để tạo ATP dùng cho các hoạt động sống, cả ban ngày lẫn ban đêm và ở cả những phần không có lục lạp như rễ. Câu hỏi kiểm tra: tế bào rễ cây lấy năng lượng từ đâu khi không có lục lạp?",
        ["Không: tế bào thực vật có cả ti thể và lục lạp", "Ti thể: hô hấp tế bào, tạo ATP", "Lục lạp: quang hợp; rễ không có lục lạp vẫn cần ti thể"],
        openstax("Biology 2e", "Cell Structure", "Cellular Respiration"),
    ),
    item(
        22, "biology", "misconception",
        "Có phải vi khuẩn nào cũng gây bệnh cho con người không ạ?",
        [
            [NO],
            [r"(phan lon|da so|nhieu|hau het)[^.;]{0,40}(vi khuan|loai)[^.;]{0,40}(khong (gay benh|hai)|vo hai|co loi)|co loi|vo hai"],
            [r"\bruot\b|tieu hoa|sua chua|co dinh (dam|nito|nitrogen)|phan giai|vitamin"],
        ],
        [AGREE, wrong(r"(moi|tat ca( cac)?) vi khuan (deu )?(gay benh|co hai)")],
        "Không phải em ạ. Chỉ một phần nhỏ vi khuẩn gây bệnh; phần lớn vi khuẩn vô hại, nhiều loài còn có lợi. Ví dụ vi khuẩn trong ruột giúp tiêu hóa và tạo một số vitamin (như vitamin K), vi khuẩn lactic được dùng để làm sữa chua, vi khuẩn cố định đạm giúp cây có nitơ, vi khuẩn phân giải xác sinh vật trả lại chất khoáng cho đất. Câu hỏi kiểm tra: em kể thêm một món ăn được làm nhờ vi khuẩn nhé?",
        ["Không: chỉ một phần nhỏ vi khuẩn gây bệnh", "Phần lớn vô hại, nhiều loài có lợi", "Ví dụ: vi khuẩn đường ruột, sữa chua, cố định đạm, phân giải"],
        openstax("Biology 2e", "Prokaryotes: Bacteria and Archaea"),
    ),
    item(
        23, "biology", "trap",
        "Vì loài người tiến hóa từ loài tinh tinh, nên các con tinh tinh ngày nay rồi cũng sẽ tiến hóa thành người, đúng không ạ?",
        [
            [NO],
            [r"to tien chung|chung (mot )?to tien|ho hang|(hai )?nhanh[^.;]{0,20}(tach|re)"],
            [r"(khong|chang) (co )?(muc dich|dinh huong|dich den)|chon loc tu nhien|ngau nhien"],
        ],
        [AGREE, wrong(r"(nguoi|loai nguoi|con nguoi) (da )?tien hoa tu (loai )?tinh tinh")],
        "Không đúng em ạ. Loài người không tiến hóa từ tinh tinh ngày nay; người và tinh tinh có chung một tổ tiên sống cách đây vài triệu năm, rồi hai nhánh tách ra và tiến hóa riêng. Tinh tinh hiện nay cũng đã trải qua chừng ấy thời gian tiến hóa như người. Tiến hóa không có mục đích hay đích đến: chọn lọc tự nhiên giữ lại những biến dị phù hợp với môi trường sống của mỗi loài, nên tinh tinh không “đang trên đường” trở thành người. Câu hỏi kiểm tra: vì sao có thể nói người và tinh tinh là họ hàng gần?",
        ["Không: người không tiến hóa từ tinh tinh ngày nay", "Người và tinh tinh có chung tổ tiên, hai nhánh tách ra", "Tiến hóa không có mục đích; chọn lọc tự nhiên theo môi trường"],
        openstax("Biology 2e", "Evolution and the Origin of Species"),
        trap={"note": "Cho rằng người tiến hóa từ tinh tinh hiện nay và tiến hóa có đích đến. Người và tinh tinh có chung tổ tiên; tiến hóa không có mục đích.", "premise": True},
    ),
    item(
        24, "biology", "trap",
        "Vì ADN nằm trong nhân tế bào nên hồng cầu trưởng thành của người cũng có ADN trong nhân, đúng không ạ?",
        [
            [NO],
            [r"(hong cau|te bao hong cau)[^.;]{0,60}(khong co|mat|khong con|thai bo|day) (cai )?nhan|khong (co|con) nhan|(day|thai) nhan"],
            [r"hemoglobin|huyet sac to|van chuyen (khi )?(oxi|oxy|o2)"],
        ],
        [AGREE],
        "Không đúng em ạ. Ở người, hồng cầu trưởng thành không có nhân: trong quá trình hình thành ở tủy xương, tế bào đẩy nhân ra ngoài, nên hồng cầu trưởng thành không chứa ADN nhân (chúng cũng không có ti thể). Nhờ vậy tế bào có nhiều chỗ hơn cho hemoglobin để vận chuyển oxi. Câu hỏi kiểm tra: vì sao hồng cầu trưởng thành không tự phân chia được?",
        ["Không: hồng cầu trưởng thành ở người không có nhân", "Nhân bị đẩy ra khi hồng cầu hình thành ở tủy xương", "Có thêm chỗ cho hemoglobin vận chuyển oxi"],
        openstax("Biology 2e", "The Circulatory System"),
        trap={"note": "Cho rằng mọi tế bào người đều có nhân chứa ADN; hồng cầu trưởng thành của người không có nhân.", "premise": True},
    ),
    item(
        25, "biology", "followup",
        "Dạ, 3 : 1 ạ.",
        [
            [CORRECTED],
            [r"\b1 ?: ?1\b|(?<![\d.,])50 ?%|1 ?aa ?: ?1 ?aa|mot nua|\b1/2\b"],
            [r"(cho|tao) (2|hai) (loai )?giao tu|giao tu a va a|(chi )?(cho|tao)[^.;]{0,20}(1|mot) (loai )?giao tu"],
        ],
        [PRAISE, wrong(r"(?<![\d.,])3 ?: ?1\b")],
        "Chưa đúng em ạ. Cây Aa cho hai loại giao tử A và a với tỉ lệ bằng nhau, còn cây aa chỉ cho một loại giao tử a. Đời con gồm 1 Aa : 1 aa, nên tỉ lệ kiểu hình là 1 trội : 1 lặn (mỗi loại 50 %). Câu hỏi kiểm tra: nếu đời con của phép lai phân tích toàn cây mang tính trạng trội thì cây đem lai có kiểu gen gì?",
        ["Chưa đúng", "Aa cho 2 loại giao tử, aa cho 1 loại", "Đời con 1 Aa : 1 aa, kiểu hình 1 : 1"],
        ENGINE.format("cross in src/biology/genetics/mendel.ts"),
        history=ask(
            "Phép lai phân tích là phép lai giữa cá thể mang tính trạng trội với cá thể đồng hợp lặn để biết kiểu gen của cá thể trội. Câu hỏi kiểm tra: với A trội hoàn toàn so với a, phép lai Aa × aa cho tỉ lệ kiểu hình ở đời con là bao nhiêu?",
            "Phép lai phân tích là gì ạ?",
        ),
        derivation="Aa × aa: giao tử (½ A, ½ a) × (a) ⇒ ½ Aa : ½ aa ⇒ kiểu hình 1 trội : 1 lặn. 3 : 1 là của Aa × Aa.",
    ),
    item(
        26, "biology", "followup",
        "Dạ, 5'-UAC-3' ạ.",
        [
            [CORRECTED],
            [r"3'? ?[-–]? ?tac ?[-–]? ?5|5'? ?[-–]? ?cat ?[-–]? ?3|\btac\b"],
            [r"\bu\b[^.;]{0,40}(arn|rna)|(arn|rna)[^.;]{0,40}\bu\b|uraxin|uracil|nguoc chieu|doi song song"],
        ],
        [PRAISE],
        "Chưa đúng em ạ. Có hai chỗ cần sửa: ADN không có U (U chỉ có trong ARN), nên A bắt cặp với T; và hai mạch ngược chiều nhau. Mạch bổ sung của 5'-ATG-3' là 3'-TAC-5', nếu viết từ đầu 5' thì là 5'-CAT-3'. Câu hỏi kiểm tra: mạch bổ sung của 5'-GGA-3' là gì?",
        ["Chưa đúng", "ADN dùng T, không có U", "Mạch bổ sung 3'-TAC-5' (= 5'-CAT-3'), hai mạch ngược chiều"],
        ENGINE.format("complement in src/biology/central/dogma.ts"),
        history=ask(
            "Trong ADN, A của mạch này liên kết với T của mạch kia, G liên kết với X (C), và hai mạch ngược chiều nhau. Câu hỏi kiểm tra: một mạch có trình tự 5'-ATG-3' thì mạch bổ sung có trình tự thế nào?",
            "Nguyên tắc bổ sung trong ADN là gì ạ?",
        ),
        derivation="Bổ sung từng base của ATG: TAC, đọc ngược chiều: 3'-TAC-5' (= 5'-CAT-3'). U chỉ có trong ARN.",
    ),
    item(
        27, "biology", "concept",
        "Vì sao mỗi loại enzim thường chỉ xúc tác cho một phản ứng hoặc một nhóm phản ứng nhất định?",
        [
            [r"trung tam hoat dong|vung hoat dong|vi tri hoat dong|active site"],
            [r"(hinh dang|cau hinh|cau truc khong gian)[^.;]{0,60}(phu hop|khop|tuong thich|bo sung)|(phu hop|khop|tuong thich)[^.;]{0,40}(hinh dang|cau hinh|co chat)|chia khoa|o khoa"],
            [r"co chat"],
        ],
        [],
        "Vì enzim có tính đặc hiệu: mỗi enzim có một trung tâm hoạt động với hình dạng và cấu trúc không gian riêng, chỉ phù hợp (khớp) với một hoặc một vài loại cơ chất, giống như ổ khóa chỉ vừa với chìa khóa của nó (mô hình khớp cảm ứng còn cho thấy trung tâm hoạt động hơi đổi hình để ôm lấy cơ chất). Chất khác không khớp vào trung tâm hoạt động nên enzim không xúc tác cho phản ứng của chất đó. Câu hỏi kiểm tra: hoạt tính của enzim thay đổi thế nào khi trung tâm hoạt động bị biến đổi hình dạng?",
        ["Tính đặc hiệu của enzim", "Trung tâm hoạt động có hình dạng phù hợp với cơ chất (ổ khóa – chìa khóa, khớp cảm ứng)", "Chất không khớp thì không được xúc tác"],
        openstax("Biology 2e", "Metabolism"),
    ),
    item(
        28, "biology", "concept",
        "Gen là gì và trong tế bào nhân thực gen nằm ở đâu?",
        [
            [r"doan[^.;]{0,20}(adn|dna)"],
            [r"(mang|chua|ma hoa)[^.;]{0,40}(thong tin|san pham|protein|chuoi poli?peptit|polypeptide|arn|rna)"],
            [r"nhiem sac the|\bnst\b|\b(trong|o) nhan\b(?! thuc| so)"],
        ],
        [wrong(r"gen (la|chinh la) (mot )?(protein|nhiem sac the)\b")],
        "Gen là một đoạn của phân tử ADN mang thông tin mã hóa cho một sản phẩm nhất định, thường là một chuỗi polipeptit (protein) hoặc một phân tử ARN. Ở tế bào nhân thực, phần lớn gen nằm trên các nhiễm sắc thể trong nhân; ngoài ra ti thể và lục lạp cũng có ADN riêng mang một số ít gen. Câu hỏi kiểm tra: một nhiễm sắc thể có thể chứa nhiều gen không?",
        ["Gen là một đoạn ADN", "Mang thông tin mã hóa một sản phẩm (protein hoặc ARN)", "Nằm trên nhiễm sắc thể trong nhân (và ADN của ti thể, lục lạp)"],
        openstax("Biology 2e", "DNA Structure and Function", "Genes and Proteins"),
    ),
    item(
        29, "biology", "problem",
        "Ở một loài cây, alen B quy định hoa đỏ trội hoàn toàn so với alen b quy định hoa trắng. Cho hai cây có kiểu gen Bb giao phấn với nhau. Tính tỉ lệ cây hoa trắng ở đời con.",
        [
            [r"(?<![\d.,])25 ?%|\\frac\{ ?1 ?\}\{ ?4|(?<![\d/])1 ?/ ?4(?![\d])|mot phan tu|0[,.]25"],
            [r"\bbb\b[^.;]{0,30}(hoa )?trang|(hoa )?trang[^.;]{0,30}\bbb\b|1 ?bb ?: ?2 ?bb ?: ?1 ?bb|3 ?: ?1"],
        ],
        [wrong(r"(?<![\d.,])(50|75) ?% ?(cay )?(hoa )?trang|hoa trang[^.;!?]{0,20}(50|75) ?%")],
        "Cây Bb cho hai loại giao tử B và b, mỗi loại 1/2. Đời con: 1 BB : 2 Bb : 1 bb. Chỉ cây bb có hoa trắng, nên tỉ lệ cây hoa trắng là 1/4 = 25 %; cây hoa đỏ (BB và Bb) chiếm 3/4, tức tỉ lệ kiểu hình 3 đỏ : 1 trắng.",
        ["Bb cho giao tử B và b (mỗi loại 1/2)", "Đời con 1 BB : 2 Bb : 1 bb", "Hoa trắng (bb) = 1/4 = 25 %"],
        ENGINE.format("cross in src/biology/genetics/mendel.ts"),
        derivation="Bb × Bb: P(bb) = ½·½ = ¼ = 25 %. mustNot: 50 % (nhầm với lai phân tích), 75 % (đổi trội và lặn).",
    ),
    item(
        30, "biology", "problem",
        "Một đoạn mARN có trình tự 5'-AUG UUU GGC UAA-3'. Đoạn mARN này được dịch mã thành chuỗi axit amin nào?",
        [
            [r"met(hionin|hionine)?\b[^.;]{0,20}phe(nylalanin|nylalanine)?\b[^.;]{0,20}gly(xin|cin|cine)?\b"],
            [r"uaa[^.;]{0,40}(ket thuc|dung|stop)|(ket thuc|dung|stop)[^.;]{0,40}uaa"],
        ],
        [wrong(r"uaa (ma hoa|quy dinh) (axit amin|cho)")],
        "Đọc từ đầu 5' theo từng bộ ba: AUG – UUU – GGC – UAA. AUG mã hóa Met (methionin, cũng là codon mở đầu), UUU mã hóa Phe (phenylalanin), GGC mã hóa Gly (glyxin), còn UAA là codon kết thúc nên dịch mã dừng lại. Chuỗi axit amin là Met–Phe–Gly.",
        ["Đọc từng bộ ba từ đầu 5'", "AUG = Met, UUU = Phe, GGC = Gly", "UAA là codon kết thúc: chuỗi Met–Phe–Gly"],
        ENGINE.format("data/genetic_code.json and translate in src/biology/central/dogma.ts"),
        derivation="Bảng mã di truyền của app: " + ", ".join(f"{c['codon']} = {'kết thúc' if c['stop'] else c['three']}" for c in CHAIN) + ".",
    ),
]

ABOUT = (
    "Held-out evaluation set 2 for the AI Teacher (HOLD2-01 … HOLD2-30), written on 2026-11-10 by "
    "Claude for the owner's 24/7 plan (item A7). While writing it, no saved model answer to these "
    "questions, no evaluation result of them and no tutor prompt was read. Disclosure: earlier the "
    "same day the author saw Gemma 4 E2B answers to 12 other questions of the same kinds as HOLD2-19, "
    "25, 26, 29 and 30 (tests/teaching/results/2026-11-10-gemma4-e2b-tools-*.json). No textbook "
    "(SGK) text: questions and reference answers are original; conceptual facts follow the OpenStax "
    "textbooks named in each item's reference; numbers come from the app's own data tables and "
    "engines and are checked by tests/teaching-heldout-2.test.ts. Same schema and scoring as "
    "tests/teaching/teaching-heldout.json (scripts/teaching/rubric.mjs): patterns are matched on the "
    "answer folded to ASCII lower case (no accents, đ → d, subscript digits as digits). Mix per "
    "subject (10 physics, 10 chemistry, 10 biology): 2 misconception, 2 trap (keyFacts[0] is the "
    "explicit correction), 2 followup (mustNot catches praise of a wrong answer), 2 concept, 2 "
    "problem with all data given. expected, keyPoints and derivation are for reviewers and judges. "
    "AI-written, not independently checked; every item is review_status pending until a teacher "
    "reviews it (docs/DATA_REVIEW.md, HOLD2-*). Generated by scripts/data/gen_teaching_heldout2.py: "
    "never edit this file by hand. Not measured yet."
)


def main() -> None:
    ids = [i["id"] for i in ITEMS]
    assert len(ids) == 30 and len(set(ids)) == 30
    for subject in ("physics", "chemistry", "biology"):
        kinds = sorted(i["type"] for i in ITEMS if i["subject"] == subject)
        assert kinds == sorted(["misconception", "trap", "followup", "concept", "problem"] * 2), subject
    for i in ITEMS:
        assert (i["type"] == "trap") == ("trap" in i), i["id"]
        assert (i["type"] == "followup") == ("history" in i), i["id"]
    data = {"about": ABOUT, "review_status": "pending", "items": ITEMS}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(ITEMS)} items")


if __name__ == "__main__":
    main()
