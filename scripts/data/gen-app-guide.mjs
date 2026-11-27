// Builds data/app_guide.json: what AI Teacher may say about the SimLab desktop app itself (its
// screens, tools, AI engines, shortcuts, settings, curriculum, files, safety, updates).
// Counts and lists come from the code (package.json, src/app/catalog.ts, shortcuts.ts,
// settings/sectionMeta.ts, the vi/en locales) and data/curriculum_kntt.json; the how-to prose
// follows docs/USER_GUIDE.md and docs/AI_TUTOR.md. Run it again after any of them changes:
// `npm run app-guide` (tests/app-guide.test.ts fails while the file is stale).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Run from the repository root (npm scripts and the tests do).
const ROOT = `${process.cwd()}/`;
const OUT = `${ROOT}data/app_guide.json`;
const read = (file) => readFileSync(`${ROOT}${file}`, 'utf8');
const LOCALES = ['vi', 'en'];
const list = (items) => items.filter(Boolean).join(', ');

/** The text between `\n  name: {` and the next `\n  },` of a locale file (one nesting level). */
function block(src, name) {
  const start = src.indexOf(`\n  ${name}: {`);
  if (start < 0) throw new Error(`app-guide: no "${name}" block in a locale`);
  const end = src.indexOf('\n  },', start);
  return src.slice(start, end);
}
const labels = (src, name) =>
  Object.fromEntries(
    [
      ...block(src, name).matchAll(/\n\s{4}(\w+): (?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"),/g),
    ].map((m) => [m[1], (m[2] ?? m[3]).replace(/\\'/g, "'")]),
  );

/** The catalog: subject → chapters → topics (src/app/catalog.ts), named from the locale files. */
function catalog() {
  const src = read('src/app/catalog.ts');
  const names = Object.fromEntries(
    LOCALES.map((l) => {
      const file = read(`src/app/i18n/locales/${l}.ts`);
      return [l, { chapters: labels(file, 'chapters'), topics: labels(file, 'topics') }];
    }),
  );
  const at = (s) => src.indexOf(`  ${s}: [`);
  const cuts = {
    physics: [at('physics'), at('chemistry')],
    chemistry: [at('chemistry'), at('biology')],
    biology: [at('biology'), src.indexOf('\n};', at('biology'))],
  };
  const out = {};
  for (const [subject, [from, to]] of Object.entries(cuts)) {
    out[subject] = [...src.slice(from, to).matchAll(/chapter\(\s*'(\w+)',\s*\[([^\]]*)\]/g)].map(
      (m) => ({
        id: m[1],
        topics: [...m[2].matchAll(/'(\w+)'/g)].map((t) => t[1]),
      }),
    );
  }
  const describe = (subject, l) =>
    out[subject]
      .map(
        (c) =>
          `${names[l].chapters[c.id] ?? c.id} (${list(c.topics.map((t) => names[l].topics[t] ?? t))})`,
      )
      .join('; ');
  const count = (subject) => out[subject].reduce((n, c) => n + c.topics.length, 0);
  return { describe, count };
}

const ACTIONS = {
  playPause: ['Chạy / Tạm dừng', 'Play / Pause'],
  reset: ['Đặt lại', 'Reset'],
  step: ['Bước từng khung', 'Step one frame'],
  undo: ['Hoàn tác', 'Undo'],
  redo: ['Làm lại', 'Redo'],
  save: ['Lưu tệp .stemsim', 'Save a .stemsim file'],
  open: ['Mở tệp .stemsim', 'Open a .stemsim file'],
  presentation: ['Chế độ trình chiếu', 'Presentation mode'],
  exitPresentation: ['Thoát trình chiếu', 'Leave presentation mode'],
  fontLarger: ['Chữ lớn hơn', 'Larger text'],
  fontSmaller: ['Chữ nhỏ hơn', 'Smaller text'],
  toolSelect: ['Công cụ chọn', 'Select tool'],
  toolDrag: ['Công cụ kéo', 'Drag tool'],
  toolRuler: ['Thước đo', 'Ruler'],
  toolProtractor: ['Thước đo góc', 'Protractor'],
  toolStopwatch: ['Đồng hồ bấm giờ', 'Stopwatch'],
  toolFitView: ['Vừa khung nhìn', 'Fit view'],
  commandPalette: ['Bảng lệnh nhanh', 'Command palette'],
  shortcutSheet: ['Bảng phím tắt', 'Shortcut sheet'],
};
const SETTINGS = {
  appearance: ['Giao diện', 'Appearance'],
  simulation: ['Mô phỏng', 'Simulation'],
  ai: ['Kết nối AI', 'AI connection'],
  teacher: ['AI Teacher', 'AI Teacher'],
  local: ['AI trong SimLab', 'AI inside SimLab'],
  runtimes: ['AI trên máy khác', 'AI on another program'],
  gpu: ['GPU cho Gemma', 'GPU for Gemma'],
  knowledge: ['Thư viện tri thức', 'Knowledge library'],
  memory: ['Trí nhớ cuộc trò chuyện', 'Conversation memory'],
  voice: ['Giọng đọc', 'Voice'],
  safety: ['An toàn và quyền riêng tư', 'Safety and privacy'],
  shortcuts: ['Phím tắt', 'Shortcuts'],
  versions: ['Phiên bản', 'Versions'],
};

export function buildAppGuide() {
  const pkg = JSON.parse(read('package.json'));
  const cat = catalog();
  const kntt = JSON.parse(read('data/curriculum_kntt.json'));
  const shortcuts = [...read('src/app/shortcuts/shortcuts.ts').matchAll(/\baction: '(\w+)'/g)].map(
    (m) => m[1],
  );
  const pages = [
    ...read('src/app/settings/sectionMeta.ts').matchAll(/\n  (\w+): \{\n\s+icon:/g),
  ].map((m) => m[1]);
  for (const id of [...shortcuts])
    if (!ACTIONS[id]) throw new Error(`app-guide: no text for shortcut ${id}`);
  for (const id of pages)
    if (!SETTINGS[id]) throw new Error(`app-guide: no text for settings page ${id}`);
  const books = kntt.books.map((b) => ({
    title: b.title,
    theory: b.counts.theory,
    total: b.counts.total,
  }));
  const theory = books.reduce((n, b) => n + b.theory, 0);

  const sections = [];
  const add = (id, source, vi, en) => sections.push({ id, source, vi, en });

  add(
    'app-overview',
    'package.json · docs/USER_GUIDE.md',
    {
      title: 'SimLab là gì, các màn hình chính',
      text: [
        `SimLab (phiên bản ${pkg.version}) là ứng dụng máy tính học Vật lý, Hóa học, Sinh học bằng mô phỏng. Nguyên tắc cốt lõi: mọi con số khoa học do bộ giải tất định tính; AI chỉ đọc đề, trích tham số và diễn giải, không tự bịa số.`,
        'Màn khởi động có hai không gian: Virtual Lab (phòng thí nghiệm ảo) và AI Teacher (gia sư AI). Màn chính của Virtual Lab hỏi "Hôm nay học gì?".',
        'Bố cục cửa sổ Virtual Lab: Thanh trên cùng (menu Tệp ☰), cột trái (Thư viện chủ đề, Lịch sử, Science Studio, SimLab 3D), Sân khấu mô phỏng cùng thanh công cụ nổi và Dòng thời gian, Bảng dưới cùng (Đồ thị, Lời giải, Sổ ghi...), Thanh thuộc tính bên phải, Thanh trạng thái và khung chat AI Teacher.',
      ].join('\n'),
    },
    {
      title: 'What SimLab is and its main screens',
      text: [
        `SimLab (version ${pkg.version}) is a desktop app for learning Physics, Chemistry and Biology through simulation. Its core rule: every scientific number is computed by deterministic solvers; the AI only reads problems, extracts parameters and explains, and never invents numbers.`,
        'The launch screen has two spaces: Virtual Lab and AI Teacher. The Virtual Lab home asks "Hôm nay học gì?" (what shall we learn today?).',
        'Virtual Lab window layout: top bar (File menu ☰), left column (topic Library, History, Science Studio, SimLab 3D), the simulation Stage with a floating toolbar and the Timeline, a bottom panel (Graphs, Solution, Run log...), an Inspector on the right, a status bar and the AI Teacher chat.',
      ].join('\n'),
    },
  );

  add(
    'app-problem-reading',
    'docs/USER_GUIDE.md · docs/AI_TUTOR.md',
    {
      title: 'Đọc đề bằng AI và Tự dựng cảnh',
      text: [
        'Dán hoặc gõ đề vào ô đề bài rồi bấm "Phân tích đề" (hoặc Ctrl+Enter). Có thể chụp ảnh đề bằng camera, nhưng cần mô hình đọc được ảnh (ví dụ Gemma 4 E2B hoặc một mô hình có thị giác qua API).',
        'Trước khi chạy, SimLab hiện hộp "Tôi hiểu đề như sau" để em kiểm tra: mỗi tham số ghi rõ nguồn là "đề bài", "mặc định" hay "đã chỉnh"; chỗ thiếu ghi "Cần nhập". Đề đã phân tích được nhớ trong bộ đệm 100 đề gần nhất.',
        'Khung "AI diễn giải" giải thích kết quả và đối chiếu từng con số với trạng thái mô phỏng. "Tự dựng cảnh" cho em dựng cảnh bằng tay, hoạt động cả khi không có AI.',
      ].join('\n'),
    },
    {
      title: 'Reading problems with AI and the manual scene builder',
      text: [
        'Paste or type a problem in the problem box and press "Phân tích đề" (Analyse the problem, or Ctrl+Enter). You can photograph a problem with the camera, which needs a model that can read images (for example Gemma 4 E2B, or a vision model through an API).',
        'Before it runs, SimLab shows the "Tôi hiểu đề như sau" (I understand the problem as follows) box to check: each parameter says whether it came from the problem ("đề bài"), is a default ("mặc định") or was edited ("đã chỉnh"); a missing one says "Cần nhập" (needs input). Analysed problems are kept in a cache of the latest 100.',
        'The "AI diễn giải" (AI explanation) panel explains the result and checks every number against the simulation state. "Tự dựng cảnh" (manual scene builder) lets you build a scene by hand and works without any AI.',
      ].join('\n'),
    },
  );

  add(
    'app-ai-teacher',
    'docs/AI_TUTOR.md',
    {
      title: 'AI Teacher: khung chat và trang toàn màn hình',
      text: [
        'AI Teacher mở theo hai cách: cột chat gắn bên phải trong Virtual Lab (không che mô phỏng; nút "Lấy thông tin từ màn hình" chỉ gửi trạng thái màn hình khi em chủ động bấm), hoặc không gian AI Teacher toàn màn hình với quả cầu 3D phản hồi theo trạng thái, hai thẻ "Trò chuyện" và "Bảng giảng", thêm "Ghi nhớ" và "Lượt dùng" ở chế độ Nâng cao.',
        'Có các nút gợi ý nhanh; "Viết tiếp" khi câu trả lời dài bị dừng; "Hoàn tác" trong vài giây sau khi xóa cuộc trò chuyện; khung xanh "Kết quả do SimLab tính" khi cân bằng phương trình hóa học hoặc tra cứu dữ liệu; nút "Xem mô phỏng" nhảy sang chủ đề liên quan.',
      ].join('\n'),
    },
    {
      title: 'AI Teacher: the chat column and the full-screen page',
      text: [
        'AI Teacher opens two ways: a chat column docked on the right of the Virtual Lab (it never covers the simulation; the "Lấy thông tin từ màn hình" button sends the screen state only when you press it), or the full-screen AI Teacher space with a 3D orb that reacts to its state, two tabs "Trò chuyện" (chat) and "Bảng giảng" (whiteboard), plus "Ghi nhớ" (memory) and "Lượt dùng" (usage) in Advanced mode.',
        'There are quick-action chips; "Viết tiếp" (continue) when a long answer stops; "Hoàn tác" (undo) for a few seconds after clearing the chat; a green "Kết quả do SimLab tính" (computed by SimLab) box for chemical-equation balancing and data lookups; and a "Xem mô phỏng" button that jumps to the related topic.',
      ].join('\n'),
    },
  );

  add(
    'app-whiteboard',
    'docs/AI_TUTOR.md',
    {
      title: 'Bảng giảng (TeachScript) và Khoanh để hỏi',
      text: [
        'Bảng giảng là bảng trắng 3 cột chữ viết tay tiếng Việt do AI Teacher viết bằng TeachScript (các thẻ <write>, <plot>, <draw>). Có điều khiển Từng bước hoặc Tự động, tốc độ 0,75×–2×, bản đồ thu nhỏ, phóng to 1×–2×, bút tím và tẩy của người học. Mỗi con số được kiểm chứng: ✓ khớp bộ giải, ⚠ "Số do AI tự đưa ra".',
        '"Khoanh để hỏi": khoanh một vùng trên bảng để hỏi. Chữ, công thức LaTeX và nhãn trong vòng khoanh được đọc trực tiếp; nếu khoanh vùng hình vẽ không chữ hoặc nét viết tay thì chỉ ảnh cắt được gửi cho AI thị giác chạy ngay trên máy, không gửi lên đám mây.',
      ].join('\n'),
    },
    {
      title: 'The whiteboard (TeachScript) and Circle to ask',
      text: [
        'The whiteboard ("Bảng giảng") is a 3-column handwritten-Vietnamese board that AI Teacher writes with TeachScript (the <write>, <plot> and <draw> tags). It has Step or Auto control, 0.75×–2× speed, a minimap, 1×–2× zoom, and the learner\'s purple pen and eraser. Each number is checked: ✓ matches the solver, ⚠ "Số do AI tự đưa ra" (a number the AI made up).',
        '"Khoanh để hỏi" (Circle to ask): circle a region of the board to ask about it. Text, LaTeX formulas and labels inside the loop are read directly; if you circle an unlabelled drawing or handwriting, only the cropped image goes to an on-device vision AI, never to the cloud.',
      ].join('\n'),
    },
  );

  add(
    'app-ai-engines',
    'docs/AI_TUTOR.md · docs/USER_GUIDE.md',
    {
      title: 'Các chế độ AI: đám mây, Deepthink, Gemma, Qwen, Ollama',
      text: [
        'Kết nối AI (đám mây): Gemini (mặc định, khóa miễn phí tại aistudio.google.com/apikey), Claude (Anthropic) và khóa dự phòng miễn phí Groq (console.groq.com/keys; tự chuyển trong 10 phút khi gặp lỗi hết hạn mức 429/402). Khóa lưu trong Windows Credential Manager (OS Keychain); có nút "Kiểm tra key" và giới hạn lượt gọi mỗi ngày.',
        'Deepthink: cần từ hai nhà cung cấp trở lên; AI thứ nhất viết bản nháp, AI thứ hai độc lập phản biện và viết lại; bước phản biện không dùng khóa dự phòng để một nhà cung cấp không tự chấm chính mình.',
        'AI trong SimLab (chạy ngay trong máy): Gemma qua WebGPU và bộ nhớ OPFS (Gemma 3 270M ≈ 345 MB, Gemma 3 1B ≈ 880 MB, Gemma 4 E2B ≈ 3,8 GB và đọc được ảnh) và Qwen 3.5 9B (≈ 5,6 GB, chạy qua llama-server Vulkan đi kèm, cần card đồ họa rời ≥ 8 GB VRAM; tự giải phóng sau 10 phút rỗi hoặc bấm "Giải phóng bộ nhớ card").',
        'GPU cho Gemma: chọn Tự động, Card rời hoặc Đồ họa tích hợp (dùng --use-adapter-luid, áp dụng sau khi khởi động lại); SimLab tự bảo vệ khi GPU tích hợp gặp sự cố.',
        'AI trên máy khác: kết nối Ollama (:11434), LM Studio (:1234), llama.cpp (:8080) hoặc địa chỉ loopback tự nhập; có "Tìm trên máy này", "Kiểm tra kết nối", "Kiểm tra trả lời". Model đám mây của Ollama bị từ chối và SimLab không bao giờ âm thầm chuyển sang AI trực tuyến.',
      ].join('\n'),
    },
    {
      title: 'AI engines: cloud, Deepthink, Gemma, Qwen, Ollama',
      text: [
        'AI connection (cloud): Gemini (default, a free key at aistudio.google.com/apikey), Claude (Anthropic) and the free fallback Groq (console.groq.com/keys; it takes over for 10 minutes after a 429/402 quota error). Keys are stored in the Windows Credential Manager (OS keychain); there is a "Kiểm tra key" (test key) button and a daily cap.',
        'Deepthink: needs two or more providers; the first AI writes a draft and a second, independent one reviews and rewrites it; the quota fallback is not used for the review, so a provider never reviews itself.',
        'AI inside SimLab (runs on this computer): Gemma through WebGPU and OPFS storage (Gemma 3 270M ≈ 345 MB, Gemma 3 1B ≈ 880 MB, Gemma 4 E2B ≈ 3.8 GB, which also reads images) and Qwen 3.5 9B (≈ 5.6 GB, run by the bundled Vulkan llama-server, needs a discrete GPU with ≥ 8 GB VRAM; it unloads after 10 idle minutes or with "Giải phóng bộ nhớ card").',
        'GPU for Gemma: Auto, Discrete or Integrated graphics (uses --use-adapter-luid, applied after a restart); SimLab protects itself if an integrated GPU crashes.',
        'AI on another program: connect Ollama (:11434), LM Studio (:1234), llama.cpp (:8080) or a custom loopback address; there are "Tìm trên máy này" (find on this computer), "Kiểm tra kết nối" (test connection) and "Kiểm tra trả lời" (test reply). Ollama cloud models are refused and SimLab never silently switches to an online AI.',
      ].join('\n'),
    },
  );

  add(
    'app-science-studio',
    'docs/USER_GUIDE.md',
    {
      title: 'Science Studio và Soạn bài',
      text: 'Science Studio mở được từ Virtual Lab bằng ba cách (nút ở cột trái, màn chính, bảng lệnh Ctrl+K). Mỗi kịch bản đi 6 bước POE: Dự đoán → Thí nghiệm → Quan sát → Giải thích → Kết luận → Báo cáo. Có sẵn kịch bản Vật lý, Hóa học, Sinh học và các bài định tính trong sách có hoạt động sắp xếp thứ tự, nối cặp, phân loại. Nút "Hỏi thầy" mở AI Teacher; báo cáo lưu ra tệp Markdown (.md) hoặc sao chép. "Soạn bài" cho giáo viên tự tạo kịch bản, có kiểm tra hợp lệ và nhập/xuất JSON.',
    },
    {
      title: 'Science Studio and lesson authoring',
      text: 'Science Studio opens from the Virtual Lab in three ways (the left-column button, the home screen, the Ctrl+K palette). Each scenario goes through 6 POE steps: Predict → Experiment → Observe → Explain → Conclude → Report. There are built-in Physics, Chemistry and Biology scenarios and qualitative textbook lessons with order, match and sort activities. The "Hỏi thầy" (ask the teacher) button opens AI Teacher; reports are saved as Markdown (.md) or copied. "Soạn bài" (lesson authoring) lets teachers write their own scenarios, with validation and JSON import/export.',
    },
  );

  add(
    'app-science-card',
    'docs/USER_GUIDE.md',
    {
      title: 'Thẻ Khoa học, độ tin cậy và Học bằng khám phá',
      text: 'Thẻ Khoa học có nhãn độ tin cậy: "Định lượng chính xác" (xanh lá), "Định lượng gần đúng" (vàng), "Định tính / minh họa" (xanh dương); nhãn "Đã có can thiệp" hiện khi em kéo vật bằng chuột; cảnh báo khi năng lượng lệch quá 1e-9. Chế độ Cơ bản ẩn bớt chi tiết, chế độ Nâng cao hiện đủ (Quét tham số, thẻ Ghi nhớ, Lượt dùng). Học bằng khám phá có thẻ "Thử thách": "Dự đoán trước", các thử thách, "Gợi ý từng bước", dấu ✓ Đã học / Hoàn thành, huy hiệu và nhắc nghỉ mắt sau 45 phút.',
    },
    {
      title: 'The Science Card, confidence labels and Learn by exploring',
      text: 'The Science Card carries a confidence label: "Định lượng chính xác" (exact quantitative, green), "Định lượng gần đúng" (approximate quantitative, yellow), "Định tính / minh họa" (qualitative or illustrative, blue); an "Đã có can thiệp" (intervened) label appears when you drag an object with the mouse; and a warning when energy drifts by more than 1e-9. Basic mode hides detail and Advanced mode shows everything (Parameter sweep, the Memory and Usage tabs). Learn by exploring has a "Thử thách" (challenge) tab: "Dự đoán trước" (predict first), challenges, "Gợi ý từng bước" (step hints), ✓ Learned / Completed marks, badges and an eye-break reminder after 45 minutes.',
    },
  );

  add(
    'app-physics',
    'src/app/catalog.ts · docs/USER_GUIDE.md',
    {
      title: 'Vật lý trong SimLab: chủ đề và công cụ',
      text: `Thư viện Vật lý có ${cat.count('physics')} chủ đề: ${cat.describe('physics', 'vi')}.\nCông cụ nổi trên sân khấu: V chọn, H kéo, M thước, A thước đo góc, T đồng hồ bấm giờ, F vừa khung nhìn; vectơ, vết quỹ đạo; "Ghim lần chạy này để so sánh". Dòng thời gian ×0,1 đến ×4. Bảng dưới có Đồ thị (kể cả Không gian pha và Vòng tròn pha), Lời giải, Sổ ghi (20 lần chạy gần nhất) và Quét tham số (5–50 điểm, Nâng cao, xuất CSV); nhiều chủ đề có chế độ xem 3D.`,
    },
    {
      title: 'Physics in SimLab: topics and tools',
      text: `The Physics library has ${cat.count('physics')} topics: ${cat.describe('physics', 'en')}.\nFloating stage tools: V select, H drag, M ruler, A protractor, T stopwatch, F fit view; vectors and trails; "Ghim lần chạy này để so sánh" (pin this run to compare). The Timeline runs ×0.1 to ×4. The bottom panel has Graphs (including Phase space and the Phasor circle), Solution, the Run log "Sổ ghi" (latest 20 runs) and Parameter sweep "Quét tham số" (5–50 points, Advanced, CSV export); many topics have a 3D view.`,
    },
  );

  add(
    'app-chemistry-biology',
    'src/app/catalog.ts · docs/USER_GUIDE.md',
    {
      title: 'Hóa học và Sinh học trong SimLab: chủ đề và công cụ',
      text: `Hóa học có ${cat.count('chemistry')} chủ đề: ${cat.describe('chemistry', 'vi')}.\nSinh học có ${cat.count('biology')} chủ đề: ${cat.describe('biology', 'vi')}.\nCông cụ Hóa học: Bảng tuần hoàn 118 nguyên tố, cấu hình electron / Bohr / orbital 3D, nguyên tử và đồng vị 3D, phân tử 3D (VSEPR, nhóm chức; Shift+nhấp để đo khoảng cách và góc), tinh thể 3D, thư viện phản ứng đã kiểm chứng và cơ chế 3D, cân bằng phương trình chính xác, chuẩn độ axit–bazơ, giản đồ năng lượng, hộp khí Maxwell–Boltzmann và thuyết va chạm (có "Theo dõi một hạt"), phức chất 3D. Sinh học có các mô-đun 2D/3D như nguyên phân, giảm phân (nút "Làm mờ phần còn lại"), phiên mã và dịch mã, đột biến, Mendel, Hardy–Weinberg, tăng trưởng quần thể, Lotka–Volterra, enzyme, khuếch tán và thẩm thấu, tế bào, virus, operon Lac...`,
    },
    {
      title: 'Chemistry and Biology in SimLab: topics and tools',
      text: `Chemistry has ${cat.count('chemistry')} topics: ${cat.describe('chemistry', 'en')}.\nBiology has ${cat.count('biology')} topics: ${cat.describe('biology', 'en')}.\nChemistry tools: the 118-element periodic table, electron configuration / Bohr / 3D orbitals, 3D atoms and isotopes, 3D molecules (VSEPR, functional groups; Shift+click measures distances and angles), 3D crystals, a verified reaction library and 3D mechanisms, exact equation balancing, acid–base titration, energy diagrams, the Maxwell–Boltzmann gas box and collision theory (with "Theo dõi một hạt", track one particle), 3D complexes. Biology has 2D/3D modules such as mitosis, meiosis (with "Làm mờ phần còn lại", dim the rest), transcription and translation, mutation, Mendel, Hardy–Weinberg, population growth, Lotka–Volterra, enzymes, diffusion and osmosis, the cell, viruses, the lac operon...`,
    },
  );

  add(
    'app-curriculum-kntt',
    'data/curriculum_kntt.json',
    {
      title: 'Chương trình Kết nối tri thức lớp 10–12',
      text: `Thanh lọc "Lớp 10 · Lớp 11 · Lớp 12 · Tất cả" lọc chủ đề theo lớp. SimLab đối chiếu ${kntt.books.length} cuốn SGK "Kết nối tri thức với cuộc sống" (Vật lí, Hóa học, Sinh học 10–12): ${books.map((b) => `${b.title} ${b.theory}/${b.total} bài lí thuyết`).join('; ')}; tổng ${theory} bài lí thuyết. Quy ước SGK: g = 9,8 m/s² mặc định (đổi được 9,81 hoặc 10), khối lượng riêng nước 999 kg/m³ ở 20 °C; Thẻ Khoa học ghi rõ bài và trang SGK.`,
    },
    {
      title: 'The Kết nối tri thức curriculum for grades 10–12',
      text: `The filter bar "Lớp 10 · Lớp 11 · Lớp 12 · Tất cả" (grade 10, 11, 12, all) filters topics by grade. SimLab maps ${kntt.books.length} "Kết nối tri thức với cuộc sống" textbooks (Physics, Chemistry, Biology 10–12): ${books.map((b) => `${b.title} ${b.theory}/${b.total} theory lessons`).join('; ')}; ${theory} theory lessons in all. Textbook conventions: g = 9.8 m/s² by default (9.81 or 10 can be chosen), water density 999 kg/m³ at 20 °C; the Science Card names the lesson and page.`,
    },
  );

  add(
    'app-files-shortcuts-settings',
    'src/app/shortcuts/shortcuts.ts · src/app/settings/sectionMeta.ts',
    {
      title: 'Tệp, phím tắt và Cài đặt',
      text: [
        'Menu Tệp (☰): Lưu và Mở tệp .stemsim, xuất ảnh PNG, xuất CSV, Hoàn tác Ctrl+Z / Làm lại Ctrl+Y, Lịch sử (SQLite, tối đa 500 lần chạy), Thông tin máy, Nguồn & Giả định, Hướng dẫn nhanh.',
        `Phím tắt (${shortcuts.length}): ${shortcuts.map((a) => `${ACTIONS[a][0]}`).join(', ')}; Space chạy/tạm dừng, R đặt lại, . bước từng khung, Ctrl+S lưu, Ctrl+O mở, F5 trình chiếu, Ctrl+K bảng lệnh nhanh, Ctrl+/ bảng phím tắt.`,
        `Cài đặt có ${pages.length} trang: ${pages.map((p) => SETTINGS[p][0]).join(', ')}. Giọng đọc tiếng Việt: MMS-TTS, giọng Windows hoặc Gemini TTS; Trí nhớ cuộc trò chuyện Vừa hoặc Dài và tự tóm tắt; Chuyển động theo Hệ thống, Giảm hoặc Đầy đủ; Thư viện tri thức nhập .txt, .md, .csv, .json và bật/tắt tra cứu Wikipedia.`,
      ].join('\n'),
    },
    {
      title: 'Files, shortcuts and Settings',
      text: [
        'File menu (☰): Save and Open .stemsim files, export PNG, export CSV, Undo Ctrl+Z / Redo Ctrl+Y, History (SQLite, up to 500 runs), Machine info, Sources & Assumptions, Quick guide.',
        `Shortcuts (${shortcuts.length}): ${shortcuts.map((a) => `${ACTIONS[a][1]}`).join(', ')}; Space play/pause, R reset, . step one frame, Ctrl+S save, Ctrl+O open, F5 presentation, Ctrl+K command palette, Ctrl+/ shortcut sheet.`,
        `Settings has ${pages.length} pages: ${pages.map((p) => SETTINGS[p][1]).join(', ')}. Vietnamese voice: MMS-TTS, the Windows voice or Gemini TTS; Conversation memory Medium or Long with automatic summaries; Motion System, Reduced or Full; the Knowledge library imports .txt, .md, .csv, .json and can switch Wikipedia lookup on or off.`,
      ].join('\n'),
    },
  );

  add(
    'app-safety-updates',
    'docs/STORE.md · docs/USER_GUIDE.md',
    {
      title: 'An toàn 18+, quyền riêng tư, cập nhật và Microsoft Store',
      text: 'Cổng xác nhận tuổi 18+ do phần Rust kiểm tra: dưới 18 tuổi vẫn dùng đủ mô phỏng nhưng AI tắt. Nội dung AI có nhãn "Nội dung do AI hỗ trợ" và nút Báo cáo; có lọc hai chiều và lọc dữ liệu cá nhân; thẻ hỗ trợ khủng hoảng (Ngày Mai 096 306 1414, khẩn cấp 115); hộp "Dữ liệu của em đi đâu?" nói rõ dữ liệu nào rời máy. Cài từ Microsoft Store thì tự cập nhật qua Store và không bị SmartScreen cảnh báo; cài từ GitHub Releases (.exe/.msi) thì SimLab tự cập nhật bằng gói có chữ ký Ed25519 (nếu Smart App Control chặn, xem hướng dẫn trong tài liệu).',
    },
    {
      title: 'Safety (18+), privacy, updates and the Microsoft Store',
      text: 'The 18+ age gate is enforced in the Rust side: under 18 the learner keeps every simulation but the AI is off. AI content carries an "Nội dung do AI hỗ trợ" (AI-assisted content) label and a Report button; there is two-way moderation and a personal-data filter; a crisis-support card (Ngày Mai 096 306 1414, emergency 115); and a "Dữ liệu của em đi đâu?" (where does my data go?) box says exactly what leaves the machine. Installed from the Microsoft Store, SimLab updates through the Store with no SmartScreen warning; installed from GitHub Releases (.exe/.msi), it updates itself with an Ed25519-signed package (if Smart App Control blocks it, see the guide in the docs).',
    },
  );

  return { generatedBy: 'scripts/data/gen-app-guide.mjs', reviewStatus: 'pending', sections };
}

export const serialize = (guide) => `${JSON.stringify(guide, null, 1)}\n`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const guide = buildAppGuide();
  writeFileSync(OUT, serialize(guide));
  console.log(`data/app_guide.json: ${guide.sections.length} sections`);
}
