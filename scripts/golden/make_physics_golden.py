"""Builds tests/golden/physics.json — 30 Vietnamese textbook-style physics problems.

Each item has:
  - text: the problem (original wording, SGK style)
  - topic: expected topic id ("unsupported" if the app must refuse)
  - quantities: what a correct extraction contains (value/unit as WRITTEN in the text + quote)
  - missing: required parameters the problem does not give (the app must ask, not guess)
  - answers: expected results in SI, computed HERE with independent textbook formulas
    (not with the app's TypeScript code), so the test is a genuine cross-check.

Run:  python scripts/golden/make_physics_golden.py
"""
import json
import math
import pathlib

from scipy.special import ellipk

OUT = pathlib.Path(__file__).resolve().parents[2] / "tests" / "golden" / "physics.json"
KMH = 1000 / 3600
D = math.pi / 180


def q(key, value, unit, quote):
    return {"key": key, "value": value, "unit": unit, "quote": quote}


items = []


def add(id_, text, topic, quantities, answers=None, missing=None, unsupported=False):
    items.append(
        {
            "id": id_,
            "text": text,
            "topic": topic,
            "quantities": quantities,
            "missing": missing or [],
            "answers": answers or {},
            "expectUnsupportedParts": unsupported,
        }
    )


# --- Chuyển động thẳng đều -------------------------------------------------
add(
    "cd-01",
    "Hai ô tô xuất phát cùng lúc từ hai điểm A và B cách nhau 120 km, chuyển động thẳng đều ngược chiều nhau. Xe đi từ A có vận tốc 50 km/h, xe đi từ B có vận tốc 70 km/h. Hỏi sau bao lâu hai xe gặp nhau và chỗ gặp cách A bao xa?",
    "uniformMotion",
    [
        q("twoBodies", 1, "1", "Hai ô tô"),
        q("xB", 120, "km", "cách nhau 120 km"),
        q("vA", 50, "km/h", "vận tốc 50 km/h"),
        q("vB", -70, "km/h", "vận tốc 70 km/h"),
    ],
    {"meet_time": 120 / (50 + 70) * 3600, "meet_position": 50 * (120 / 120) * 1000},
)
add(
    "cd-02",
    "Lúc 7 giờ, một xe máy đi từ A với vận tốc 36 km/h. Cùng lúc đó một ô tô xuất phát từ B cách A 18 km, đi cùng chiều với xe máy với vận tốc 18 km/h. Hỏi sau bao lâu xe máy đuổi kịp ô tô và chỗ gặp cách A bao xa?",
    "uniformMotion",
    [
        q("twoBodies", 1, "1", "một ô tô"),
        q("vA", 36, "km/h", "vận tốc 36 km/h"),
        q("xB", 18, "km", "cách A 18 km"),
        q("vB", 18, "km/h", "vận tốc 18 km/h"),
    ],
    {"meet_time": 18 / (36 - 18) * 3600, "meet_position": 36 * 1.0 * 1000},
)

# --- Chuyển động thẳng biến đổi đều ----------------------------------------
add(
    "bd-01",
    "Một ô tô đang chạy với vận tốc 72 km/h thì hãm phanh, chuyển động chậm dần đều với gia tốc có độ lớn 2 m/s². Tính thời gian từ lúc hãm phanh đến khi xe dừng hẳn và quãng đường xe đi được trong thời gian đó.",
    "uniformAcceleration",
    [q("vA", 72, "km/h", "vận tốc 72 km/h"), q("aA", -2, "m/s^2", "gia tốc có độ lớn 2 m/s²")],
    {"stop_time_A": 20 / 2, "stop_distance_A": 20**2 / (2 * 2)},
)
add(
    "bd-02",
    "Một vật bắt đầu chuyển động nhanh dần đều từ trạng thái nghỉ với gia tốc 0,5 m/s². Tính vận tốc và quãng đường vật đi được sau 10 s.",
    "uniformAcceleration",
    [
        q("vA", 0, "m/s", "từ trạng thái nghỉ"),
        q("aA", 0.5, "m/s^2", "gia tốc 0,5 m/s²"),
        q("tEnd", 10, "s", "sau 10 s"),
    ],
    {"v_end_A": 0.5 * 10, "x_end_A": 0.5 * 0.5 * 100, "distance_A": 25},
)
add(
    "bd-03",
    "Một đoàn tàu đang chuyển động với vận tốc 36 km/h thì tăng tốc, chuyển động nhanh dần đều với gia tốc 0,1 m/s². Tính vận tốc của tàu và quãng đường tàu đi được sau 1 phút.",
    "uniformAcceleration",
    [
        q("vA", 36, "km/h", "vận tốc 36 km/h"),
        q("aA", 0.1, "m/s^2", "gia tốc 0,1 m/s²"),
        q("tEnd", 1, "min", "sau 1 phút"),
    ],
    {"v_end_A": 10 + 0.1 * 60, "x_end_A": 10 * 60 + 0.5 * 0.1 * 3600},
)

# --- Rơi tự do / ném thẳng đứng ---------------------------------------------
add(
    "rt-01",
    "Thả rơi tự do một vật từ độ cao 80 m so với mặt đất. Lấy g = 10 m/s². Tính thời gian rơi và vận tốc của vật khi chạm đất.",
    "freeFall",
    [q("h0", 80, "m", "độ cao 80 m"), q("g", 10, "m/s^2", "g = 10 m/s²"), q("v0", 0, "m/s", "Thả rơi tự do")],
    {"time_of_flight": math.sqrt(2 * 80 / 10), "impact_speed": math.sqrt(2 * 10 * 80)},
)
add(
    "rt-02",
    "Từ độ cao 25 m, một vật được ném thẳng đứng lên trên với vận tốc 20 m/s. Bỏ qua sức cản không khí, lấy g = 10 m/s². Tính độ cao cực đại vật đạt được và thời gian từ lúc ném đến khi vật chạm đất.",
    "freeFall",
    [q("h0", 25, "m", "độ cao 25 m"), q("v0", 20, "m/s", "vận tốc 20 m/s"), q("g", 10, "m/s^2", "g = 10 m/s²")],
    {
        "max_height": 25 + 20**2 / (2 * 10),
        "time_of_flight": (20 + math.sqrt(20**2 + 2 * 10 * 25)) / 10,
        "impact_speed": math.sqrt(20**2 + 2 * 10 * 25),
    },
)
add(
    "rt-03",
    "Một hòn đá rơi tự do từ miệng một cái giếng. Sau 2 s thì hòn đá chạm đáy giếng. Lấy g = 10 m/s². Tính độ sâu của giếng.",
    "freeFall",
    [q("g", 10, "m/s^2", "g = 10 m/s²")],
    missing=["h0"],
    unsupported=True,
)

# --- Ném ngang ----------------------------------------------------------------
add(
    "nn-01",
    "Một vật được ném theo phương ngang từ độ cao 45 m với vận tốc ban đầu 15 m/s. Lấy g = 10 m/s². Tính thời gian chuyển động và tầm xa của vật.",
    "horizontalProjectile",
    [q("h0", 45, "m", "độ cao 45 m"), q("v0", 15, "m/s", "vận tốc ban đầu 15 m/s"), q("g", 10, "m/s^2", "g = 10 m/s²")],
    {"time_of_flight": 3.0, "range": 45.0, "impact_speed": math.sqrt(15**2 + 30**2)},
)
add(
    "nn-02",
    "Từ đỉnh một tháp cao 20 m, người ta ném ngang một hòn đá với vận tốc 10 m/s. Lấy g = 9,8 m/s². Hỏi hòn đá chạm đất cách chân tháp bao xa?",
    "horizontalProjectile",
    [q("h0", 20, "m", "tháp cao 20 m"), q("v0", 10, "m/s", "vận tốc 10 m/s"), q("g", 9.8, "m/s^2", "g = 9,8 m/s²")],
    {"time_of_flight": math.sqrt(40 / 9.8), "range": 10 * math.sqrt(40 / 9.8)},
)

# --- Ném xiên -----------------------------------------------------------------
add(
    "nx-01",
    "Một quả bóng được đá từ mặt đất với vận tốc 20 m/s theo hướng hợp với phương ngang góc 30°. Lấy g = 10 m/s². Tính tầm xa và độ cao cực đại của quả bóng.",
    "obliqueProjectile",
    [q("v0", 20, "m/s", "vận tốc 20 m/s"), q("angle", 30, "deg", "góc 30°"), q("g", 10, "m/s^2", "g = 10 m/s²")],
    {
        "range": 20**2 * math.sin(60 * D) / 10,
        "max_height": (20 * math.sin(30 * D)) ** 2 / (2 * 10),
        "time_of_flight": 2 * 20 * math.sin(30 * D) / 10,
    },
)
vy = 10 * math.sin(45 * D)
t9 = (vy + math.sqrt(vy**2 + 2 * 9.8 * 10)) / 9.8
add(
    "nx-02",
    "Từ độ cao 10 m, một vật được ném xiên lên với vận tốc 10 m/s, góc ném 45° so với phương ngang. Lấy g = 9,8 m/s². Tính thời gian bay và tầm xa của vật.",
    "obliqueProjectile",
    [
        q("h0", 10, "m", "độ cao 10 m"),
        q("v0", 10, "m/s", "vận tốc 10 m/s"),
        q("angle", 45, "deg", "góc ném 45°"),
        q("g", 9.8, "m/s^2", "g = 9,8 m/s²"),
    ],
    {"time_of_flight": t9, "range": 10 * math.cos(45 * D) * t9},
)

# --- Định luật Newton ----------------------------------------------------------
add(
    "nt-01",
    "Một vật khối lượng 4 kg đặt trên mặt sàn nằm ngang được kéo bằng lực 20 N theo phương ngang. Hệ số ma sát trượt giữa vật và sàn là 0,25. Lấy g = 10 m/s². Tính gia tốc của vật.",
    "newtonLaws",
    [
        q("m", 4, "kg", "khối lượng 4 kg"),
        q("F", 20, "N", "lực 20 N"),
        q("mu", 0.25, "1", "0,25"),
        q("g", 10, "m/s^2", "g = 10 m/s²"),
    ],
    {"acceleration": (20 - 0.25 * 40) / 4, "normal_force": 40.0, "friction": 10.0},
)
add(
    "nt-02",
    "Kéo một thùng hàng 10 kg trượt trên sàn ngang bằng lực 50 N hợp với phương ngang góc 30°. Hệ số ma sát trượt là 0,2. Lấy g = 10 m/s². Tính gia tốc của thùng hàng.",
    "newtonLaws",
    [
        q("m", 10, "kg", "thùng hàng 10 kg"),
        q("F", 50, "N", "lực 50 N"),
        q("beta", 30, "deg", "góc 30°"),
        q("mu", 0.2, "1", "0,2"),
        q("g", 10, "m/s^2", "g = 10 m/s²"),
    ],
    {
        "normal_force": 100 - 50 * math.sin(30 * D),
        "acceleration": (50 * math.cos(30 * D) - 0.2 * (100 - 25)) / 10,
    },
)

# --- Mặt phẳng nghiêng ----------------------------------------------------------
a12 = 10 * (math.sin(30 * D) - 0.1 * math.cos(30 * D))
add(
    "mpn-01",
    "Một vật trượt không vận tốc đầu từ đỉnh một mặt phẳng nghiêng dài 10 m, nghiêng góc 30° so với phương ngang. Hệ số ma sát trượt là 0,1. Lấy g = 10 m/s². Tính gia tốc của vật, thời gian trượt hết dốc và vận tốc của vật ở chân mặt phẳng nghiêng.",
    "inclinedPlane",
    [
        q("length", 10, "m", "dài 10 m"),
        q("theta", 30, "deg", "góc 30°"),
        q("muK", 0.1, "1", "0,1"),
        q("g", 10, "m/s^2", "g = 10 m/s²"),
        q("v0", 0, "m/s", "không vận tốc đầu"),
    ],
    {"acceleration": -a12, "time_end": math.sqrt(2 * 10 / a12), "speed_end": math.sqrt(2 * a12 * 10)},
)
a13 = 9.8 * math.sin(60 * D)
add(
    "mpn-02",
    "Một vật nhỏ trượt không ma sát, không vận tốc đầu từ đỉnh một dốc nghiêng 60° dài 2 m. Lấy g = 9,8 m/s². Tính vận tốc của vật ở chân dốc.",
    "inclinedPlane",
    [
        q("theta", 60, "deg", "nghiêng 60°"),
        q("length", 2, "m", "dài 2 m"),
        q("g", 9.8, "m/s^2", "g = 9,8 m/s²"),
        q("muK", 0, "1", "không ma sát"),
        q("muS", 0, "1", "không ma sát"),
        q("v0", 0, "m/s", "không vận tốc đầu"),
    ],
    {"speed_end": math.sqrt(2 * a13 * 2), "time_end": math.sqrt(4 / a13)},
)

# --- Ròng rọc ------------------------------------------------------------------
add(
    "rr-01",
    "Máy Atwood gồm hai vật khối lượng 3 kg và 2 kg treo ở hai đầu một sợi dây vắt qua ròng rọc cố định. Bỏ qua khối lượng của dây, ròng rọc và mọi ma sát. Lấy g = 10 m/s². Tính gia tốc của hệ và lực căng dây.",
    "pulley",
    [
        q("config", 0, "1", "Máy Atwood"),
        q("m1", 3, "kg", "3 kg"),
        q("m2", 2, "kg", "2 kg"),
        q("g", 10, "m/s^2", "g = 10 m/s²"),
    ],
    {"acceleration": (2 - 3) * 10 / 5, "tension": 2 * 3 * 2 * 10 / 5},
)
add(
    "rr-02",
    "Vật m1 = 2 kg đặt trên mặt bàn nằm ngang, được nối với vật m2 = 0,5 kg bằng sợi dây nhẹ vắt qua ròng rọc ở mép bàn; vật m2 treo thẳng đứng. Hệ số ma sát giữa m1 và mặt bàn là 0,1. Lấy g = 10 m/s². Tính gia tốc của hệ và lực căng dây.",
    "pulley",
    [
        q("config", 1, "1", "đặt trên mặt bàn nằm ngang"),
        q("m1", 2, "kg", "m1 = 2 kg"),
        q("m2", 0.5, "kg", "m2 = 0,5 kg"),
        q("muK", 0.1, "1", "0,1"),
        q("g", 10, "m/s^2", "g = 10 m/s²"),
    ],
    {"acceleration": (0.5 * 10 - 0.1 * 2 * 10) / 2.5, "tension": 0.5 * (10 - 1.2)},
)
add(
    "rr-03",
    "Vật m1 = 1 kg nằm trên mặt phẳng nghiêng góc 30°, được nối qua ròng rọc ở đỉnh dốc với vật m2 = 1 kg treo thẳng đứng. Bỏ qua ma sát. Lấy g = 10 m/s². Tính gia tốc của hệ và lực căng dây.",
    "pulley",
    [
        q("config", 2, "1", "nằm trên mặt phẳng nghiêng"),
        q("m1", 1, "kg", "m1 = 1 kg"),
        q("m2", 1, "kg", "m2 = 1 kg"),
        q("theta", 30, "deg", "góc 30°"),
        q("muS", 0, "1", "Bỏ qua ma sát"),
        q("muK", 0, "1", "Bỏ qua ma sát"),
        q("g", 10, "m/s^2", "g = 10 m/s²"),
    ],
    {"acceleration": (10 - 10 * 0.5) / 2, "tension": 1 * (10 - 2.5)},
)

# --- Lò xo ----------------------------------------------------------------------
add(
    "lx-01",
    "Một lò xo có độ cứng 100 N/m, chiều dài tự nhiên 30 cm, được treo thẳng đứng. Treo vào đầu dưới của lò xo một vật khối lượng 200 g. Lấy g = 10 m/s². Tính độ dãn của lò xo và chiều dài của lò xo khi vật cân bằng.",
    "hookeSpring",
    [
        q("vertical", 1, "1", "treo thẳng đứng"),
        q("k", 100, "N/m", "độ cứng 100 N/m"),
        q("l0", 30, "cm", "chiều dài tự nhiên 30 cm"),
        q("m", 200, "g", "khối lượng 200 g"),
        q("g", 10, "m/s^2", "g = 10 m/s²"),
    ],
    {"static_extension": 0.2 * 10 / 100, "length_eq": 0.30 + 0.02, "spring_force": 2.0},
)
add(
    "lx-02",
    "Treo một vật khối lượng 500 g vào một lò xo thì lò xo dãn ra 5 cm. Lấy g = 10 m/s². Tính độ cứng của lò xo.",
    "hookeSpring",
    [q("m", 500, "g", "500 g"), q("g", 10, "m/s^2", "g = 10 m/s²")],
    missing=["k"],
    unsupported=True,
)
add(
    "lx-03",
    "Con lắc lò xo nằm ngang gồm vật nặng 100 g và lò xo có độ cứng 40 N/m. Kéo vật ra khỏi vị trí cân bằng 4 cm rồi thả nhẹ. Tính chu kì, biên độ và tốc độ cực đại của vật.",
    "springPendulum",
    [
        q("vertical", 0, "1", "nằm ngang"),
        q("m", 100, "g", "vật nặng 100 g"),
        q("k", 40, "N/m", "độ cứng 40 N/m"),
        q("x0", 4, "cm", "4 cm"),
        q("v0", 0, "m/s", "rồi thả nhẹ"),
    ],
    {
        "period": 2 * math.pi * math.sqrt(0.1 / 40),
        "omega": math.sqrt(40 / 0.1),
        "amplitude": 0.04,
        "v_max": math.sqrt(40 / 0.1) * 0.04,
    },
)
add(
    "lx-04",
    "Một con lắc lò xo gồm vật khối lượng 250 g và lò xo có độ cứng 100 N/m dao động điều hòa. Tính tần số góc và chu kì dao động.",
    "springPendulum",
    [q("m", 250, "g", "khối lượng 250 g"), q("k", 100, "N/m", "độ cứng 100 N/m")],
    {"omega": 20.0, "period": 2 * math.pi / 20},
)

# --- Con lắc đơn ----------------------------------------------------------------
add(
    "cld-01",
    "Một con lắc đơn có chiều dài 1 m dao động với biên độ góc 6° tại nơi có g = 9,8 m/s². Tính chu kì dao động theo công thức gần đúng và so sánh với chu kì chính xác.",
    "simplePendulum",
    [q("L", 1, "m", "chiều dài 1 m"), q("theta0", 6, "deg", "biên độ góc 6°"), q("g", 9.8, "m/s^2", "g = 9,8 m/s²")],
    {
        "period_small": 2 * math.pi * math.sqrt(1 / 9.8),
        "period": 4 * math.sqrt(1 / 9.8) * float(ellipk(math.sin(3 * D) ** 2)),
    },
)
add(
    "cld-02",
    "Một con lắc đơn dài 2 m, vật nặng 100 g được kéo lệch khỏi phương thẳng đứng một góc 60° rồi thả nhẹ. Lấy g = 10 m/s². Tính tốc độ của vật khi đi qua vị trí cân bằng và lực căng dây lúc đó.",
    "simplePendulum",
    [
        q("L", 2, "m", "dài 2 m"),
        q("m", 100, "g", "vật nặng 100 g"),
        q("theta0", 60, "deg", "góc 60°"),
        q("omega0", 0, "rad/s", "rồi thả nhẹ"),
        q("g", 10, "m/s^2", "g = 10 m/s²"),
    ],
    {"v_max": math.sqrt(2 * 10 * 2 * (1 - 0.5)), "tension_max": 0.1 * 10 * (3 - 2 * 0.5)},
)

# --- Bảo toàn cơ năng ------------------------------------------------------------
add(
    "cn-01",
    "Một vật nhỏ được thả trượt không vận tốc đầu từ độ cao 5 m trên một máng cong nhẵn. Lấy g = 10 m/s². Tính tốc độ của vật tại điểm thấp nhất của máng.",
    "energyConservation",
    [
        q("shape", 0, "1", "máng cong nhẵn"),
        q("H", 5, "m", "độ cao 5 m"),
        q("v0", 0, "m/s", "không vận tốc đầu"),
        q("g", 10, "m/s^2", "g = 10 m/s²"),
    ],
    {"v_low": math.sqrt(2 * 10 * 5)},
)

# --- Va chạm ----------------------------------------------------------------------
add(
    "vc-01",
    "Quả cầu 1 khối lượng 2 kg chuyển động với vận tốc 4 m/s đến va chạm đàn hồi xuyên tâm với quả cầu 2 khối lượng 1 kg đang đứng yên. Tính vận tốc của hai quả cầu sau va chạm.",
    "collisions",
    [
        q("mode", 0, "1", "xuyên tâm"),
        q("m1", 2, "kg", "khối lượng 2 kg"),
        q("v1", 4, "m/s", "vận tốc 4 m/s"),
        q("m2", 1, "kg", "khối lượng 1 kg"),
        q("v2", 0, "m/s", "đang đứng yên"),
        q("e", 1, "1", "va chạm đàn hồi"),
    ],
    {"v1x_after": (2 - 1) * 4 / 3, "v2x_after": 2 * 2 * 4 / 3, "momentum": 8.0},
)
add(
    "vc-02",
    "Một viên bi khối lượng 0,5 kg đang chuyển động với vận tốc 6 m/s thì va chạm mềm với viên bi thứ hai khối lượng 1 kg đang đứng yên. Sau va chạm hai viên bi dính vào nhau. Tính vận tốc của chúng sau va chạm.",
    "collisions",
    [
        q("m1", 0.5, "kg", "khối lượng 0,5 kg"),
        q("v1", 6, "m/s", "vận tốc 6 m/s"),
        q("m2", 1, "kg", "khối lượng 1 kg"),
        q("v2", 0, "m/s", "đang đứng yên"),
        q("e", 0, "1", "va chạm mềm"),
    ],
    {"v1x_after": 3 / 1.5, "v2x_after": 3 / 1.5},
)
add(
    "vc-03",
    "Hai xe lăn khối lượng 3 kg và 2 kg chuyển động ngược chiều nhau với tốc độ lần lượt là 2 m/s và 3 m/s rồi va chạm mềm. Tính vận tốc của hai xe sau va chạm.",
    "collisions",
    [
        q("m1", 3, "kg", "3 kg"),
        q("m2", 2, "kg", "2 kg"),
        q("v1", 2, "m/s", "2 m/s"),
        q("v2", -3, "m/s", "3 m/s"),
        q("e", 0, "1", "va chạm mềm"),
    ],
    {"v1x_after": 0.0, "v2x_after": 0.0, "momentum": 0.0},
)

# --- Ngoài phạm vi ------------------------------------------------------------------
add(
    "ng-01",
    "Một mạch điện gồm điện trở 10 Ω mắc vào hai cực của một nguồn điện có hiệu điện thế 12 V. Tính cường độ dòng điện chạy qua điện trở.",
    "unsupported",
    [],
)
add(
    "ng-02",
    "Một tia sáng truyền từ không khí vào nước với góc tới 45°. Chiết suất của nước là 1,33. Tính góc khúc xạ.",
    "unsupported",
    [],
)

assert len(items) >= 30, len(items)
OUT.write_text(json.dumps({"version": 1, "items": items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"wrote {len(items)} golden problems to {OUT}")
