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
const L = (vi, en) => ({ vi, en });

/** Interface texts: the English beside each key in the game's code, Vietnamese in strings.json. */
function uiTexts() {
  const vi = json('strings.json').vi;
  const en = {};
  for (const file of ['game/src/platform/ui/ControlsPanel.ts', 'game/src/platform/ui/dom.ts']) {
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
    ].join('\n'),
  }));

  add('controls', 'game/src/core/config.ts · game/src/platform/ui/ControlsPanel.ts', (l) => ({
    title: l === 'vi' ? 'Phím điều khiển' : 'Controls',
    text: `${l === 'vi' ? 'Phím điều khiển mặc định (đổi được trong Cài đặt → Điều khiển)' : 'Default controls (they can be changed in Settings → Controls)'}:\n${controls(ui, keys, l)}`,
  }));

  add(`procedure:${procedure.id}`, 'game/src/content/procedures.json', (l) => ({
    title: text(procedure, 'name', l),
    text: [
      `${text(procedure, 'name', l)} (${roomName(procedure.scene, l)}): ${text(procedure, 'description', l)}`,
      ...procedure.steps.map((s, i) => `${i + 1}. ${text(s, 'instruction', l)}`),
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
    ].join('\n'),
  }));

  add('lan', 'docs/GAME.md · game/src/content/strings.json', (l) => ({
    title: l === 'vi' ? 'Chơi nhiều người qua LAN' : 'Playing together over a LAN',
    text:
      l === 'vi'
        ? 'Menu của game → Chơi → "Chơi nhiều người": tạo phòng (đặt tên phòng và tên của bạn) hoặc vào phòng bằng ID (6 chữ cái và chữ số); các phòng trong cùng mạng tự tìm thấy nhau. Trong phòng mọi người thấy nhau di chuyển, thấy tên và trò chuyện bằng chữ (Enter); bản trong SimLab không có giọng nói. Tin nhắn đi qua bộ lọc của SimLab, có nút Báo cáo. Mỗi người có bài chơi riêng; một trạm thí nghiệm chỉ một người điều khiển tại một lúc. Nếu thẻ ghi "Máy chủ phòng chưa chạy" thì SimLab chưa bật máy chủ phòng (chỉ có trong ứng dụng SimLab trên máy tính).'
        : 'Game menu → Play → "Chơi nhiều người" (Multiplayer): create a room (a room name and your name) or join one by its ID (6 letters and digits); rooms on the same network find each other. In a room everyone sees the others move, their names, and can chat in text (Enter); the copy inside SimLab has no voice. Messages pass SimLab’s filter, and there is a Report button. Everyone keeps their own progress; one player at a time works a station. "Máy chủ phòng chưa chạy" means SimLab’s room server is not running (it exists only in the SimLab desktop app).',
  }));

  for (const room of rooms) {
    const lab = labOf.get(room.id);
    const here = [...placed].filter(([, at]) => at.includes(room.id)).map(([id]) => id);
    const roomTasks = tasks.filter((t) => t.room === room.id);
    add(`room:${room.id}`, 'game/src/content/rooms.json · lab-placements.json', (l) => ({
      title: roomName(room.id, l),
      text: [
        `${roomName(room.id, l)}${lab && text(lab, 'displayName', l) !== roomName(room.id, l) ? ` (${text(lab, 'displayName', l)})` : ''}.`,
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
      ]
        .filter(Boolean)
        .join('\n'),
    }));
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
