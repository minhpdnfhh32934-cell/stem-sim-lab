/**
 * Makes the version history documents from release-notes/versions.json, the one source
 * (release-notes/README.md):
 *
 *   docs/VERSION_HISTORY.md          Vietnamese history, sections I–VIII
 *   docs/CHANGELOG.md                Keep a Changelog style, newest first
 *   release-notes/google-docs.html   the same content as VERSION_HISTORY.md in clean HTML,
 *                                    ready to become the Google Doc
 *                                    "SimLab — Version History & Release Notes"
 *
 * Run: npm run release-notes. tests/release-notes.test.ts renders in memory and compares with the
 * files on disk, so a stale document fails the tests. Plain Node (no dependencies); the data is
 * validated by the zod schema in src/app/whatsnew/releaseNotes.ts (tested), not here.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OUTPUT_FILES = Object.freeze({
  history: 'docs/VERSION_HISTORY.md',
  changelog: 'docs/CHANGELOG.md',
  html: 'release-notes/google-docs.html',
});

export const DOC_TITLE = 'SimLab — Version History & Release Notes';

export const SECTIONS = Object.freeze([
  'I. Tổng quan lịch sử SimLab',
  'II. Dòng thời gian phát triển từ bản gốc',
  'III. Chi tiết từng phiên bản',
  'IV. Cải tiến về AI Teacher, bảng dạy, giọng nói, Gemma local + API',
  'V. Cải tiến mô phỏng 3D Sinh học',
  'VI. Lịch sử bảo mật, hiệu năng và kết quả kiểm thử',
  'VII. Những vấn đề chưa hoàn thành',
  'VIII. Tham chiếu commit, PR, tag và GitHub Release',
]);

export const STATUS_LABEL = Object.freeze({
  released: 'Đã phát hành',
  'merged-not-released': 'Đã gộp, chưa phát hành',
  'in-review': 'Đang xét duyệt',
  development: 'Bản phát triển, không phát hành',
  unverified: 'Chưa xác minh',
});

const CHANNEL_LABEL = {
  github: 'GitHub Releases: bộ cài Windows và cập nhật trong app',
  'github-web': 'GitHub Releases: chỉ cập nhật phần web (bộ cài giữ số phiên bản lõi cũ)',
  store: 'Microsoft Store (bản nộp duyệt)',
  zip: 'Tệp ZIP gửi tay',
  none: 'Không phân phối',
};

const CATEGORIES = [
  'added',
  'improved',
  'fixed',
  'security',
  'performance',
  'changed',
  'deprecated',
  'knownIssues',
];

const CATEGORY_LABEL = {
  added: 'Tính năng mới',
  improved: 'Cải tiến',
  fixed: 'Sửa lỗi',
  security: 'Bảo mật',
  performance: 'Hiệu năng',
  changed: 'Thay đổi',
  deprecated: 'Ngừng hỗ trợ',
  knownIssues: 'Vấn đề đã biết',
};

/** Keep a Changelog headings, in the same order as CATEGORIES. */
export const CHANGELOG_SECTIONS = Object.freeze([
  'Added',
  'Improved',
  'Fixed',
  'Security',
  'Performance',
  'Changed',
  'Deprecated',
  'Known Issues',
]);

const DATE_LABEL = {
  devStart: 'Bắt đầu phát triển',
  firstCommit: 'Commit đầu tiên',
  lastCommit: 'Commit cuối cùng',
  merged: 'Gộp vào nhánh (merge)',
  built: 'Dựng bộ cài (GitHub Actions)',
  released: 'Phát hành (GitHub Release)',
  tagged: 'Tạo tag',
};

/** Section IV groups the AI notes by these areas. */
const AI_AREAS = [
  ['teacher', 'AI Teacher và bảng dạy'],
  ['voice', 'Giọng nói'],
  ['gemma', 'Gemma chạy trên máy (local)'],
  ['api', 'AI qua API (Gemini, Claude, Groq)'],
];

const UNVERIFIED = 'Chưa xác minh được';
const NONE = '—';

// ── Dates: shown in Vietnam time (UTC+7); a bare date stays as written. ────────────────────────

const pad = (n) => String(n).padStart(2, '0');

function vnParts(iso) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return { y, m, d, time: null };
  }
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`not an ISO date: ${iso}`);
  const v = new Date(t + 7 * 3600 * 1000);
  return {
    y: String(v.getUTCFullYear()),
    m: pad(v.getUTCMonth() + 1),
    d: pad(v.getUTCDate()),
    time: `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`,
  };
}

/** `05/10/2026` (day in Vietnam). */
export function viDate(iso) {
  const p = vnParts(iso);
  return `${p.d}/${p.m}/${p.y}`;
}

/** `05/10/2026 10:07` (Vietnam time), or the bare date. */
export function viDateTime(iso) {
  const p = vnParts(iso);
  return p.time ? `${p.d}/${p.m}/${p.y} ${p.time}` : `${p.d}/${p.m}/${p.y}`;
}

/** `2026-10-05` (day in Vietnam), for Keep a Changelog headings. */
export function isoDay(iso) {
  const p = vnParts(iso);
  return `${p.y}-${p.m}-${p.d}`;
}

const ms = (iso) => Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00+07:00` : iso);

function compareVersions(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// ── A tiny document model, rendered to Markdown and to HTML (same content). ─────────────────
// Block: {t:'h1'|'h2'|'h3', text} | {t:'p', inl} | {t:'ul', items: inl[]} |
//        {t:'table', head: string[], rows: inl[][]}
// Inline (inl): array of string | {code} | {strong} | {link, text}

const code = (s) => ({ code: s });
const strong = (s) => ({ strong: s });
const link = (href, label) => ({ link: href, text: label });

const escMd = (s) => s.replace(/([\\`*_[\]<>|~])/g, '\\$1');
const escHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineMd(inl) {
  return inl
    .map((x) => {
      if (typeof x === 'string') return escMd(x);
      if ('code' in x) return `\`${x.code}\``;
      if ('strong' in x) return `**${escMd(x.strong)}**`;
      return `[${escMd(x.text)}](${x.link})`;
    })
    .join('');
}

function inlineHtml(inl) {
  return inl
    .map((x) => {
      if (typeof x === 'string') return escHtml(x);
      if ('code' in x) return `<code>${escHtml(x.code)}</code>`;
      if ('strong' in x) return `<strong>${escHtml(x.strong)}</strong>`;
      return `<a href="${escHtml(x.link)}">${escHtml(x.text)}</a>`;
    })
    .join('');
}

function toMarkdown(blocks) {
  const out = blocks.map((b) => {
    switch (b.t) {
      case 'h1':
        return `# ${b.text}`;
      case 'h2':
        return `## ${b.text}`;
      case 'h3':
        return `### ${b.text}`;
      case 'p':
        return inlineMd(b.inl);
      case 'ul':
        return b.items.map((i) => `- ${inlineMd(i)}`).join('\n');
      case 'table':
        return [
          `| ${b.head.map(escMd).join(' | ')} |`,
          `| ${b.head.map(() => '---').join(' | ')} |`,
          ...b.rows.map((r) => `| ${r.map(inlineMd).join(' | ')} |`),
        ].join('\n');
      default:
        throw new Error(`unknown block ${b.t}`);
    }
  });
  return `${out.join('\n\n')}\n`;
}

const HTML_STYLE = [
  'body { font-family: Arial, Helvetica, sans-serif; line-height: 1.45; max-width: 64rem; margin: 2rem auto; padding: 0 1rem; }',
  'table { border-collapse: collapse; margin: 0.5rem 0 1rem; }',
  'th, td { border: 1px solid #8a94a0; padding: 4px 8px; text-align: left; vertical-align: top; }',
  'code { font-family: Consolas, "Courier New", monospace; font-size: 0.92em; }',
].join('\n');

function toHtml(blocks, title) {
  const body = blocks.map((b) => {
    switch (b.t) {
      case 'h1':
      case 'h2':
      case 'h3':
        return `<${b.t}>${escHtml(b.text)}</${b.t}>`;
      case 'p':
        return `<p>${inlineHtml(b.inl)}</p>`;
      case 'ul':
        return `<ul>\n${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('\n')}\n</ul>`;
      case 'table':
        return [
          '<table>',
          `<thead><tr>${b.head.map((h) => `<th>${escHtml(h)}</th>`).join('')}</tr></thead>`,
          '<tbody>',
          ...b.rows.map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join('')}</tr>`),
          '</tbody>',
          '</table>',
        ].join('\n');
      default:
        throw new Error(`unknown block ${b.t}`);
    }
  });
  return [
    '<!doctype html>',
    '<html lang="vi">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escHtml(title)}</title>`,
    `<style>\n${HTML_STYLE}\n</style>`,
    '</head>',
    '<body>',
    ...body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

// ── Content ───────────────────────────────────────────────────────────────────────────────

const status = (v) => STATUS_LABEL[v.status];
const prLinks = (repo, prs) =>
  prs.length
    ? prs.flatMap((n, i) => [...(i ? [', '] : []), link(`${repo}/pull/${n}`, `#${n}`)])
    : [NONE];

/** Every note of a version with its category, in category order. */
const notesOf = (v) => CATEGORIES.flatMap((c) => v.publicNotes[c].map((n) => ({ ...n, c })));

function itemLine(v, n) {
  return [strong(v.version), ` (${status(v)}, ${CATEGORY_LABEL[n.c].toLowerCase()}): ${n.vi}`];
}

function historyBlocks(data, newestFirst) {
  const repo = data.repository;
  const oldestFirst = [...newestFirst].reverse();
  const newest = newestFirst[0];
  const blocks = [
    { t: 'h1', text: DOC_TITLE },
    {
      t: 'p',
      inl: [
        'Lịch sử phiên bản và ghi chú phát hành của SimLab (tên cũ: STEM Sim Lab). Tạo tự động từ ',
        code('release-notes/versions.json'),
        ' bằng ',
        code('npm run release-notes'),
        ` — đừng sửa tay. Bằng chứng được kiểm lần cuối ngày ${viDate(data.evidenceCheckedAt)}.`,
      ],
    },
  ];

  // I. Overview
  blocks.push({ t: 'h2', text: SECTIONS[0] });
  for (const para of data.overview) blocks.push({ t: 'p', inl: [para] });
  const byStatus = (s) => oldestFirst.filter((v) => v.status === s);
  const released = byStatus('released');
  const summary = [
    [
      `Số phiên bản ghi nhận: ${newestFirst.length} (${oldestFirst[0].version} → ${newest.version}).`,
    ],
    [
      `${STATUS_LABEL.released} trên GitHub: ${
        released.map((v) => `${v.version} (${viDate(v.dates.released)})`).join(', ') || NONE
      }.`,
    ],
  ];
  for (const s of ['merged-not-released', 'in-review', 'development', 'unverified']) {
    const list = byStatus(s);
    if (list.length)
      summary.push([`${STATUS_LABEL[s]}: ${list.map((v) => v.version).join(', ')}.`]);
  }
  summary.push([`Phiên bản mới nhất trong dữ liệu: ${newest.version} (${status(newest)}).`]);
  blocks.push({ t: 'ul', items: summary });

  // II. Timeline
  blocks.push(
    { t: 'h2', text: SECTIONS[1] },
    {
      t: 'p',
      inl: [
        'Cũ nhất ở trên. Cột "Ngày phát hành" chỉ ghi ngày khi có GitHub Release thật (published_at, giờ Việt Nam); bản chưa có Release ghi "Chưa phát hành".',
      ],
    },
    {
      t: 'table',
      head: ['Phiên bản', 'Trạng thái', 'Ngày phát hành', 'PR', 'Tag'],
      rows: oldestFirst.map((v) => [
        [v.version],
        [status(v)],
        [
          v.status !== 'released'
            ? 'Chưa phát hành'
            : v.dates.released
              ? `${viDate(v.dates.released)} (đã xác minh)`
              : UNVERIFIED,
        ],
        prLinks(repo, v.refs.prs),
        v.refs.tag && v.refs.releaseUrl ? [link(v.refs.releaseUrl, v.refs.tag)] : [NONE],
      ]),
    },
    { t: 'h3', text: 'Các mốc phát triển' },
    {
      t: 'table',
      head: ['Thời điểm (giờ VN)', 'Mốc', 'Bằng chứng'],
      rows: [...data.milestones]
        .sort((a, b) => ms(a.date) - ms(b.date))
        .map((m) => [[viDateTime(m.date)], [m.text], [m.evidence]]),
    },
  );

  // III. Each version
  blocks.push({ t: 'h2', text: SECTIONS[2] });
  for (const v of newestFirst) {
    blocks.push(
      { t: 'h3', text: `${v.version} — ${status(v)}` },
      { t: 'p', inl: [v.publicNotes.summary.vi] },
      {
        t: 'ul',
        items: [
          [`Trạng thái: ${status(v)}.`],
          [`Kênh phân phối: ${CHANNEL_LABEL[v.channel]}.`],
          ...(v.statusNote ? [[`Ghi chú trạng thái: ${v.statusNote}`]] : []),
          [
            v.notesReady
              ? 'Ghi chú công khai: đã duyệt để công bố (hiện trong hộp "Có gì mới").'
              : 'Ghi chú công khai: bản nháp, chưa duyệt để công bố (không hiện trong hộp "Có gì mới").',
          ],
        ],
      },
      {
        t: 'table',
        head: ['Mốc', 'Thời điểm (giờ VN)', 'Giá trị gốc'],
        rows: Object.keys(DATE_LABEL).map((k) => {
          const d = v.dates[k];
          return [[DATE_LABEL[k]], [d ? viDateTime(d) : UNVERIFIED], [d ? code(d) : NONE]];
        }),
      },
    );
    for (const c of CATEGORIES) {
      const list = v.publicNotes[c];
      if (!list.length) continue;
      blocks.push(
        { t: 'p', inl: [strong(CATEGORY_LABEL[c])] },
        { t: 'ul', items: list.map((n) => [n.vi]) },
      );
    }
    if (v.learnerHighlights.length) {
      blocks.push(
        { t: 'p', inl: [strong('Điểm nổi bật trong app')] },
        { t: 'ul', items: v.learnerHighlights.map((h) => [h.vi]) },
      );
    }
    blocks.push(
      { t: 'p', inl: [strong('Bằng chứng')] },
      { t: 'ul', items: v.evidence.map((e) => [e]) },
    );
  }

  // IV. AI Teacher, board, voice, Gemma + API
  blocks.push(
    { t: 'h2', text: SECTIONS[3] },
    {
      t: 'p',
      inl: [
        'Gom từ các ghi chú có area teacher, voice, gemma và api, cũ nhất ở trên; trong ngoặc là trạng thái của phiên bản và loại thay đổi.',
      ],
    },
  );
  for (const [area, title] of AI_AREAS) {
    const items = oldestFirst.flatMap((v) =>
      notesOf(v)
        .filter((n) => n.area === area)
        .map((n) => itemLine(v, n)),
    );
    blocks.push({ t: 'h3', text: title });
    blocks.push(items.length ? { t: 'ul', items } : { t: 'p', inl: ['Chưa có mục nào.'] });
  }

  // V. 3D biology
  blocks.push({ t: 'h2', text: SECTIONS[4] });
  const bio = oldestFirst.flatMap((v) =>
    notesOf(v)
      .filter((n) => n.area === 'bio3d')
      .map((n) => ({ v, n })),
  );
  if (bio.length) {
    const first = bio[0].v;
    blocks.push(
      {
        t: 'p',
        inl: [
          `Mô phỏng 3D Sinh học xuất hiện lần đầu ở phiên bản ${first.version} (${status(first)}); các phiên bản trước không có ghi chú nào về mô phỏng 3D Sinh học.`,
        ],
      },
      { t: 'ul', items: bio.map(({ v, n }) => itemLine(v, n)) },
    );
    const tests = oldestFirst.flatMap((v) =>
      v.tests.filter((s) => /3D|nguyên phân/i.test(s)).map((s) => [strong(v.version), `: ${s}`]),
    );
    if (tests.length) {
      blocks.push({ t: 'p', inl: [strong('Kiểm thử liên quan')] }, { t: 'ul', items: tests });
    }
  } else {
    blocks.push({ t: 'p', inl: ['Chưa có mục nào.'] });
  }

  // VI. Security, performance, tests
  blocks.push({ t: 'h2', text: SECTIONS[5] });
  for (const [c, title] of [
    ['security', 'Bảo mật'],
    ['performance', 'Hiệu năng'],
  ]) {
    const items = oldestFirst.flatMap((v) =>
      v.publicNotes[c].map((n) => [strong(v.version), ` (${status(v)}): ${n.vi}`]),
    );
    blocks.push({ t: 'h3', text: title });
    blocks.push(items.length ? { t: 'ul', items } : { t: 'p', inl: ['Chưa có mục nào.'] });
  }
  blocks.push({ t: 'h3', text: 'Kết quả kiểm thử' });
  for (const v of oldestFirst) {
    blocks.push({ t: 'p', inl: [strong(v.version), ` (${status(v)})`] });
    blocks.push(
      v.tests.length
        ? { t: 'ul', items: v.tests.map((s) => [s]) }
        : { t: 'p', inl: ['Chưa ghi kết quả kiểm thử.'] },
    );
  }

  // VII. Not finished
  blocks.push(
    { t: 'h2', text: SECTIONS[6] },
    { t: 'h3', text: `Vấn đề đã biết của bản mới nhất (${newest.version}, ${status(newest)})` },
    newest.publicNotes.knownIssues.length
      ? { t: 'ul', items: newest.publicNotes.knownIssues.map((n) => [n.vi]) }
      : { t: 'p', inl: ['Chưa có mục nào.'] },
    { t: 'h3', text: 'Phiên bản chưa phát hành hoặc chưa xác minh' },
    {
      t: 'ul',
      items: newestFirst
        .filter((v) => v.status !== 'released')
        .map((v) => [strong(v.version), ` (${status(v)}): ${v.statusNote ?? UNVERIFIED}`]),
    },
    { t: 'h3', text: 'Điểm chưa xác minh được' },
    { t: 'ul', items: data.openQuestions.map((q) => [q]) },
  );

  // VIII. References
  blocks.push(
    { t: 'h2', text: SECTIONS[7] },
    {
      t: 'p',
      inl: [
        'Kho mã: ',
        link(repo, repo),
        '. Commit chỉ có trên nhánh local (ghi trong phần bằng chứng) không mở được trên GitHub.',
      ],
    },
    {
      t: 'table',
      head: [
        'Phiên bản',
        'Tag',
        'Commit của tag',
        'GitHub Release',
        'PR',
        'Commit (đầu → cuối)',
        'Nhánh',
      ],
      rows: newestFirst.map((v) => [
        [v.version],
        v.refs.tag ? [code(v.refs.tag)] : [NONE],
        v.refs.tagSha ? [code(v.refs.tagSha)] : [NONE],
        v.refs.releaseUrl
          ? [link(v.refs.releaseUrl, `Release ${v.refs.tag ?? v.version}`)]
          : [NONE],
        prLinks(repo, v.refs.prs),
        v.refs.commits.length
          ? v.refs.commits.flatMap((c, i) => [...(i ? [' → '] : []), code(c)])
          : [NONE],
        v.refs.branches.length
          ? v.refs.branches.flatMap((b, i) => [...(i ? [', '] : []), code(b)])
          : [NONE],
      ]),
    },
  );
  return blocks;
}

function changelog(data, newestFirst) {
  const repo = data.repository;
  const lines = [
    '# Changelog',
    '',
    'Mọi thay đổi đáng chú ý của SimLab (tên cũ: STEM Sim Lab), bản mới nhất ở trên. Định dạng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), số phiên bản dạng `x.y.z`. Tệp này được tạo từ `release-notes/versions.json` bằng `npm run release-notes` — đừng sửa tay. Lịch sử đầy đủ kèm bằng chứng: [VERSION\\_HISTORY.md](VERSION_HISTORY.md).',
    '',
  ];
  const refs = [];
  for (const v of newestFirst) {
    if (v.status === 'released' && v.dates.released) {
      lines.push(`## [${v.version}] - ${isoDay(v.dates.released)}`);
      if (v.refs.releaseUrl) refs.push(`[${v.version}]: ${v.refs.releaseUrl}`);
    } else if (v.status === 'in-review') {
      lines.push(`## [Unreleased] - ${v.version} (${status(v)})`);
      if (v.refs.prs.length) refs.push(`[Unreleased]: ${repo}/pull/${v.refs.prs[0]}`);
    } else {
      lines.push(`## ${v.version} - ${status(v)}`);
    }
    lines.push('');
    if (v.statusNote) lines.push(`_${escMd(v.statusNote)}_`, '');
    if (!v.notesReady) lines.push('_Ghi chú này là bản nháp, chưa được duyệt để công bố._', '');
    lines.push(escMd(v.publicNotes.summary.vi), '');
    CATEGORIES.forEach((c, i) => {
      const list = v.publicNotes[c];
      if (!list.length) return;
      lines.push(`### ${CHANGELOG_SECTIONS[i]}`, '', ...list.map((n) => `- ${escMd(n.vi)}`), '');
    });
  }
  if (refs.length) lines.push(...refs, '');
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

/**
 * The three documents for `data` (the parsed versions.json), keyed by their path in the repo.
 * Pure: the same data always gives the same text.
 */
export function render(data) {
  const newestFirst = [...data.versions].sort((a, b) => compareVersions(b.version, a.version));
  const blocks = historyBlocks(data, newestFirst);
  return {
    [OUTPUT_FILES.history]: toMarkdown(blocks),
    [OUTPUT_FILES.changelog]: changelog(data, newestFirst),
    [OUTPUT_FILES.html]: toHtml(blocks, DOC_TITLE),
  };
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const data = JSON.parse(readFileSync(resolve(root, 'release-notes/versions.json'), 'utf8'));
  for (const [path, content] of Object.entries(render(data))) {
    writeFileSync(resolve(root, path), content);
    console.log(`wrote ${path}`);
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
const self = fileURLToPath(import.meta.url);
if (
  process.platform === 'win32' ? invoked.toLowerCase() === self.toLowerCase() : invoked === self
) {
  main();
}
