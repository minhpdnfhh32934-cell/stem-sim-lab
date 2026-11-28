// Builds data/game_guide.json: what AI Teacher may say about the SimLab 3D game (docs/GAME.md).
// Every fact comes from the game's own content (game/src/content, its key bindings and control
// texts) or, for the few lines about how SimLab embeds it, from docs/GAME.md. Run it again after
// the game's content changes: `npm run game-guide` (tests/game-guide.test.ts fails while stale).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Run from the repository root (npm scripts and the tests do).
const ROOT = `${process.cwd()}/`;
const CONTENT = `${ROOT}game/src/content/`;
const OUT = `${ROOT}data/game_guide.json`;

const json = (file) => JSON.parse(readFileSync(`${CONTENT}${file}`, 'utf8'));
const source = (file) => readFileSync(`${ROOT}${file}`, 'utf8');
const LOCALES = ['vi', 'en'];

/** A content text in a language: the "vi" block's copy, or the English beside it. */
const text = (object, field, locale) =>
  (locale === 'vi' ? object?.vi?.[field] : undefined) ?? object?.[field] ?? '';
const num = (value, locale) => (locale === 'vi' ? String(value).replace('.', ',') : String(value));
const list = (items) => items.filter(Boolean).join(', ');
const askExplain = (locale, name) =>
  locale === 'vi' ? `Nhờ ${name} giảng mô phỏng này` : `Ask ${name} to explain this simulation`;
const L = (vi, en) => ({ vi, en });

/** The character creator's tabs and poses, in the order of the game's own texts (strings.json). */
const CREATOR_KEYS = Object.keys(json('strings.json').vi);
const TABS = CREATOR_KEYS.filter((k) => k.startsWith('custom.tab.')).map((k) => k.slice('custom.tab.'.length));
const POSES = CREATOR_KEYS.filter((k) => k.startsWith('custom.pose.')).map((k) => k.slice('custom.pose.'.length));

/** Interface texts: the English beside each key in the game's code, Vietnamese in strings.json. */
function uiTexts() {
  const vi = json('strings.json').vi;
  const en = {};
  for (const file of [
    'game/src/platform/ui/ControlsPanel.ts',
    'game/src/platform/ui/dom.ts',
    'game/src/platform/ui/DialogueView.ts',
    'game/src/platform/ui/characterPage/CharacterPage.ts',
    'game/src/platform/ui/characterPage/Customiser.ts',
  ]) {
    for (const [, key, english] of source(file).matchAll(/t\.ui\(\s*'([\w.]+)',\s*'([^']*)'/g)) {
      en[key] = english;
    }
  }
  return (key, locale) => {
    const value = locale === 'vi' ? vi[key] : en[key];
    if (!value) throw new Error(`game-guide: no ${locale} text for ${key}`);
    return value;
  };
}

/** The default key bindings (game/src/core/config.ts). */
function bindings() {
  const out = {};
  for (const [, name, codes] of source('game/src/core/config.ts').matchAll(
    /(\w+): KeyList\.default\(\[([^\]]*)\]\)/g,
  )) {
    out[name] = [...codes.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }
  return out;
}

// shortcut: copies `NAMED_KEYS` / `MOUSE_LABELS` of game/src/platform/ui/dom.ts, upgrade if they grow.
const NAMED_KEYS = {
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
};
const MOUSE_KEYS = { Mouse0: 'key.mouseLeft', Mouse1: 'key.mouseMiddle', Mouse2: 'key.mouseRight' };

/**
 * The controls panel of the game inside SimLab (game/src/platform/ui/ControlsPanel.ts `GROUPS`,
 * embedded build: no "hold to talk" row). Keys: binding names (first key of each), `*name` (every
 * key of a binding), `@key.text` (an interface text), `=literal`.
 */
const CONTROLS = [
  [
    'controls.movement',
    [
      [['moveForward', 'moveLeft', 'moveBack', 'moveRight'], 'controls.move'],
      [['run'], 'controls.run'],
      [['jump'], 'controls.jump'],
      [['@key.mouse'], 'controls.look'],
    ],
  ],
  [
    'controls.interaction',
    [
      [['interact'], 'controls.interact'],
      [['secondary'], 'controls.secondary'],
      [['throw'], 'controls.throw'],
      [['*pour'], 'controls.pour'],
      [['*inspect'], 'controls.inspect'],
    ],
  ],
  [
    'controls.inventory',
    [
      [['stow'], 'controls.stow'],
      [['hotbar1–hotbar9'], 'controls.hotbar'],
      [['@key.wheel'], 'controls.wheel'],
      [['inventory'], 'controls.panel'],
      [['tasks'], 'controls.tasks'],
      [['explain'], 'controls.explain'],
      [['phone'], 'controls.phone'],
    ],
  ],
  ['controls.room', [[['chat'], 'controls.chat']]],
  ['controls.system', [[['=Esc'], 'controls.pause']]],
];

function controls(ui, keys, locale) {
  const label = (code) =>
    MOUSE_KEYS[code] ? ui(MOUSE_KEYS[code], locale) : (NAMED_KEYS[code] ?? code.replace(/^Key|^Digit/, ''));
  const first = (name) => {
    const code = keys[name]?.[0];
    if (!code) throw new Error(`game-guide: no key bound to ${name}`);
    return label(code);
  };
  const keyText = (spec) => {
    if (spec.startsWith('@')) return ui(spec.slice(1), locale);
    if (spec.startsWith('=')) return spec.slice(1);
    if (spec.startsWith('*')) return (keys[spec.slice(1)] ?? []).map(label).join(' / ');
    if (spec.includes('–')) return spec.split('–').map(first).join('–');
    return first(spec);
  };
  return CONTROLS.map(
    ([group, rows]) =>
      `${ui(group, locale)}: ${rows
        .map(([specs, does]) => `${specs.map(keyText).join(' ')} — ${ui(does, locale)}`)
        .join('; ')}.`,
  ).join('\n');
}

export function buildGameGuide() {
  const ui = uiTexts();
  const keys = bindings();
  const labs = json('laboratories.json');
  const rooms = json('rooms.json');
  const topics = json('topics.json');
  const tasks = json('tasks.json');
  const procedures = json('procedures.json');
  const npcs = json('npcs.json');
  const responders = json('responders.json');
  const scenes = json('scenes.json');
  const experiments = readdirSync(`${CONTENT}experiments`)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => json(`experiments/${f}`));
  const roomOf = new Map(rooms.map((r) => [r.id, r]));
  const labOf = new Map(labs.flatMap((lab) => lab.rooms.map((room) => [room, lab])));
  const experimentOf = new Map(experiments.map((e) => [e.id, e]));
  const placed = new Map(); // experiment id → rooms where its apparatus stands
  for (const { room, placements } of json('lab-placements.json')) {
    for (const p of placements) {
      const id = p.params?.experimentId;
      if (id && !(placed.get(id) ?? []).includes(room)) placed.set(id, [...(placed.get(id) ?? []), room]);
    }
  }
  const characters = json('characters.json');
  const itemName = new Map(
    [...json('core-items.json'), ...json('items.json')].map((it) => [it.id, it]),
  );
  const periodic = json('periodic-table.json').elements;
  const books = readdirSync(`${CONTENT}books`)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => json(`books/${f}`));
  const banks = readdirSync(`${CONTENT}questions`)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => json(`questions/${f}`));
  const allQuestions = banks.flatMap((b) => b.questions);
  const countBy = (field, value) => allQuestions.filter((q) => q[field] === value).length;
  const perExperiment = banks.length ? allQuestions.length / banks.length : 0;
  const bySubject = (subject) => experiments.filter((e) => e.category === subject).length;
  const fill = (tpl, set = {}) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in set ? String(set[k]) : m));
  const itemLabel = (id, locale) => text(itemName.get(id), 'displayName', locale) || id;
  const roomName = (id, locale) => text(roomOf.get(id), 'displayName', locale) || id;
  const sceneName = (id, locale) => text(scenes.find((s) => s.id === id), 'displayName', locale) || id;
  const expName = (id, locale) => text(experimentOf.get(id), 'name', locale) || id;
  const SUBJECT = { physics: L('Vật lý', 'Physics'), chemistry: L('Hóa học', 'Chemistry'), biology: L('Sinh học', 'Biology') };
  const sections = [];
  const add = (id, file, build) => {
    const section = { id, source: file };
    for (const locale of LOCALES) section[locale] = build(locale);
    sections.push(section);
  };

  const procedure = procedures[0];
  const teacher = npcs[0];
  add('overview', 'docs/GAME.md · game/src/content/laboratories.json', (l) => ({
    title: l === 'vi' ? 'SimLab 3D là gì, mở ở đâu' : 'What SimLab 3D is, where to open it',
    text: [
      l === 'vi'
        ? 'SimLab 3D là trò chơi phòng thí nghiệm 3D góc nhìn thứ nhất có sẵn trong SimLab. Cách mở: vào Virtual Lab, ở cột Thư viện bên trái bấm nút SimLab 3D (ngay dưới nút Science Studio). Game mở toàn màn hình; nút "Về SimLab" ở đầu màn hình đưa người học trở lại.'
        : 'SimLab 3D is a first-person 3D laboratory game built into SimLab. To open it: go to the Virtual Lab and, in the Library column on the left, press the SimLab 3D button (just below Science Studio). The game opens full screen; the "Về SimLab" button at the top goes back.',
      l === 'vi'
        ? `Người chơi bắt đầu ở ${roomName(procedure.scene, l)}. Trước khi vào khu sạch phải làm đủ các bước "${text(procedure, 'name', l)}": ${list(procedure.stages.map((s) => text(s, 'label', l)))}. Sau đó đi qua ${roomName('cleanroom-corridor', l)} tới ${roomName('simlab-hub', l)}, rồi vào các phòng thí nghiệm. Kết quả đo được đặt cạnh kết quả lý thuyết.`
        : `The player starts in the ${roomName(procedure.scene, l)}. Before the clean area every step of "${text(procedure, 'name', l)}" is needed: ${list(procedure.stages.map((s) => text(s, 'label', l)))}. Then through the ${roomName('cleanroom-corridor', l)} to the ${roomName('simlab-hub', l)}, and on to the laboratories. Measured results are shown beside the theory.`,
      `${l === 'vi' ? 'Các phòng thí nghiệm' : 'The laboratories'}: ${labs
        .map((lab) => `${text(lab, 'displayName', l)} (${list(lab.rooms.map((r) => roomName(r, l)))})`)
        .join('; ')}.`,
      l === 'vi'
        ? `${text(teacher, 'title', l)} ở ${roomName(teacher.scene, l)}. Game có tiếng Việt và tiếng Anh (Cài đặt → Ngôn ngữ); lần mở đầu theo ngôn ngữ của SimLab. Tiến độ chơi được lưu trên máy này.`
        : `${text(teacher, 'title', l)} is in the ${roomName(teacher.scene, l)}. The game speaks Vietnamese and English (Settings → Language); the first time it follows SimLab's language. Progress is saved on this computer.`,
      l === 'vi'
        ? 'Bản trong SimLab không có trò chuyện bằng giọng nói, không có "khuôn mặt từ ảnh" và không có mức đồ họa Ultra (còn Thấp, Trung bình, Cao; kết quả thí nghiệm như nhau ở mọi mức). Nội dung khoa học trong game đang chờ giáo viên duyệt.'
        : 'The copy inside SimLab has no voice chat, no "face from a photo" and no Ultra graphics (Low, Medium and High remain; experiment results are the same at every level). The science in the game is still waiting for a teacher’s review.',
      l === 'vi'
        ? `Tóm tắt các hệ thống trong game: ${characters.length} nhân vật để chọn và tự tạo "Nhân vật của bạn"; ${text(teacher, 'title', l)} giảng từng bộ phận của mô phỏng, viết ví dụ giải mẫu lên bảng trắng của phòng và ra đề, chấm bài kiểm tra trên giấy (ngân hàng ${allQuestions.length} câu hỏi); laptop ở bàn lễ tân Sảnh SIMLAB mở ${books.length} cuốn sách kiến thức (${books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.lessons.length, 0), 0)} bài học lớp 10–12); Bảng tuần hoàn ${periodic.length} nguyên tố và Bảng Tiến độ học tập ở Sảnh; ${experiments.length} thí nghiệm (Vật lý ${bySubject('physics')}, Hóa học ${bySubject('chemistry')}, Sinh học ${bySubject('biology')}) thuộc ${topics.length} chủ đề và ${tasks.length} nhiệm vụ hướng dẫn (phím T); bàn điều khiển, bàn làm việc 5 bước, sai số dụng cụ và khớp đường thẳng; chập mạch, cháy và gọi 114/113 bằng điện thoại (phím P); lưu nhiều tiến trình và chơi nhiều người qua LAN.`
        : `The game's systems at a glance: ${characters.length} characters to choose from plus a custom "Nhân vật của bạn"; ${text(teacher, 'title', l)} explains a simulation part by part, writes worked examples on the room's whiteboard and sets and marks paper tests (a bank of ${allQuestions.length} questions); the laptop on the reception counter of the SIMLAB Hub opens ${books.length} knowledge books (${books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.lessons.length, 0), 0)} lessons for grades 10–12); a ${periodic.length}-element periodic table and a Learning Progress board in the Hub; ${experiments.length} experiments (Physics ${bySubject('physics')}, Chemistry ${bySubject('chemistry')}, Biology ${bySubject('biology')}) in ${topics.length} topics and ${tasks.length} guided tasks (T key); the control desk, the 5-stage workbench, instrument uncertainty and linear fits; short circuits, fires and calling 114/113 on the phone (P key); several saves and LAN multiplayer.`,
    ].join('\n'),
  }));

  add('controls', 'game/src/core/config.ts · game/src/platform/ui/ControlsPanel.ts', (l) => ({
    title: l === 'vi' ? 'Phím điều khiển' : 'Controls',
    text: [
      `${l === 'vi' ? 'Phím điều khiển mặc định (đổi được trong Cài đặt → Điều khiển)' : 'Default controls (they can be changed in Settings → Controls)'}:\n${controls(ui, keys, l)}`,
      l === 'vi'
        ? 'Điện thoại (P): 0–9 bấm số, E gọi hoặc cúp máy, F xóa một số, Q cất điện thoại; 114 là cứu hỏa, 113 là cảnh sát.'
        : 'Phone (P): 0–9 dial, E call or hang up, F delete a digit, Q put it away; 114 is the fire brigade, 113 the police.',
      l === 'vi'
        ? 'Túi đồ (I): 1–9 hoặc con lăn chuột chọn ô trên thanh vật dụng, Q cất vào túi hoặc lấy ra; trong túi, Enter hoặc nhấp chuột chuyển cả chồng, Shift+Enter hoặc chuột phải tách một nửa. Đồ bảo hộ được mặc lên người và trả về giá treo hoặc thùng rác chứ không cất vào túi.'
        : 'Bag (I): 1–9 or the mouse wheel pick a hotbar slot, Q stows or takes out; in the bag Enter or a click moves a whole stack and Shift+Enter or a right click splits half. Protective gear is worn and put back on its rack or in the bin, not stowed in the bag.',
      l === 'vi'
        ? `Hội thoại và chế độ Giải thích: nhấp chuột, E, Space hoặc Enter để sang câu tiếp theo; có nút ${ui('dialogue.auto', l)} và ${ui('dialogue.skip', l)}; Esc để đóng.`
        : `Dialogue and Explain view: click, E, Space or Enter go to the next line; there are ${ui('dialogue.auto', l)} and ${ui('dialogue.skip', l)} buttons; Esc closes.`,
      l === 'vi'
        ? 'Màn hình cảm ứng có cần điều khiển ảo, kéo để nhìn quanh, nút hành động và nhìn bằng cách nghiêng máy; tay cầm (gamepad) cũng dùng được. Độ nhạy chuột chỉnh từ 0,25× đến 3× trong Cài đặt → Điều khiển.'
        : 'Touch screens have a virtual thumbstick, drag to look, action buttons and tilt-to-look; a gamepad works too. Look sensitivity goes from 0.25× to 3× in Settings → Controls.',
    ].join('\n'),
  }));

  add('characters', 'game/src/content/characters.json · strings.json', (l) => ({
    title: l === 'vi' ? 'Nhân vật và tạo nhân vật' : 'Characters and character creation',
    text: [
      l === 'vi'
        ? `Game có ${characters.length} nhân vật để chọn ở Menu chính → Chọn nhân vật:`
        : `The game has ${characters.length} characters to choose from in Main menu → Chọn nhân vật:`,
      ...characters.map(
        (c) =>
          `${text(c, 'displayName', l)} — ${text(c, 'role', l)}, ${num(c.appearance.heightM, l)} m. ${text(c, 'trait', l)}`,
      ),
      l === 'vi'
        ? `Muốn tự tạo hoặc sửa "${ui('character.newName', l)}": ở màn chọn nhân vật bấm ${ui('character.create', l)} hoặc ${ui('character.edit', l)}, đặt tên rồi chỉnh qua ${TABS.length} thẻ: ${TABS.map((k) => ui(`custom.tab.${k}`, l)).join(' · ')}, và chọn dáng đứng: ${list(POSES.map((k) => ui(`custom.pose.${k}`, l)))}. Bản trong SimLab không có mục "Khuôn mặt từ ảnh".`
        : `To create or edit "${ui('character.newName', l)}": on the character screen press ${ui('character.create', l)} or ${ui('character.edit', l)}, give a name and adjust ${TABS.length} tabs: ${TABS.map((k) => ui(`custom.tab.${k}`, l)).join(' · ')}, then pick a standing pose: ${list(POSES.map((k) => ui(`custom.pose.${k}`, l)))}. The copy inside SimLab has no "face from a photo".`,
    ].join('\n'),
  }));

  add(`procedure:${procedure.id}`, 'game/src/content/procedures.json', (l) => ({
    title: text(procedure, 'name', l),
    text: [
      `${text(procedure, 'name', l)} (${roomName(procedure.scene, l)}): ${text(procedure, 'description', l)}`,
      ...procedure.steps.map((s, i) => `${i + 1}. ${text(s, 'instruction', l)}`),
      l === 'vi'
        ? 'Quy định: bắt buộc đủ áo blouse, kính bảo hộ và găng tay; khi rửa tay hoặc sát khuẩn phải nhìn vào bồn hoặc máy đó suốt thời gian làm (quay đi là bị hủy bước); phải đóng cửa vào khu sạch trước khi cởi đồ bảo hộ; găng tay đã dùng bỏ vào thùng rác đạp chân ở hành lang.'
        : 'Rules: the lab coat, safety glasses and gloves are all required; while washing or sanitising you must keep looking at the sink or dispenser (looking away cancels the step); close the entrance door to the clean area before taking the gear off; used gloves go in the pedal bin in the corridor.',
    ].join('\n'),
  }));

  add(`npc:${teacher.id}`, 'game/src/content/npcs.json', (l) => ({
    title: text(teacher, 'title', l),
    text: [
      `${text(teacher, 'title', l)}: ${text(teacher.character, 'role', l)} ${l === 'vi' ? 'ở' : 'in the'} ${roomName(teacher.scene, l)}. ${text(teacher.character, 'trait', l)}`,
      `${l === 'vi' ? 'Nói chuyện với thầy (E) để chọn' : 'Talk to him (E) to choose'}: ${list(
        teacher.options.map(
          (o) => `${text(o, 'label', l)}${o.planned ? (l === 'vi' ? ' (sắp có, chưa làm xong)' : ' (planned, not finished)') : ''}`,
        ),
      )}.`,
      text(teacher.lesson.ask, 'text', l),
      l === 'vi'
        ? `Thầy đi lại quanh ${roomName(teacher.scene, l)} theo lịch: bàn lễ tân, cửa phòng Hóa học, Bảng tuần hoàn, mô hình ADN, cửa phòng Sinh học, ghế nghỉ, mô hình sóng, cửa phòng Vật lý; có lúc ngồi nghỉ.`
        : `He walks around the ${roomName(teacher.scene, l)} on a schedule: the reception counter, the Chemistry door, the periodic table, the DNA model, the Biology door, the benches, the wave model, the Physics door; sometimes he sits down.`,
      l === 'vi'
        ? `Lựa chọn 1 "${text(teacher.options[0], 'label', l)}": em dẫn thầy tới thí nghiệm (thầy đi theo, gặp cửa đóng thì tự quẹt thẻ mở), nhấn E vào thiết bị và chọn "${askExplain(l, 'Thầy Quang')}". Thầy đứng bên phải trạm, chỉ vào từng bộ phận và giảng nguyên lý từng bước, rồi hỏi "${text(teacher.lesson.outro, 'text', l)}". Chọn "${text(teacher.lesson.choices.board, 'label', l)}" thì thầy viết ví dụ giải mẫu lên bảng trắng của phòng: Cho, Tìm, công thức, và Đáp số gạch đỏ; chọn "${text(teacher.lesson.choices.another, 'label', l)}" để xem ví dụ khác. Có ví dụ trên bảng cho ${experiments.filter((e) => e.examples?.length).length}/${experiments.length} thí nghiệm; ${experiments.filter((e) => !e.examples?.length).map((e) => text(e, 'name', l)).join(', ')} chưa có ví dụ trên bảng.`
        : `Choice 1 "${text(teacher.options[0], 'label', l)}": lead him to the experiment (he follows and taps his keycard on a shut door), press E on the apparatus and choose "${askExplain(l, 'Mr. Quang')}". He stands to the right of the station, points at each part and explains the principle step by step, then asks "${text(teacher.lesson.outro, 'text', l)}". Choose "${text(teacher.lesson.choices.board, 'label', l)}" and he writes worked examples on the room's whiteboard: Given, Find, formulas and a red-underlined answer; choose "${text(teacher.lesson.choices.another, 'label', l)}" for another example. Board examples exist for ${experiments.filter((e) => e.examples?.length).length}/${experiments.length} experiments; ${experiments.filter((e) => !e.examples?.length).map((e) => text(e, 'name', l)).join(', ')} have none.`,
      l === 'vi'
        ? 'Lựa chọn 2 "Giúp giải đề" chưa làm xong (sắp có). Lựa chọn 3 "Ra đề kiểm tra kiến thức": xem mục bài kiểm tra trên giấy.'
        : 'Choice 2 "Help me solve a problem" is not finished yet (planned). Choice 3 "Give me a test": see the paper tests section.',
    ].join('\n'),
  }));

  add('test-papers', 'game/src/content/npcs.json · game/src/content/questions/ · strings.json', (l) => ({
    title: l === 'vi' ? 'Bài kiểm tra trên giấy và ngân hàng câu hỏi' : 'Paper tests and the question bank',
    text: [
      l === 'vi'
        ? `Ngân hàng câu hỏi có ${banks.length} bộ, mỗi thí nghiệm một bộ ${perExperiment} câu, tổng ${allQuestions.length} câu: ${countBy('level', 'recognise')} Nhận biết, ${countBy('level', 'understand')} Thông hiểu, ${countBy('level', 'apply')} Vận dụng, ${countBy('level', 'analyse')} Vận dụng cao; ${countBy('type', 'choice')} câu trắc nghiệm 4 lựa chọn (Phần I, A–D) và ${countBy('type', 'true-false')} câu đúng/sai 4 ý a–d (Phần II).`
        : `The question bank has ${banks.length} sets, one of ${perExperiment} questions per experiment, ${allQuestions.length} in all: ${countBy('level', 'recognise')} Recognise, ${countBy('level', 'understand')} Understand, ${countBy('level', 'apply')} Apply, ${countBy('level', 'analyse')} Analyse; ${countBy('type', 'choice')} multiple-choice questions with 4 options (Part I, A–D) and ${countBy('type', 'true-false')} true/false questions with 4 statements a–d (Part II).`,
      l === 'vi'
        ? `Cách xin đề: nói chuyện với thầy Quang (E), chọn "${text(teacher.options[2], 'label', l)}", rồi chọn các mô phỏng, số câu (5–40), dạng câu (Phần I, Phần II) và mức độ. Thầy ra bàn lễ tân soạn đề khoảng 10 giây rồi đưa tờ đề (test-paper) vào túi đồ.`
        : `To ask for a test: talk to Mr. Quang (E), choose "${text(teacher.options[2], 'label', l)}", then pick the simulations, the number of questions (5–40), the types (Part I, Part II) and the levels. He writes the test at the reception counter for about 10 seconds and puts the paper (test-paper) in your bag.`,
      l === 'vi'
        ? 'Làm bài: chọn tờ đề trên thanh vật dụng rồi nhấn E; không giới hạn thời gian; đáp án được khoanh mực xanh, đổi đáp án thì câu cũ bị gạch chéo. Làm xong mang tờ đề đến thầy Quang, nhấn E để nộp; thầy chấm bằng bút đỏ khoảng 5 giây rồi trả bài.'
        : 'To do it: select the paper on the hotbar and press E; there is no time limit; answers are circled in blue ink and changing one crosses out the old one. When done take the paper to Mr. Quang and press E to hand it in; he marks it in red pen for about 5 seconds and returns it.',
      l === 'vi'
        ? 'Cách tính điểm theo quy tắc thi tốt nghiệp THPT 2025, quy về thang 10: mỗi câu trắc nghiệm đúng 0,25 điểm; mỗi câu đúng/sai đúng 1 ý được 0,1, đúng 2 ý được 0,25, đúng 3 ý được 0,5, đúng cả 4 ý được 1,0 điểm.'
        : 'Scoring follows the 2025 THPT exam rules scaled to 10: 0.25 for each correct multiple-choice question; for a true/false question 1 statement right gives 0.1, 2 give 0.25, 3 give 0.5 and all 4 give 1.0.',
      l === 'vi'
        ? 'Bài trả lại có dấu ✓/✗, điểm trên 10, phần "Em làm tốt", phần "Cần ôn thêm — và cách ôn" và giải thích từng câu chưa đúng. Tờ đề cũ bỏ vào thùng rác đạp chân ở hành lang phòng sạch; điểm vẫn được giữ trên Bảng Tiến độ học tập.'
        : 'The marked paper shows ✓/✗, the score out of 10, a "Em làm tốt" (what went well) part, a "Cần ôn thêm — và cách ôn" (what to revise and how) part and an explanation for each wrong question. Old papers can go in the pedal bin in the clean-room corridor; the scores stay on the Learning Progress board.',
    ].join('\n'),
  }));

  add('laptop-books', 'game/src/content/books.ts · game/src/content/books/*.json', (l) => ({
    title: l === 'vi' ? 'Laptop ở sảnh và 9 cuốn sách kiến thức' : 'The hub laptop and its 9 knowledge books',
    text: [
      l === 'vi'
        ? `Chiếc ${itemLabel('hub-laptop', l)} đặt trên bàn lễ tân ở ${roomName('simlab-hub', l)}; nhấn E để mở "Thư viện kiến thức SimLab" với ${books.length} cuốn sách giáo khoa, tổng ${books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.lessons.length, 0), 0)} bài học.`
        : `The ${itemLabel('hub-laptop', l)} stands on the reception counter in the ${roomName('simlab-hub', l)}; press E to open "Thư viện kiến thức SimLab" (the knowledge library) with ${books.length} textbooks and ${books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.lessons.length, 0), 0)} lessons in all.`,
      ...books.map(
        (b) =>
          `${b.title}: ${b.chapters.length} ${l === 'vi' ? 'chương' : 'chapters'}, ${b.chapters.reduce((m, c) => m + c.lessons.length, 0)} ${l === 'vi' ? 'bài' : 'lessons'} — ${b.chapters.map((c) => c.title).join('; ')}.`,
      ),
      l === 'vi'
        ? 'Mỗi bài có "Em có biết?", các mục nội dung, công thức, "Ví dụ", "Mẹo", "Ghi nhớ", "Tự kiểm tra" (bấm "Xem đáp án" để hiện đáp án) và "Thử ngay trong SimLab".'
        : 'Each lesson has "Em có biết?" (Did you know?), content sections, formulas, "Ví dụ" (examples), "Mẹo" (tips), "Ghi nhớ" (remember), "Tự kiểm tra" (self-check, press "Xem đáp án" to show the answer) and "Thử ngay trong SimLab" (try it in SimLab).',
    ].join('\n'),
  }));

  add('hub-boards', 'game/src/content/rooms.json · periodic-table.json · strings.json', (l) => ({
    title:
      l === 'vi'
        ? 'Bảng tuần hoàn, Bảng tiến độ học tập và các mô hình ở Sảnh SIMLAB'
        : 'The periodic table, learning progress board and displays in the SIMLAB Hub',
    text: [
      l === 'vi'
        ? `Bảng tuần hoàn (hub-periodic-table) treo ở tường phía bắc ${roomName('simlab-hub', l)}, cạnh cửa phòng Hóa học: ${periodic.length} nguyên tố (Z = 1–${periodic.length}), chia ${new Set(periodic.map((e) => e.category)).size} nhóm; mỗi nguyên tố có tên, nguyên tử khối (hoặc số khối), cấu hình electron, độ âm điện Pauling, số oxi hóa, trạng thái ở điều kiện phòng, nhiệt độ nóng chảy và sôi (K), khối lượng riêng, năng lượng ion hóa (eV, kJ/mol), ái lực electron, bán kính van der Waals (pm) và năm phát hiện.`
        : `The periodic table (hub-periodic-table) hangs on the north wall of the ${roomName('simlab-hub', l)}, by the Chemistry door: ${periodic.length} elements (Z = 1–${periodic.length}) in ${new Set(periodic.map((e) => e.category)).size} categories; each has its name, atomic weight (or mass number), electron configuration, Pauling electronegativity, oxidation states, state at room conditions, melting and boiling point (K), density, ionisation energy (eV, kJ/mol), electron affinity, van der Waals radius (pm) and year of discovery.`,
      l === 'vi'
        ? `Bảng Tiến độ học tập (hub-progress-board) ở tường phía nam, cạnh cửa Phòng chuẩn bị: số thí nghiệm đã xong trên ${experiments.length} (Vật lý ${bySubject('physics')}, Hóa học ${bySubject('chemistry')}, Sinh học ${bySubject('biology')} thí nghiệm có trong game), số chủ đề đã xong trên ${topics.length}, điểm các bài kiểm tra trên giấy (số bài, điểm trung bình, điểm cao nhất, 10 bài gần nhất), số nhiệm vụ hướng dẫn đã xong trên ${tasks.length} và thí nghiệm gợi ý làm tiếp.`
        : `The Learning Progress board (hub-progress-board) is on the south wall, by the Preparation Room door: experiments done out of ${experiments.length} (the game has ${bySubject('physics')} Physics, ${bySubject('chemistry')} Chemistry and ${bySubject('biology')} Biology), topics done out of ${topics.length}, paper-test marks (count, mean, best, the latest 10), guided tasks done out of ${tasks.length} and the next experiment suggested.`,
      l === 'vi'
        ? 'Sảnh còn có mô hình nguyên tử, mô hình ADN, mô hình sóng, sàn kính ở giữa nhìn xuống thành phố 120 m bên dưới, ghế nghỉ (nhấn E để ngồi) và giếng trời tròn trên trần.'
        : 'The Hub also has an atom model, a DNA model, a wave model, a glass floor in the middle looking 120 m down at the city, benches (press E to sit) and a round skylight (oculus) in the ceiling.',
    ].join('\n'),
  }));

  add('how-experiments-work', 'game/src/content/strings.json · items.json', (l) => ({
    title:
      l === 'vi'
        ? 'Cách làm thí nghiệm, bàn làm việc, sai số và phân tích dữ liệu'
        : 'How to run experiments, the workbench, uncertainty and data analysis',
    text: [
      l === 'vi'
        ? 'Có ba cách làm một thí nghiệm. (1) Bàn điều khiển: nhìn vào núm thông số, nhấn E để tăng, F để giảm, rồi bấm CHẠY, DỪNG hoặc ĐẶT LẠI; nhấn H cạnh thiết bị để xem tên từng bộ phận và nguyên lý. (2) Bàn làm việc 5 bước: Chuẩn bị → Chạy → Quan sát → Đo → Phân tích. (3) Làm bằng tay với dụng cụ thật và bảng mạch: E cầm, đặt, cắm linh kiện, nối dây; C săm soi; F đóng hoặc mở nút bình; R rót, bóp hoặc lật.'
        : 'There are three ways to run an experiment. (1) The control desk: look at a dial, press E to raise and F to lower, then press CHẠY (run), DỪNG (stop) or ĐẶT LẠI (reset); press H beside the apparatus for the name of each part and the principle. (2) The 5-stage workbench: Chuẩn bị (set up) → Chạy (run) → Quan sát (observe) → Đo (measure) → Phân tích (analyse). (3) By hand with real glassware and circuit boards: E grabs, sets down, plugs in and connects wires; C inspects closely; F stoppers or unstoppers; R pours, squeezes or turns over.',
      l === 'vi'
        ? 'Màn hình kết quả đặt Lý thuyết, Mô phỏng và Chênh lệch cạnh nhau. Số đọc dụng cụ là giá trị mô phỏng làm tròn theo độ chia d của dụng cụ; độ không đảm bảo chuẩn do độ phân giải là u = d/√12 và sai số làm tròn lớn nhất là d/2. Ô "Tự tính" cho em nhập đáp số tự tính để game kiểm tra.'
        : 'The results monitor puts Theory, Simulated and Difference side by side. An instrument reading is the simulated value rounded to the instrument\'s resolution d; the standard uncertainty from resolution is u = d/√12 and the largest rounding error is d/2. The "Tự tính" field lets you enter your own worked-out answer for the game to check.',
      l === 'vi'
        ? 'Em có thể so sánh 2–4 lần chạy đã xong và xuất CSV. "Phân tích các lần chạy" khớp đường thẳng bình phương tối thiểu y = ax + b: độ dốc a ± sai số chuẩn, hệ số chặn b, R², đại lượng suy ra so với lý thuyết. Với dao động tắt dần có thêm chu kì T, tốc độ tắt dần σ, độ giảm loga δ và hệ số tắt dần ζ.'
        : 'You can compare 2–4 finished runs and export CSV. "Phân tích các lần chạy" (analyse the runs) fits an ordinary least-squares line y = ax + b: slope a ± standard error, intercept b, R² and the derived quantity against theory. A damped oscillation adds the period T, decay rate σ, logarithmic decrement δ and damping ratio ζ.',
    ].join('\n'),
  }));

  add('emergency', 'game/src/content/responders.json', (l) => ({
    title: l === 'vi' ? 'Cháy và gọi cứu hỏa' : 'Fire and calling the fire brigade',
    text: [
      ui('controls.phone', l),
      ...responders.map(
        (r) =>
          `${l === 'vi' ? 'Số' : 'Number'} ${r.numbers.join(', ')}: ${text(r, 'title', l)} ${l === 'vi' ? 'tới' : 'come to the'} ${sceneName(r.arrival.scene, l)}.`,
      ),
      l === 'vi'
        ? `Khi nào cháy: mạch điện bị quá tải hoặc chập (dây, điện trở, bóng đèn, pin bốc khói, đứt cầu chì, cháy bóng hoặc bốc cháy). Em có thể ngắt nguồn điện và dập lửa bằng ${itemLabel('co2-extinguisher', l)} ngay tại chỗ, hoặc nhấn P lấy điện thoại gọi 114 (4 lính cứu hỏa đu dây xuống qua giếng trời Sảnh SIMLAB để dập lửa) hay 113 (4 cảnh sát); số 911 cũng đổi sang 113. Bảng mạch hoặc linh kiện hỏng thay bằng đồ mới trong ${itemLabel('circuit-cabinet', l)}. Gọi báo động giả nhiều lần sẽ bị nhắc nhở.`
        : `When a fire starts: a circuit is overloaded or shorted (wires, resistors, lamps and cells smoke, fuses blow, a lamp burns out or catches fire). You can cut the power and put it out with the ${itemLabel('co2-extinguisher', l)} on the spot, or press P to take out the phone and dial 114 (4 firefighters rappel down through the SIMLAB Hub skylight and put it out) or 113 (4 police officers); 911 also reaches 113. Replace a damaged board or part with a new one from the ${itemLabel('circuit-cabinet', l)}. Repeated false alarms get a warning.`,
    ].join('\n'),
  }));

  add('lan', 'docs/GAME.md · game/src/content/strings.json', (l) => ({
    title: l === 'vi' ? 'Chơi nhiều người qua LAN' : 'Playing together over a LAN',
    text:
      l === 'vi'
        ? 'Menu của game → Chơi → "Chơi nhiều người": tạo phòng (đặt tên phòng và tên của bạn) hoặc vào phòng bằng ID (6 chữ cái và chữ số); các phòng trong cùng mạng tự tìm thấy nhau. Trong phòng mọi người thấy nhau di chuyển, thấy tên và trò chuyện bằng chữ (Enter); bản trong SimLab không có giọng nói. Tin nhắn đi qua bộ lọc của SimLab, có nút Báo cáo. Mỗi người có bài chơi riêng; một trạm thí nghiệm chỉ một người điều khiển tại một lúc. Nếu thẻ ghi "Máy chủ phòng chưa chạy" thì SimLab chưa bật máy chủ phòng (chỉ có trong ứng dụng SimLab trên máy tính).'
        : 'Game menu → Play → "Chơi nhiều người" (Multiplayer): create a room (a room name and your name) or join one by its ID (6 letters and digits); rooms on the same network find each other. In a room everyone sees the others move, their names, and can chat in text (Enter); the copy inside SimLab has no voice. Messages pass SimLab’s filter, and there is a Report button. Everyone keeps their own progress; one player at a time works a station. "Máy chủ phòng chưa chạy" means SimLab’s room server is not running (it exists only in the SimLab desktop app).',
  }));

  add('menu-and-saves', 'game/src/content/strings.json · docs/GAME.md', (l) => ({
    title:
      l === 'vi'
        ? 'Menu chính, màn mở đầu tên lửa, danh mục thí nghiệm và lưu tiến trình'
        : 'Main menu, rocket intro, experiment catalog and saving progress',
    text: [
      l === 'vi'
        ? 'Màn mở đầu là cảnh phóng tên lửa kết hợp cả ba môn: Hóa học (phản ứng cháy metan với oxi CH₄ + 2O₂ → CO₂ + 2H₂O ở đuôi tàu), Vật lí (các vectơ lực đẩy, trọng lực và lực cản), Sinh học (nhịp tim, SpO₂, nhịp thở của phi hành gia Khoa; số liệu minh họa). Có nút bỏ qua.'
        : 'The opening is a rocket launch that mixes all three subjects: Chemistry (methane burning in oxygen, CH₄ + 2O₂ → CO₂ + 2H₂O, at the stern), Physics (thrust, weight and drag vectors) and Biology (heart rate, SpO₂ and breathing of astronaut Khoa; illustrative numbers). It can be skipped.',
      l === 'vi'
        ? 'Menu chính: Chơi (Chơi một mình hoặc Chơi nhiều người), Chọn nhân vật, Danh mục thí nghiệm, Cài đặt. Nền menu chọn "Mặc định" hoặc "Trực tiếp" (sân thượng với Linh và Khoa, đổi theo buổi sáng, chiều, tối, đêm).'
        : 'Main menu: Play (solo or multiplayer), Choose character, Experiment catalog and Settings. The menu background is "Mặc định" (default) or "Trực tiếp" (a live rooftop with Linh and Khoa that follows morning, afternoon, evening and night).',
      l === 'vi'
        ? 'Danh mục thí nghiệm liệt kê mọi thí nghiệm, đã làm hay chưa, đặt ở phòng nào và chỉ đường đi từng bước qua các cửa từ chỗ em đang đứng.'
        : 'The experiment catalog lists every experiment, whether it is done, which room it is in and step-by-step directions through the doors from where you stand.',
      l === 'vi'
        ? 'Chơi một mình có nhiều bản lưu: Chơi tiếp bản gần nhất, Chơi mới, hoặc chọn bản đã lưu và xóa; game tự lưu khi qua cửa và khi về menu. Tạm dừng bằng Esc rồi chọn Tiếp tục hoặc Về menu.'
        : 'Solo play keeps several saves: continue the latest, start a new one, or pick or delete a saved game; the game saves at doors and when you go back to the menu. Esc pauses, then choose Resume or Back to menu.',
      l === 'vi'
        ? 'Cài đặt: Ngôn ngữ, Đồ họa (Thấp, Trung bình, Cao), Giới hạn FPS, Phòng ngủ khi ở xa, 6 thanh âm lượng (Tổng, Hiệu ứng, Phòng, Nhạc, Giao diện, Giọng nói) và Điều khiển.'
        : 'Settings: Language, Graphics (Low, Medium, High), frame cap, room sleep, 6 volume sliders (Master, Effects, Room, Music, Interface, Voice) and Controls.',
    ].join('\n'),
  }));

  add('lan-details', 'docs/GAME.md · game/src/content/strings.json', (l) => ({
    title: l === 'vi' ? 'Trong phòng LAN: thấy gì, làm gì với bạn cùng phòng' : 'In a LAN room: what you see and do with the others',
    text:
      l === 'vi'
        ? 'Phòng LAN: tạo phòng hoặc vào bằng ID 6 ký tự; máy chủ phòng của SimLab dùng cổng 5189 và phát tìm phòng qua UDP cổng 5188 nên các phòng cùng mạng tự hiện. Trong phòng em thấy đồ bảo hộ, vật đang cầm và việc bạn đang làm (ở bàn thí nghiệm, làm bài kiểm tra, nghe điện thoại, nói chuyện với thầy Quang, ngồi, hoặc nằm ngủ trên giường với chữ z z Z). Người chơi va chạm với nhau; ném đồ trúng bạn thì màn hình người đó nháy đỏ và đánh thức người đang ngủ. Trạng thái phòng (cửa, tủ, vòi nước, đèn, bảng mạch, đám cháy) dùng chung. Thầy Quang cũng dùng chung: lời thầy giảng có phụ đề cho người trong bán kính 12 m và chữ thầy viết hiện trên bảng của mọi người. Chat chữ bằng Enter qua bộ lọc của SimLab, có nút Báo cáo; không có giọng nói.'
        : 'LAN room: create a room or join with a 6-character ID; SimLab\'s room server uses port 5189 and announces rooms over UDP port 5188, so rooms on the same network appear by themselves. In a room you see the others\' protective gear, what they hold and what they are doing (at a bench, doing a test paper, on the phone, talking to Mr. Quang, sitting, or asleep in bed with z z Z). Players collide; a thrown item that hits someone flashes their screen red and wakes a sleeper. Room state (doors, cabinets, taps, lights, circuit boards, fires) is shared. Mr. Quang is shared too: his lecture is subtitled for anyone within 12 m and what he writes shows on everyone\'s board. Text chat (Enter) passes SimLab\'s filter and has a Report button; there is no voice.',
  }));

  // The LAN details belong to the one "lan" section: a question about LAN rooms finds them all there.
  const lanAt = sections.findIndex((s) => s.id === 'lan');
  const [lanDetails] = sections.splice(
    sections.findIndex((s) => s.id === 'lan-details'),
    1,
  );
  for (const l of LOCALES) sections[lanAt][l].text += `\n${lanDetails[l].text}`;

  for (const room of rooms) {
    const lab = labOf.get(room.id);
    const here = [...placed].filter(([, at]) => at.includes(room.id)).map(([id]) => id);
    const roomTasks = tasks.filter((t) => t.room === room.id);
    const scene = scenes.find((s) => s.rooms?.includes(room.id));
    const furniture = [
      ...new Set(
        (room.placements ?? [])
          .map((p) => p.item)
          .filter((id) => itemName.has(id) && !/^(door|wall|window|light|control-dial|control-desk)/.test(id)),
      ),
    ];
    add(`room:${room.id}`, 'game/src/content/rooms.json · lab-placements.json · scenes.json', (l) => ({
      title: roomName(room.id, l),
      text: [
        `${roomName(room.id, l)}${lab && text(lab, 'displayName', l) !== roomName(room.id, l) ? ` (${text(lab, 'displayName', l)})` : ''}.`,
        scene && scene.rooms.length > 1
          ? `${l === 'vi' ? 'Cùng khu với' : 'In the same area as'}: ${list(scene.rooms.filter((r) => r !== room.id).map((r) => roomName(r, l)))}.`
          : '',
        room.style ? `${l === 'vi' ? 'Phong cách' : 'Style'}: ${room.style}.` : '',
        furniture.length
          ? `${l === 'vi' ? 'Đồ đạc và thiết bị trong phòng' : 'Furniture and equipment here'}: ${list(furniture.slice(0, 24).map((id) => itemLabel(id, l)))}.`
          : '',
        npcs
          .filter((n) => n.scene === room.id)
          .map((n) => `${l === 'vi' ? 'Ở đây có' : 'Here:'} ${text(n, 'title', l)} (${text(n.character, 'role', l)}).`)
          .join(' '),
        procedures
          .filter((pr) => pr.scene === room.id)
          .map((pr) => `${l === 'vi' ? 'Ở đây làm quy trình' : 'Here you follow'} "${text(pr, 'name', l)}" (${pr.steps.length} ${l === 'vi' ? 'bước' : 'steps'}).`)
          .join(' '),
        here.length ? `${l === 'vi' ? 'Thí nghiệm ở đây' : 'Experiments here'}: ${list(here.map((id) => expName(id, l)))}.` : '',
        roomTasks.length
          ? `${l === 'vi' ? 'Nhiệm vụ hướng dẫn (phím T)' : 'Guided tasks (T key)'}: ${list(roomTasks.map((t) => text(t, 'title', l)))}.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    }));
  }

  for (const topic of topics) {
    add(`topic:${topic.id}`, 'game/src/content/topics.json', (l) => ({
      title: text(topic, 'name', l),
      text: `${l === 'vi' ? 'Chủ đề' : 'Topic'} ${text(topic, 'name', l)} (${SUBJECT[topic.subject]?.[l] ?? topic.subject}): ${list(topic.experiments.map((id) => expName(id, l)))}.`,
    }));
  }

  for (const task of tasks) {
    add(`task:${task.id}`, 'game/src/content/tasks.json', (l) => ({
      title: text(task, 'title', l),
      text: [
        `${l === 'vi' ? 'Nhiệm vụ hướng dẫn' : 'Guided task'} "${text(task, 'title', l)}" (${roomName(task.room, l)}, ${l === 'vi' ? 'phím T' : 'T key'}): ${text(task, 'description', l)}`,
        ...task.steps.map((s, i) => `${i + 1}. ${text(s, 'instruction', l)}`),
      ].join('\n'),
    }));
  }

  for (const e of experiments) {
    const where = placed.get(e.id) ?? [];
    add(`experiment:${e.id}`, `game/src/content/experiments/${e.id}.json`, (l) => ({
      title: text(e, 'name', l),
      text: [
        `${l === 'vi' ? 'Thí nghiệm' : 'Experiment'} ${text(e, 'name', l)} (${SUBJECT[e.category]?.[l] ?? e.category}${where.length ? `, ${list(where.map((r) => roomName(r, l)))}` : ''}). ${text(e, 'description', l)}`,
        e.parameters?.length
          ? `${l === 'vi' ? 'Thông số chỉnh được' : 'Settings'}: ${e.parameters
              .map((p) => {
                const unit = p.unit ? ` ${p.unit}` : '';
                const range = p.min !== undefined && p.max !== undefined ? ` ${num(p.min, l)}–${num(p.max, l)}${unit}` : '';
                return `${text(p, 'label', l)}${p.symbol ? ` ${p.symbol}` : ''}${range}`;
              })
              .join('; ')}.`
          : '',
        e.results?.length ? `${l === 'vi' ? 'Kết quả đo' : 'Results'}: ${list(e.results.map((r) => text(r, 'label', l)))}.` : '',
        e.procedure?.length
          ? `${l === 'vi' ? 'Cách làm' : 'How to run it'}: ${e.procedure.map((s, i) => `${i + 1}. ${text(s, 'instruction', l)}`).join(' ')}`
          : '',
        e.explain?.summary ? `${l === 'vi' ? 'Nguyên lý (phím H)' : 'Principle (H key)'}: ${text(e.explain, 'summary', l)}` : '',
        e.explain?.parts?.length
          ? `${l === 'vi' ? 'Các bộ phận' : 'Parts'}: ${e.explain.parts.map((p) => `${text(p, 'name', l)}: ${text(p, 'role', l)}`).join(' ')}`
          : '',
        e.note ? `${l === 'vi' ? 'Ghi chú lý thuyết' : 'Theory note'}: ${text(e, 'note', l)}` : '',
        e.parameters?.some((p) => p.default !== undefined)
          ? `${l === 'vi' ? 'Giá trị mặc định' : 'Defaults'}: ${e.parameters
              .filter((p) => p.default !== undefined)
              .map((p) => `${text(p, 'label', l)} = ${num(p.default, l)}${p.unit ? ` ${p.unit}` : ''}${p.presets?.length ? ` (${l === 'vi' ? 'có sẵn' : 'presets'}: ${list(p.presets.slice(0, 6).map((x) => `${text(x, 'label', l)} = ${num(x.value, l)}`))})` : ''}`)
              .join('; ')}.`
          : '',
        e.results?.some((r) => r.symbol)
          ? `${l === 'vi' ? 'Ký hiệu kết quả' : 'Result symbols'}: ${list(e.results.map((r) => `${text(r, 'label', l)} ${r.symbol ?? ''}${r.unit ? ` (${r.unit})` : ''}`.trim()))}.`
          : '',
        e.graphs?.length ? `${l === 'vi' ? 'Đồ thị' : 'Graphs'}: ${list(e.graphs.map((g) => text(g, 'title', l)))}.` : '',
        e.instruments?.length
          ? `${l === 'vi' ? 'Dụng cụ đo' : 'Measuring instruments'}: ${list(e.instruments.map((i) => `${text(i, 'name', l)} (${text(i, 'quantity', l)})`))}.`
          : '',
        e.workspace?.pieces?.length
          ? `${l === 'vi' ? 'Bàn làm việc, dụng cụ' : 'Workbench equipment'}: ${list([...new Set(e.workspace.pieces.map((p) => text(p, 'label', l)))])}.${e.workspace.materials?.length ? ` ${l === 'vi' ? 'Hóa chất và vật liệu' : 'Materials'}: ${list([...new Set(e.workspace.materials.map((m) => text(m, 'label', l)))].slice(0, 12))}.` : ''}`
          : '',
        e.explain?.steps?.length
          ? `${l === 'vi' ? 'Giải thích từng bước' : 'Step-by-step principle'}: ${e.explain.steps.map((s, i) => `${i + 1}. ${text(s, 'text', l)}`).join(' ')}`
          : '',
        e.examples?.length
          ? `${l === 'vi' ? 'Ví dụ thầy Quang giảng trên bảng' : 'Worked examples Mr. Quang writes on the board'}: ${e.examples.map((ex) => fill(text(ex, 'question', l), ex.set)).join(' | ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    }));
  }

  // A section is sent whole to a cloud prompt (6000 characters, with its source and status after
  // it): the extras that matter least go first when an experiment is longer than that.
  const BUDGET = 5200;
  const DROP = /^(Ví dụ thầy Quang|Worked examples|Bàn làm việc|Workbench|Dụng cụ đo|Measuring|Đồ thị:|Graphs:|Ký hiệu kết quả|Result symbols|Giá trị mặc định|Defaults:|Các bộ phận|Parts:)/;
  // Last resort (a long theory note, e.g. the microscope): the step-by-step principle, which the
  // "Nguyên lý" summary and the parts already outline.
  const LAST_RESORT = /^(Giải thích từng bước|Step-by-step principle)/;
  for (const s of sections.filter((x) => x.id.startsWith('experiment:'))) {
    for (const l of LOCALES) {
      const lines = s[l].text.split('\n');
      for (const drop of [DROP, LAST_RESORT]) {
        while (lines.join('\n').length > BUDGET) {
          const at = lines.findLastIndex((line) => drop.test(line));
          if (at < 0) break;
          lines.splice(at, 1);
        }
      }
      s[l].text = lines.join('\n');
    }
  }

  return {
    generatedBy: 'scripts/game/gen-game-guide.mjs',
    reviewStatus: 'pending',
    sections,
  };
}

export const serialize = (guide) => `${JSON.stringify(guide, null, 1)}\n`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const guide = buildGameGuide();
  writeFileSync(OUT, serialize(guide));
  console.log(`data/game_guide.json: ${guide.sections.length} sections`);
}
