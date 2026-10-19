# release-prep — 0.6.0 release candidate (Science Studio on top of G8)

- **Goal:** prepare an official GitHub Release of 0.6.0 (publishing is done later by the owner
  through the Release workflow from `main`): versions, release notes, user guide, progress row,
  full checks, installers, a read-only native check. No commit, push, tag, `gh release` or
  `gh workflow`.
- **Date/time:** 2026-10-19, 13:30–13:57 (+07:00, machine clock).
- **Status:** PASS
- **Branch / base:** `feat/science-studio` in `D:\Projects\simlab-studio` (HEAD `abc9e0c` = PR #21
  head; S1–S5 staged, uncommitted).

## Files

- `release-notes/versions.json` (0.6.0 entry, one open question, one milestone) and the generated
  `docs/VERSION_HISTORY.md`, `docs/CHANGELOG.md`, `release-notes/google-docs.html`
  (`npm run release-notes`).
- `docs/USER_GUIDE.md`: quick start lists three entries; new section "Science Studio".
- `docs/PROGRESS.md`: row `0.6.0-studio`.
- This file.

## Key decisions

- Versions were already 0.6.0 in `package.json`, `tauri.conf.json`, `Cargo.toml` and the
  `stem-sim-lab` entry of `Cargo.lock`; nothing bumped (`tests/versions.test.ts` passes).
- `notesReady: true`. `status` stays `in-review`: per `release-notes/README.md` that is the status
  while PRs are open (#20, #21; Science Studio has no PR yet); `merged-not-released` only after the
  merge, `released` only after a real GitHub Release. `statusNote` lists what the owner must do
  before running Release (merge to `main`, the owner-only release settings in `docs/RELEASE.md`,
  do not tick "Bắt buộc cập nhật" because 0.6.0 raises the native version).
- Public notes: new summary; three "added" items for Science Studio (studios, Soạn bài, report and
  "Hỏi thầy"); known issues: Store copy arrives later, Studio/chemistry/biology text pending
  teacher review, one lesson per subject, "Hỏi thầy" also only tested against fakes. The internal
  item "owner must still enable release protections" moved from public known issues to
  `statusNote` (it is a pre-release task, not something learners can act on). "Chưa dựng bộ cài
  chính thức" was replaced (it would be false once the Release workflow publishes).
- Learner highlights (5): Science Studio + Soạn bài, circle to ask, whole board, local AI runtimes,
  honest AI answers. Area `ui` for Studio (no studio area in the schema; not added).
- `docs/DATA_REVIEW.md`: checked, no change needed — items 20–23 cover all new science text of the
  three built-in scenarios, the bench/biology Science Cards, the `studio.chem.*`/`studio.bio.*`
  strings and authored scenarios. `src/chemistry/reaction/card.ts` and `src/learn/poeLabels.ts`
  only moved existing text.
- E2E reused the dev server already on port 1420 (PID 3868, started 13:22 by the S3b step with
  the project config + `fs.allow` for the junctioned `node_modules`; not started or stopped here).
  The storage state's origin is pinned to port 1420, so another port was not an option.

## Commands run (real results, summary lines only)

| Command                                                                                  | Result                                                                                                                                                     |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run release-notes`                                                                  | wrote VERSION_HISTORY.md, CHANGELOG.md, google-docs.html                                                                                                   |
| `npx vitest run tests/release-notes.test.ts tests/versions.test.ts src/app/whatsnew`     | 4 files, 50/50                                                                                                                                             |
| `npm run format:check` / `lint` / `typecheck`                                            | all exit 0                                                                                                                                                 |
| `npx vitest run`                                                                         | 208 files, 3423/3423, 62 s                                                                                                                                 |
| `npx playwright test` (chromium, chromium-3d, chromium-3d-perf)                          | 85 passed (4.1 min)                                                                                                                                        |
| `cargo fmt --check`; `cargo clippy --all-targets -- -D warnings`; `cargo test`           | exit 0; exit 0; 214 passed, 0 failed                                                                                                                       |
| `npm audit --omit=dev`                                                                   | found 0 vulnerabilities                                                                                                                                    |
| `npm run build`                                                                          | exit 0; warning: `index` chunk 809.81 kB > 700 kB                                                                                                          |
| `npx vite build` of `git archive abc9e0c` (scratch copy)                                 | same warning already: `index` 801.90 kB (pre-existing; Studio adds about 8 kB)                                                                             |
| `npm run tauri build` (`CARGO_TARGET_DIR=C:/Users/Lenovo/stem-sim-lab/src-tauri/target`) | release 1 m 58 s; `SimLab_0.6.0_x64-setup.exe` 11.44 MiB (sha256 `3edcdd84ac58fa18…`), `SimLab_0.6.0_x64_en-US.msi` 12.21 MiB (sha256 `c871b24fe8d980ab…`) |
| native check (below)                                                                     | 8/8 steps pass, 0 page errors, 0 console errors                                                                                                            |

## Native check (read-only)

- `tasklist`: no SimLab process before; ports 9333 and 11434 free.
- Started `target\release\stem-sim-lab.exe` (13:54 build) with
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333` and
  `WEBVIEW2_USER_DATA_FOLDER=<scratchpad>` (own profile: the user's localStorage untouched);
  Playwright `connectOverCDP`. Pre-answers as in `tests/e2e/storage-state.json`.
- `app_info`: SimLab 0.6.0, `debugBuild: false`, edition main, channel github.
- Science Studio → Sinh học → Nguyên phân 3D lesson → Thí nghiệm: the 3D view rendered (`.m3d
canvas`, screenshot shows the cell). Hóa học: "Giá hóa chất" bench shown. Vật lí: prediction,
  "Chạy thí nghiệm", table "Số đo do mô phỏng tính". Soạn bài: "Tạo bài mới" shown.
- Board lesson: AI Teacher → "Giảng trên bảng" with a **fake** Ollama on 127.0.0.1:11434 (Node
  server with a canned Markdown lesson, as `tests/e2e/local-ai.spec.ts`; no model ran, nothing
  went online; requests: `GET /api/version`, `POST /api/show`, `POST /api/chat`). The formula
  `s = ½gt²` rendered with KaTeX: 4/4 `.vlist` spans have their inline `top` applied (CSP keeps
  inline styles), screenshot checked.
- Closed only the started process tree (`taskkill /PID <pid> /T /F`); `tasklist` afterwards: none.
  Files in `%APPDATA%\vn.stemsimlab.desktop` (`ai-usage.json`, `history.sqlite`, `safety.json`,
  `gpu.json`) kept their earlier modification times.

## Next steps and limits

- The owner: read the 0.6.0 notes once more, merge PR #20/#21 and the Science Studio work into
  `main`, check the release settings in `docs/RELEASE.md`, then run Release with publish = true and
  "Bắt buộc cập nhật" unticked; after publishing, set `status: "released"` with the real
  `published_at`, tag and link.
- Not verified: real API keys, real local runtimes, the circled-picture path in WebView2, the
  Studio "Hỏi thầy" with a real AI; installers were built but not installed or run.
- The `index` chunk size warning predates this branch.
