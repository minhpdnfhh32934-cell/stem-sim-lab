# Phase 9 report — topics in the main menu

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

## 1. Starting state

- **HEAD:** `32bb456` (Phase 6G). One worktree, no stash, no remote.
- **Uncommitted before this phase, kept untouched:** Phase 8 (`topics.json`, the topic schema and
  checks, its tests and docs) and the Vietnamese Nhặt / Thả labels in `strings.json`.

## 2. Baseline

`npm run check` PASS 338/338 (18 s) and `npm run build` PASS (4 s), run now. `npm run test:e2e`
not run again: it passed 25/25 at the end of Phase 8 on this very tree (`src/` unchanged since).

## 3. Entry point

Audit: there is no experiment selection — players walk to stations; the desk screen and monitor
are canvases already full; the HUD is about the station at hand. The main menu already has a
collapsible section (Settings), native `<details>`, usable with the keyboard, re-rendered on a
language change. So: one more section beside it, **Experiments by topic** (closed by default) —
no new key, no new screen, nothing in the world changed.

Shown for each topic: its name, then each experiment with the world scene and room of its
stations (the room only when its name differs: "Projectile motion — Physics Laboratory ·
Projectile range"), or "no station yet" when it has none. Everything comes from
`topicCatalog(content)` (`src/game/catalog.ts`): stations are the placements that name the
experiment as `experimentId`.

Also: the menu now scrolls in a short window instead of cutting off its top (`safe center`,
`overflow-y: auto`), since both sections open make it taller.

## 4. Files changed by this phase

New: `src/game/catalog.ts`, `src/game/catalog.test.ts`, `e2e/topics.spec.ts`,
`docs/phase-9-report.md`. Changed: `src/platform/ui/MainMenu.ts` (the section),
`src/platform/ui/styles.css`, `src/content/strings.json` (three keys added: `menu.topics`,
`menu.playedAt`, `menu.noStation`), `docs/data-model.md`, `README.md`.

## 5. Verified in English and Vietnamese

`e2e/topics.spec.ts`, through the real menu: as many topics and lines as `topics.json` lists;
"Kinematics" / "Động học" and "Oscillations and waves" / "Dao động và sóng"; "Free fall — Physics
Laboratory" / "Rơi tự do — Phòng thí nghiệm Vật lý", and so on; the language switched through
Settings; a 520 px tall window with both sections open; New game still starts; no console error.
Unit: `catalog.test.ts` — the shipped catalog with each station's scene and room; an experiment
whose station room is gone gets no place (not playable).

## 6. Tests and build

| Check                     | Result                                                      | Duration |
| ------------------------- | ----------------------------------------------------------- | -------- |
| `npm run check`           | **PASS**: 340/340 unit tests (338 + 2), 31 files            | 18 s     |
| `npm run build`           | **PASS**                                                    | 4 s      |
| `npm run test:e2e`        | **PASS**: 26/26 (25 + `topics.spec.ts`), first run          | 363 s    |
| `npm run bench`           | **NOT RUN**: nothing in rendering or the frame loop changed | —        |
| bench `gpu`, `gpu-native` | **NOT RUN**: visible windows                                | —        |

No existing test or assertion changed; no room, placement or collider changed.

## 7. Limitations

- Discovery only: the list does not take the player there, and is in the main menu only.
- No subject heading: every topic is physics so far, and subjects have no display names yet.
- A station is found by its `experimentId` parameter, which every apparatus behaviour uses today.
