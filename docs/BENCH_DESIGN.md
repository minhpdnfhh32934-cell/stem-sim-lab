# Bàn thí nghiệm ("The Bench"): buildable design for SimLab 0.8.1

> Committed copy of the design the owner chose on 2026-11-02 (plan #54, issues #113 onward). Owner
> decisions and what changed since are in `CLAUDE.md` → "Giao diện Bàn thí nghiệm (0.8.1)". Token
> values here follow `src/app/theme/tokens.css`; where they differ, the stylesheet and its tests
> (`tokens.test.ts`) win. Changed after the B0 review (PR #114): the light data colours (§4), the
> light 3D terrain, the codon marks and the dark water line; the stored tray flag is `trayFolded`.

## 1. Pitch

SimLab works like a real lab bench. The simulation is one large ceramic tile, 998×656 px by default, 1238×656 with the tray folded, and 1366×704 in presentation mode. A dark "epoxy" frame holds the tile. The bottom edge of the frame is fixed and carries the run controls and the confidence chip, which is always visible. A notebook on the left holds what you read and record. A tray on the right holds what you change, with the Science summary pinned at its top.

## 2. What was grafted, and from where

The Bench keeps its own identity: the frame, the fixed bench edge, the Play button that changes role, the notebook and the tray. Ideas the judges named from the other concepts are folded in:

| Graft                                                                                                                                                  | From               | Fixes this judge complaint about the Bench            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------- |
| Science summary pinned at the top of the tray; it can never collapse                                                                                   | studio             | The Science Card used to live only in a closed drawer |
| The intervention stays on screen until "Đặt lại": the chip gets a second line, the HUD chip stays, runs recorded afterwards are tagged "sau can thiệp" | journey            | The intervention used to be a one-time HUD chip       |
| On a topic's first visit, the notebook opens on Thử thách. While the POE is unanswered, a HUD chip "Dự đoán trước" sits on the stage                   | judge 1            | Nobody could find POE or challenges                   |
| Origin chips in three inks: engine (mono, calculator icon, "SimLab tính"), learner (blue pen, "Bạn ghi"), AI (violet, "AI hỗ trợ")                     | notebook + journey | Provenance                                            |
| Colour-neutral stage selection (`--stage-accent`), kept apart from the chrome accent and every data hue                                                | journey            |                                                       |
| `MainActionSlot` store with a priority order, plus an E2E guard counting filled buttons (exactly 1 per state, 0 on the 18+ gate)                       | studio + journey   |                                                       |
| Disabled main action = neutral grey plus a blocker sentence, never a pale accent                                                                       | journey (UI-10)    |                                                       |
| Every data series = hue + dash + marker + run letter. A pinned run is marked "đã cũ" when inputs change after it                                       | studio             |                                                       |
| Single-letter shortcuts never fire in text fields or during IME composition (safe for Telex/VNI). F6 cycles the panes                                  | studio             |                                                       |
| Provenance stamps: dashed border, cannot be dismissed. Hatched scrubber segments where mechanism frames are interpolated                               | notebook           |                                                       |
| Errors stay inside the failing region ("Các phần khác vẫn dùng bình thường")                                                                           | notebook           |                                                       |
| The Hỏi AI drawer previews exactly what screen context it will send                                                                                    | journey            |                                                       |
| Engine block "RK4 · Δt 1 ms" as the chip's second line (Advanced)                                                                                      | studio             |                                                       |

**Considered and left out:**

- Lesson-first default: PhET's data shows exploratory use falling from 85 % to 9 % under heavy guidance.
- Scrolling cells: Zhi et al. found slides beat scrolling.
- Reactive-sentence templates: they would need vi and en grammar for every scene.
- IDE tabs, side-by-side runs and docking: they break the `sim` singleton.
- "Chặng làm quen": it churns `project.spec`. The existing `.tour` is re-pointed instead.

## 3. Information architecture

**Rooms**

1. **Cửa vào (Launch).** Two doors: Virtual Lab and AI Teacher.
2. **Kệ bài (Library = lab home).** Level → Subject → Topic → Lesson.
3. **Bàn thí nghiệm (Bench).** One frame for every topic in every subject. A guided lesson (Science Studio) is the same bench with a lesson panel docked on the left.
4. **AI Teacher room.** The whiteboard is the stage; the conversation column sits on the right.

**Overlays**

- Ctrl+K palette.
- "Đề bài" problem sheet (with "Tôi hiểu đề như sau").
- Tệp menu, history sheet, Settings sheet.
- Ctrl+/ shortcut sheet (decided 02/11; after the frame).

**Science Studio** keeps its name. It becomes:

- the Library filter "Có hướng dẫn";
- the "Bài có hướng dẫn" section in each tray;
- palette entries.

The `'studio'` screen id and `openStudio()` stay for older callers and open the Library with that filter set.

**Getting around**

- Forward: Launch → door → Library → card → Bench.
- Back: the header breadcrumb "Phòng thí nghiệm › Vật lí › Động học › Ném xiên". Every crumb is a 40 px button; the subject crumb opens the Library filtered to that subject. The SimLab mark returns to Launch.
- **Esc** closes only the top overlay. Exception, kept because `teacher.spec` pins it: on the AI Teacher room with nothing open, Esc goes back.
- From the bench to a lesson: the tray's "Bài có hướng dẫn" or Ctrl+K. A lesson ends with "Thử tự do trong Phòng thí nghiệm", which opens the same topic carrying the lesson's final inputs through `sim.applyParams`.
- From the bench to AI Teacher: Hỏi AI tab → "Mở rộng thành AI Teacher" carries the conversation.

**Persistence**

- Extend the existing `stemsim.layout` store instead of adding a key. The new fields are extra fields of version 1, filled in by `merge`; the version is never bumped (an older copy of the app would drop every saved size). New fields: `trayFolded` (the tray folded to its spine; named so an older test about saved `*Open` flags keeps its meaning), `trayWidth` (256–420, default 304), `notebookWidth` (320–520, default 352), `notebookTabBySubject`. The existing limits, NaN handling, `resetLayout` and the presentation-never-persisted rules and their tests extend to these fields.
- The first-visit Thử thách rule reads `progressStore` (is the POE answered for this topic?). No new key.
- Library filters stay in `stemsim.profile`; `lastTopic` feeds "Tiếp tục".
- Module inputs keep going through `ModuleView.state` and `.stemsim` files.

**Landmark contract** (one `<main>` per page; this fixes today's nested main on the Teacher page)

| Landmark                                                               | Bench element                                                                                                          |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| complementary "Thư viện chủ đề"                                        | Library filter column                                                                                                  |
| region "Khung mô phỏng"                                                | stage                                                                                                                  |
| complementary "Điều chỉnh (bảng thuộc tính)"                           | tray. The visible title is "Điều chỉnh"; Playwright's substring match on "Bảng thuộc tính" still finds it              |
| region "Bảng đồ thị và lời giải"                                       | notebook rail + drawer                                                                                                 |
| group "Điều khiển thời gian"                                           | bench-edge driver when it drives time. Other drivers get their own name ("Điều khiển các bước", "Điều khiển nhỏ giọt") |
| toolbar "Công cụ mô phỏng"                                             | stage mode cluster at top-left                                                                                         |
| region "Trò chuyện với AI Teacher", region "Bảng trắng của AI Teacher" | unchanged                                                                                                              |

## 4. Tokens

**Scope.** Tokens are defined under `:root[data-shell="bench"]`, light and dark, with the dark set guarded as today by `[data-theme]` / prefers-color-scheme and `theme-boot.js`. Where the meaning matches, they **override the existing names**: `--text*`, `--border`, `--accent*`, `--danger`, `--warning`, `--conf-*`, `--pending*`, `--subject-*`, `--bg-stage`, `--chart-*`. That way every module view picks up the bench look with no edits. New names are only those with no equivalent today.

**Old → new mapping:**

- `--bg-app` = bg
- `--bg-panel` = surface-1
- `--bg-panel-2` and `--bg-sunken` and `--bg-hover` = surface-2
- `--bg-active` = surface-3
- `--border-strong` → `--border-input`
- `--glass-*` become solid surface-1

**Contrast.** All ratios are WCAG 2.x; `src/app/theme/tokens.test.ts` checks them (bench contrast table). Floors: text ≥ 4.5, UI ≥ 3. Where several surfaces are listed, the lowest value is the worst case.

### Chrome: the frame (dark in both themes)

| Token                                             | Light   | Dark    | Contrast, light / dark               |
| ------------------------------------------------- | ------- | ------- | ------------------------------------ |
| `--frame`                                         | #1C2226 | #0B0E10 | —                                    |
| `--frame-raised` (selected rail tab, hover)       | #2A3237 | #1B2125 | —                                    |
| `--frame-line` (UI borders on frame)              | #7C888F | #6E7A81 | 4.42 frame, 3.59 raised / 4.39, 3.69 |
| `--on-frame`                                      | #EEF2F3 | #E9EEF0 | 14.26 / 11.57 · 16.55 / 13.91        |
| `--on-frame-muted`                                | #AAB5BA | #A2ADB3 | 7.68 / 6.23 · 8.45 / 7.10            |
| `--play` (D0 fill and selected-tab bar, on frame) | #3DBFB2 | #45C7BA | 7.12 frame, 5.77 raised / 9.34, 7.85 |
| `--on-play`                                       | #0A1F1D | #06201E | 7.58 / 8.22                          |
| `--focus-frame` (2 px ring, 2 px offset)          | #F5C84C | #F5C84C | 10.14 / 8.23 · 12.22 / 10.26         |

### Paper: Library, tray, notebook, sheets

| Token                                                    | Light                      | Dark                         | Contrast, light / dark                                                       |
| -------------------------------------------------------- | -------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| `--bg` (paper)                                           | #F6F4EF                    | #15191C                      | —                                                                            |
| `--surface-1` (cards, inputs, sheets, graph plots)       | #FFFFFF                    | #1E2327                      | —                                                                            |
| `--surface-2` (sunken, hover)                            | #EEEBE4                    | #252B30                      | —                                                                            |
| `--surface-3` (active, selected)                         | #E4E0D7                    | #2D3439                      | —                                                                            |
| `--border` (decorative only)                             | #DAD5CB                    | #2F363B                      | —                                                                            |
| `--border-input`                                         | #7A746A                    | #7A858B                      | bg 4.21 · s1 4.63 · s2 3.89 · s3 3.52 / 4.68 · 4.19 · 3.79 · 3.34            |
| `--text`                                                 | #1D2124                    | #E6EAEC                      | bg 14.75 · s1 16.21 · s3 12.31 · stage 15.78 / 14.60 · 13.09 · 10.44 · 12.63 |
| `--text-muted`                                           | #555B61                    | #A5AEB4                      | bg 6.25 · s3 5.22 · stage 6.69 / 7.84 · 5.60 · 6.78                          |
| `--text-faint`                                           | #5C6268                    | #949DA3                      | bg 5.62 · s3 4.69 / 6.41 · 4.58                                              |
| `--accent` (links, tonal outlines, filled paper buttons) | #0A6B66                    | #45C7BA                      | bg 5.78 · s2 5.33 · stage 6.18 · soft 5.32 / 8.53 · 6.91 · 7.38 · 6.41       |
| `--accent-hover`                                         | #085752                    | #6AD6CB                      | on-accent on it 8.42 / 9.81                                                  |
| `--accent-soft`                                          | #DCEFEC                    | #123532                      | —                                                                            |
| `--on-accent`                                            | #FFFFFF                    | #06201E                      | 6.35 / 8.22                                                                  |
| `--focus` (paper and stage)                              | #0A6B66                    | #F5C84C                      | worst s3 4.82 / worst s3 7.97 · stage 9.65                                   |
| `--danger`                                               | #B3261E (white on it 6.54) | #FF8A80 (#2A0A07 on it 8.03) | bg 5.95 / 7.75                                                               |
| `--warning` on `--warning-soft`                          | #6E4A00 on #FFF1CC         | #F2CF6B on #3A2C07           | 7.08 / 9.02                                                                  |

### Status and provenance

Confidence chips are filled soft chips. Origin chips are outline-only in the ink colour. The fill-versus-outline difference, plus icon and word, keeps "Định tính" and "Bạn ghi" apart even though both are blue.

| Token (text on soft)                                     | Light              | Dark               | Contrast, light / dark (on bg) |
| -------------------------------------------------------- | ------------------ | ------------------ | ------------------------------ |
| `--conf-exact` "Chính xác" (CircleCheck)                 | #11592B on #DCF1E2 | #8FE0A8 on #12301D | 7.12 (7.68) / 9.14 (11.28)     |
| `--conf-approx` "Gần đúng" (CircleAlert)                 | #694700 on #FBEDC4 | #F2CF6B on #3A2C07 | 7.20 (7.64) / 9.02 (11.71)     |
| `--conf-qual` "Định tính" (Info)                         | #1B4C9C on #DCE8FA | #A3C4FF on #142A4D | 6.63 (7.46) / 8.10 (10.02)     |
| `--pending` "chờ giáo viên duyệt" (Clock, dashed border) | #4A4F6A on #ECEDF3 | #B3B7D3 on #22243A | 6.87 (7.30) / 7.70 (8.95)      |
| `--ink-ai` "AI hỗ trợ" (Sparkles)                        | #5E3596 on #EFE7F9 | #CFB6F6 on #2A1F3D | 7.20 (7.88) / 8.57 (9.83)      |
| `--ink-learner` "Bạn ghi" (PenLine)                      | #2A4C9C on #E6ECF8 | #93B1FF on #1C2846 | 6.78 (7.31) / 6.92 (8.40)      |
| Engine ink "SimLab tính" (Calculator)                    | `--text` in mono   | same               | as `--text`                    |

### Subjects (chrome only: Library dots and rules, breadcrumb dot; never on a stage)

| Token                 | Light   | Dark    | Contrast on bg / s1       |
| --------------------- | ------- | ------- | ------------------------- |
| `--subject-physics`   | #4044C2 | #A3A6FF | 6.77 / 7.44 · 7.96 / 7.14 |
| `--subject-chemistry` | #AE3A16 | #FF9E7D | 5.59 / 6.15 · 8.79 / 7.88 |
| `--subject-biology`   | #2B7530 | #84D488 | 5.18 / 5.69 · 9.90 / 8.87 |

### Stage (kept separate from the chrome)

| Token                                                                                     | Light                            | Dark                        | Contrast, light / dark                                                                                                                |
| ----------------------------------------------------------------------------------------- | -------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `--bg-stage`                                                                              | #FCFCFA                          | #20262B                     | —                                                                                                                                     |
| `--stage-grid` (decorative)                                                               | #E6E6E0                          | #2C3338                     | text on grid 12.94 / 10.59                                                                                                            |
| `--stage-accent` (selection ring, cursor, scrubber marker on the stage; never `--accent`) | ring #1D2124 + 2 px halo #FFFFFF | ring #FFFFFF + halo #0B0E10 | ring on stage 15.78 / 15.29. **Not in B0:** the token keeps today's value (#2F62D8 / #7AA2FF); the ring + halo needs drawing code, B2 |
| `--stage-tool` (ruler, protractor, stopwatch ink)                                         | #3A4247                          | #C9D1D5                     | 9.97 / 9.88                                                                                                                           |
| 3D structure neutral (deliberately quiet; never carries data alone)                       | #9AA3A8                          | #5E686E                     | 2.50 / 2.68                                                                                                                           |

**Data colours.** Keep the Okabe–Ito `--chart-1…7` names, hues and order (52 source files and the 3D ΔE tests depend on them). In the light bench every colour must be ≥ 3 : 1 on stage and paper, which leaves only L ≤ 0.65. The first re-step (same hue and chroma, all lowered to L ≈ 0.62) put the colours too close: closest pair ΔE_OK 0.065 normal, 0.006 deutan, 0.017 protan. The B0 review asked for the lightness to be spread out instead. Values found by a search over L (hue kept, chroma kept where sRGB allows, L ≥ 0.40, ΔE_OK ≥ 0.15 from the text colour, chart-1 and chart-4 ≥ 2.5 : 1 from the 3D pick glow):

| Token       | Light today | Bench light | Contrast on stage / paper / white |
| ----------- | ----------- | ----------- | --------------------------------- |
| `--chart-1` | #0072B2     | #054C78     | 8.84 / 8.27 / 9.09                |
| `--chart-2` | #E69F00     | #614102     | 9.02 / 8.43 / 9.27                |
| `--chart-3` | #009E73     | #0C7A59     | 5.18 / 4.84 / 5.32                |
| `--chart-4` | #D55E00     | #AF4C03     | 5.30 / 4.95 / 5.44                |
| `--chart-5` | #CC79A7     | #BB6997     | 3.66 / 3.42 / 3.76                |
| `--chart-6` | #56B4E9     | #3495C9     | 3.25 / 3.04 / 3.34                |
| `--chart-7` | #F0E442     | #968D0F     | 3.34 / 3.13 / 3.43                |

Closest pair of data colours, ΔE_OK (Machado et al. 2009, severity 1.0, on linear RGB):

| Palette                   | Normal | Deutan | Protan |
| ------------------------- | ------ | ------ | ------ |
| Light today               | 0.156  | 0.076  | 0.096  |
| Bench light               | 0.159  | 0.087  | 0.094  |
| Dark today (= bench dark) | 0.089  | 0.037  | 0.079  |

- `tokens.test.ts` keeps bench light at ≥ 0.15 / 0.08 / 0.09 and bench dark at ≥ 0.085 / 0.036 / 0.075.
- The light 3D terrain had to leave the data colours' lightness band (L 0.40–0.64) while staying muted (C ≤ 0.07): clover, island grass and canopies are deep greens, soil and bark light: `--bio3d-island-grass` #062F19, `-2` #162B25, `--bio3d-foliage` #102D23, `-2` #032F1B, `--bio3d-soil` #B1A9A1, `--bio3d-bark` #B9A99D (all ΔE_OK ≥ 0.15 from every data colour). The logistic meadow's data pair (a clover patch vs a grazed one: bare soil and its grass rim) is ≥ 0.47 for normal and deutan vision; `tokens.test.ts` keeps ≥ 0.085 in every theme (classic dark deutan 0.086). Review the habitat look in B5.
- Start / stop codon marks of the 3D point-mutation lesson have their own tokens, `--dna3d-start` / `--dna3d-stop` (classic: the confidence inks, unchanged). Bench light #34A409 / #53033F, dark #74E4B0 / #FCCD68: ≥ 3 : 1 on the stage; from the five base colours, `--stage-accent`, `--text-muted` and each other ≥ 0.15 for normal vision and ≥ 0.08 for deutan and protan. The confidence inks themselves stay text colours; in the light bench they cannot also stay ≥ 0.15 from every data colour without turning near-black.
- Dark bench: `--m3d-water-line` 0.15 (0.12 in classic dark) keeps the 3D water line ΔE_OK ≥ 0.25 from the lighter dark stage.
- The existing dark chart steps already pass on the new dark stage #20262B: worst are chart-4 at 3.95 and chart-5 at 3.99.
- Rule: plots render only on stage, bg or surface-1, never on surface-2 or surface-3 (with the B0 values chart-5, chart-6 and chart-7 drop to 2.5–2.9 there). `tokens.test` asserts the ≥ 3 : 1 pairs on stage, bg and surface-1.

**High-contrast mode** (`[data-contrast="high"]`, used by projector mode too):

- Light: ink #000 on #FFF (21:1), accent #00524E (9.06), `--border-input` = ink.
- Dark: #FFF on #000 (21:1), accent #7FF2E6 (15.75).

**Colours outside the palette (#205 A2).** Scrims, fixed backgrounds, shadows and data colours that stylesheets used to write themselves are tokens too, with their values unchanged: `--scrim`, `--scrim-strong`, `--bg-media`, `--bg-drawing`, `--shadow-float`, `--shadow-docked`, `--shadow-pen`, `--text-on-data(-muted)`, `--data-spectrum` and the two-ended `--data-seq-lo` / `--data-seq-hi`. `colorTokens.test.ts` keeps literal colours out of every other stylesheet. Text on the accent always uses `--text-on-accent` (the learner's chat bubble wrote white, unreadable on the light accent of the dark themes).

## 5. Type

Bundled with `@fontsource` 5.3.0, OFL-1.1. The `vietnamese` subset was checked on api.fontsource.org on 2026-11-02. Import only the `latin`, `latin-ext` and `vietnamese` subset CSS. CSP `font-src 'self'` is unchanged.

| Family                 | Weights           | Use                                                            |
| ---------------------- | ----------------- | -------------------------------------------------------------- |
| **Be Vietnam Pro**     | 400 / 500 / 600   | all UI                                                         |
| **JetBrains Mono**     | 400 / 500         | readouts, t, NumberFields, data tables, formula input, keycaps |
| Pangolin, Patrick Hand | (already bundled) | whiteboard only                                                |
| KaTeX fonts            | unchanged         | equations                                                      |

Budget: ≤ 400 KB of woff2, measured in B0.

**Scale** (px at `--font-scale` 1; the code writes rem against today's 14 px root):

| Size / line height | Use                                             |
| ------------------ | ----------------------------------------------- |
| 12/16              | caption, chip (the floor)                       |
| 13/18              | small label, helper                             |
| 14/20              | UI default                                      |
| 16/26              | learning text, `--text-content`; prose max 65ch |
| 18/26              | section                                         |
| 22/30              | page / step title                               |
| 32/42              | display                                         |
| mono 16/22         | readout                                         |
| mono 28/34         | meter (pH)                                      |
| KaTeX 18 / 22      | Science Card / equation band                    |

Tokens (#205 A1, `tokens.css`): `--text-caption` 12, `--text-note` 13, `--text-md` 14, `--text-lg` 16, `--text-title` 18, `--text-heading` 22, `--text-display` 32; lesson text stays `--text-content`. Stylesheets never write their own `calc(N rem / 14)`. Pixel sizes are kept only for text inside a drawing (board units, SVG pictures), each with its reason in `src/app/theme/typeScale.test.ts`. The periodic table's tiles stay below the floor until B7. Canvas labels follow the same 12 px floor (axis numbers: `fontPx(12)`).

**Rules**

- Weights ≥ 400. Sentence case, never uppercase.
- Line height ≥ 1.3 on any Vietnamese text.
- No `overflow:hidden` on single-line accented labels.
- The diacritic pangram "Ặ Ẫ Ỡ Ữ Ỵ ẫ ặ ệ ộ ợ" goes into the visual check, in the browser and in native WebView2.

## 6. Spacing, radius, elevation

**Spacing.** 4-px grid: `--space-1…7` = 4, 8, 12, 16, 24, 32, 48. The existing names and values carry over, plus 48.

**Targets**

- `--target` 40 px. Under `any-pointer: coarse`, icon buttons grow to 48.
- Data-table rows are 40 px everywhere, so no row target drops below the rule.

**Radius**

- 8: controls.
- 12: cards, drawers, sheets.
- 999: chips.
- 0: frame, stage tile, rail, bench edge. These are flush, to give the stage the most area.

**Borders.** 1 px; selected 2 px.

**Elevation**

| Level | Used for                                          | Treatment                                                           |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------- |
| L0    | stage, docked tray, docked notebook               | flat                                                                |
| L1    | stage overlays (HUD chips, camera column, stamps) | solid surface-1 + 1 px `--border` + `0 1px 2px rgba(0,0,0,.12)`     |
| L2    | overlay drawers, menus, popovers                  | `0 8px 24px rgba(11,14,16,.22)`                                     |
| L3    | sheets, palette                                   | `0 16px 48px rgba(11,14,16,.32)` + solid scrim `rgba(11,14,16,.55)` |

`backdrop-filter` is never used (integrated GPUs). A unit test greps the CSS for it.

## 7. Motion

| Token          | Duration | Used for                         |
| -------------- | -------- | -------------------------------- |
| `--dur-fast`   | 120 ms   | hover, chips, sliding indicators |
| `--dur-drawer` | 160 ms   | drawers, `transform` only        |
| `--dur-sheet`  | 240 ms   | sheets, opacity + 0.98 → 1 scale |

Easing: `cubic-bezier(.2,.8,.2,1)` (`--ease`). `--press-lift` (1 px) is how far the main action moves when hovered or pressed.

- A drawer slides as an overlay. On `transitionend` the stage column snaps once, the canvas resizes **once**, and 3D re-frames through `data-inset` (`src/ui/three/insets.ts`).
- Nothing loops. At most one one-time hint (≤ 600 ms). Simulations open paused.
- Reduced motion (the OS setting, or the optional in-app switch, which sets `data-motion="reduce"` on `<html>`): every duration token and `--press-lift` are 0, cuts instead of crossfades, instant 3D camera tweens, no auto-rotate. Each component reads the tokens (no page-wide `*` rule); the skeleton's pulse has its own rule. E2E: no element of the bench keeps a transition or an animation.

## 8. The frame at 1366×768

**Fixed bands**

- Header: y0–48.
- Bench edge: y704–768.
- Stage height: 656.
- Notebook rail: x0–64, always visible.
- Tray: 304 open (4 px frame gutter + 300 paper, content 268), or a 64 px spine when folded.
- Notebook drawer: 352 including its 8 px splitter (content 312).

| Notebook     | Tray           | Stage                   |
| ------------ | -------------- | ----------------------- |
| closed       | open (default) | **998×656** at x64–1062 |
| closed       | folded         | 1238×656 at x64–1302    |
| open         | open           | 646×656 at x416–1062    |
| open         | folded         | 886×656 at x416–1302    |
| presentation | hidden         | 1366×704                |

- **Push or overlay.** A drawer pushes the stage only if the stage stays ≥ the module's `minStageWidth` (default 560; periodic table 790). Otherwise the drawer opens as an L2 overlay and the stage does not resize. This is one function in the layout store, with a unit test.
- **Native window.** A maximised WebView2 window is about 690 px tall (not measured). The stage would then be about 578 px tall, still 1.35× today's 428.

**Stage overlay slots** (12 px inset, solid L1, marked `data-inset` so 3D framing avoids them):

- **TL:** mode cluster (toolbar "Công cụ mô phỏng"; `.stage__toolbar` kept).
- **TC:** HUD chip row, at most 3 chips, 32 tall (`.stage__hud`, `.stage__hud-title` kept).
- **TR:** 3D camera column (40×40 buttons, 4 px gap), or the pin-compare legend in 2D.
- **BL:** provenance stamps (up to 3 stacked, 32 tall) and the scale bar.
- **BR:** default spot for the stopwatch only.
- A pick card never floats over the subject; it lives in the tray.

**Bench-edge driver grid** (identical positions on every screen; y712–760 unless noted):

| Slot                   | Position           | Size                                                                       |
| ---------------------- | ------------------ | -------------------------------------------------------------------------- |
| D0 primary             | x16–160            | 144×48                                                                     |
| D1                     | x168–216           | 48                                                                         |
| D2                     | x220–268           | 48                                                                         |
| D3, always "Đặt lại"   | x272–320           | 48                                                                         |
| Readout                | x340–452, y716–756 | 112×40, mono 16                                                            |
| Scrubber               | x464–944           | 40 hit area, 6 track; computed range shaded, interpolated segments hatched |
| Speed / step segmented | x956–1124          | 168×40                                                                     |
| Confidence chip        | x1132–1358         | 226×48                                                                     |

#205 B4 (12/11/2026): the readout's width follows Cỡ chữ (112 px × `--font-scale`; at 140 % "t = 0,000 s" ran onto the scrubber), and a lesson's player (EdgeSteps, "t = … · x = … · y = …") has 240 px × `--font-scale`, at most two lines. D0's padding and gap are px, so "Tạm dừng" stays on one line at 140 %. The confidence is this chip only: the tray's Science Card summary no longer repeats it.

The confidence chip has two lines:

- line 1: icon 16 + word 14/20 600;
- line 2: 12/16, either "RK4 · Δt 1 ms" (Advanced) or, overriding it, "Đã có can thiệp" in the approx colour.

Clicking the chip opens Thẻ khoa học.

## 9. Per-screen specs (1366×768)

### 9.1 Launch: Cửa vào

**Header y0–48 (frame)**

- Wordmark button "SimLab" x16–148 (aria "Về trang chủ").
- Tệp 64 at x1250.
- Cài đặt 40 at x1318.
- No undo/redo and no AI pill, which removes today's two dead controls.

**Body y48–768 (paper)**

Left column x96–656:

- Eyebrow 13/18 at y112: "Mô phỏng Vật lí · Hóa học · Sinh học".
- h1 32/42 at y136: "Chào mừng đến với SimLab" (keeps `launch-title`).
- Subtitle 16/26 at y236–288, max 52ch.
- Doors at y344–512, each 268×168, at x96 and x380.
  - Door 1 "Virtual Lab": filled, the only filled element. Name kept for `nav.ts`.
  - Door 2 "AI Teacher": outlined, same size, class `.launch-card--teacher` kept. Body (#205 B1) "Hỏi bài và xem giảng từng bước trên bảng, có thể nghe đọc thành tiếng."; "AI Teacher là một AI nên có thể sai." moved to the notes below.
  - Inside each door: icon 28, title 22/30 600, body 14/20.
- Resume text button, 40 tall, at y536 (returning users only; decided 02/11): "Tiếp tục: Ném xiên (Vật lí)".
- Notes under the doors (#205 B1, 13 px): Info + "AI Teacher là một AI nên có thể sai." (not when AI Teacher is locked), then ShieldCheck + the privacy line (was alone at y696).
- #205 B1 (12/11/2026), less space: 40 px at the top, 24 px above the doors, 12 px above "Tiếp tục", 16 px above the notes, all fixed px so the gaps do not grow with the font; a first visit fits 1366 × 768 at 140 %. The still stays at y120.

Right column x720–1310: "bench still" 590×440 at y120.

- An 8 px frame border around one static `draw()` of the default projectile scene.
- Rendered after first paint (idle callback) with no loop. If the chunk fails, the area stays empty.
- Caption 12/16 at y568: "Hình vẽ từ mô phỏng Ném xiên với giá trị mặc định".
- This is an optional cut if startup suffers.

Under 18: door 2 becomes a non-interactive card the same size, with a Lock icon and "AI Teacher cần bạn đủ 18 tuổi".

### 9.2 First run: profile → 18+ gate → optional connect → tour

- Full-window frame backdrop. Sheet 760×600 at x303, y84, surface-1, radius 12.
- Top bar 56: "Bước i/3" 13/18 600 and a progress strip of 3 segments, each 232×4.
- **Step 1, profile:**
  - Grade radio cards, 4 × 164×88 at y176: Lớp 10 / 11 / 12 / Tất cả.
  - Subject `aria-pressed` cards, 3 × 224×72 at y312.
  - `levels.sourceNote` 12/16 with a Clock icon.
- **Step 2, gate (AgeGate):**
  - Three bullets 16/26.
  - Two **equal outlined** choices, 340×72 each, side by side at y380: "Tôi đủ 18 tuổi — bật AI" / "Tôi chưa đủ 18 tuổi".
  - Zero filled buttons; focus starts on the heading.
  - Privacy link.
  - The Rust gate refuses any key until this is answered.
- **Step 3** (18+ and `noKey` only): three option cards, 216×120 each:
  - "Kết nối ngay" (Gemini, with the guide);
  - "Dùng Gemma trên máy này — tải khoảng 880 MB, không gửi gì lên mạng";
  - "Để sau".
- **Footer 72:** "Quay lại" and "Bỏ qua" ghosts on the left; "Tiếp" filled 120×48 on the right.
- **Then:** the Library opens. On the first topic opened, the existing `.tour` runs with 3 spots (`data-tour` = play, tray, notebook) and "Bỏ qua hướng dẫn".

### 9.3 Library: Kệ bài (home + library)

**Header 48**

- Mark 40 at x8; breadcrumb "Phòng thí nghiệm" at x56.
- Right side: `.ai-status` 108 at x666, "Tìm… Ctrl+K" 172 at x778, mode segmented "Cơ bản | Nâng cao" 176 at x954, "AI Teacher" outlined 112 at x1134 (18+ only), Tệp 64 at x1250, Cài đặt 40 at x1318.

**Filter column x0–288** (complementary "Thư viện chủ đề"; padding 16, content 256), in order:

1. "Cấp": Nền tảng, plus Đại cương with the chip "sắp có" (aria-disabled), rows 256×40.
2. "Môn học": radiogroup of 3 rows 256×48. Each row: subject dot, name, "13 chủ đề". Radio names "Vật lí", "Hóa học", "Sinh học"; class `.home__subject` kept.
3. "Loại bài": segmented "Tự do | Có hướng dẫn" 256×40. This is Science Studio.
4. "Tìm chủ đề" 256×40.
5. Bottom, Advanced only: "Lịch sử" and "Soạn bài", 40 each.

**Content x288–1366** (vertical scroll only, `scrollbar-gutter: stable`, padding 24)

- y48–140: h1 "Hôm nay học gì?" 32/42. Grade segmented "Lớp 10 | 11 | 12 | Tất cả" 400×40, right-aligned. Under it, a 12/16 Clock note "Xếp lớp theo mục lục SGK Kết nối tri thức · chờ giáo viên duyệt".
- y156–268: two cards, each about 500×112.
  - "Tiếp tục": static engine thumbnail 160×96 + "Mở lại" outlined.
  - "Có đề bài?": a one-line field that opens the Đề bài sheet on focus; "Phân tích đề" filled (the screen's main action; "Kết nối AI để phân tích đề" without a key; "Tự dựng cảnh" filled under 18); "Tự dựng cảnh" ghost.
- y292 onward: chapter shelves.
  - Heading 18/26 600 + muted "3/5 đã mở".
  - Card grid `repeat(auto-fill, minmax(232px, 1fr))`, gap 16: 4 columns of about 242×152.
  - Each card:
    - 3 px subject top rule;
    - preview 88 (line art or a static engine frame, never invented numbers);
    - title 16/22 600 on up to 2 lines, never cut;
    - dashed pending chip "Lớp 10 · Bài 8 · chờ giáo viên duyệt";
    - `.shelf-card__mark[data-state=opened|complete]` (Lucide Check "Đã xong" or Dot "Đã mở");
    - "Có 2 bài có hướng dẫn".
  - "Sắp có" cards are aria-disabled.
- Empty search: "Không tìm thấy “…”" + "Tìm trong mọi lớp" / "Xóa tìm kiếm" / "Có 3 kết quả trong Hóa học".

### 9.4 Physics bench (default: notebook closed, tray open)

**Targets (#205 A3).** Every visible control is at least 40 × 40 at 100 % and 140 % (`tests/e2e/bench/targets.spec.ts`; a field inside a `<label>` box counts by its box). The stage palette's tools are 40 px fixed (not `--target`) with 2 px padding, so the palette ends at x = 58, clear of the captions scenes write at x = 60 at every Cỡ chữ. The mark, the speed steps and the icon-only `.ai-status` never shrink below 40. The periodic table's tiles wait for B7.

**Header y0–48**

| Element                                | Position      |
| -------------------------------------- | ------------- |
| Mark 40                                | x8–48         |
| Breadcrumb (last crumb = h1 16/22 600) | x56–570       |
| "Đề bài" outlined 112                  | x578          |
| `.ai-status` 108                       | x694          |
| "Tìm… Ctrl+K" 172                      | x806          |
| Mode segmented 176                     | x982          |
| Hoàn tác / Làm lại, 40 + 40            | x1162 / x1206 |
| Tệp 64                                 | x1250         |
| Cài đặt 40                             | x1318         |

Fold order at large font or in English: Tìm → icon 40; AI status → icon + dot (text in tooltip and aria); undo/redo → into Tệp; middle crumbs → "…".

**Notebook rail x0–64, y48–704** (frame). Tabs 64×72, icon 20 + label 12/14 on up to 2 lines:

- from the top: Thử thách, Đồ thị, Lời giải, Số liệu (Advanced);
- pinned at the bottom: Thẻ khoa học (y560–632), Hỏi AI (y632–704).
- Selected tab: frame-raised background + 3 px `--play` bar on the left.

**Stage x64–1062, y48–704** (998×656, 24 px grid)

- TL: "Chọn | Kéo" 88×40, "Vừa khung" 40.
- TC: HUD chips ("Đã chạy xong · Xem lại", the active tool's hint, the persistent intervention chip, and "Dự đoán trước" while the POE is unanswered).
- TR: compare legend (Advanced): run letter + swatch + dash + "đã cũ".
- BL: scale bar "1 m".
- Placed tools sit at default spots: the ruler beside the launch point, the stopwatch BR. Each has its own 40 px X.

**Tray x1062–1366** (complementary "Điều chỉnh (bảng thuộc tính)")

- Header y48–96: "Điều chỉnh" 16/22 600 + "Thu gọn khay" 40.
- Science summary y96–168, pinned (`.science-card.science-card--summary`):
  - confidence chip + model name 14/20 600;
  - validity line 13/18 muted;
  - "Xem thẻ".
  - After an intervention it grows to 120 with an amber band "Đã có can thiệp — kết quả là mô phỏng số" + "Đặt lại để về kết quả chính xác" (outlined 40).
- Scroll area y168–704 (`.tray .panel__scroll`):
  - "Thông số": one block per parameter, 96 tall.
    - Row 1, 40 tall: left 148 = label 14/20 500 + source chip line ("Mặc định" / "Có trong đề" / "Bạn chỉnh"); right = NumberField 112×40 (mono, vi comma, unit suffix, `inputmode=decimal`, snap on blur, no wheel).
    - Row 2, 40 tall: − 40 | slider 172 | + 40.
  - "Thêm thông số" / "Bớt thông số".
  - "Dụng cụ đo": switch rows 268×40 — Thước; Vectơ vận tốc and Vectơ gia tốc (with swatches); Advanced adds Thước đo góc, Đồng hồ bấm giờ, Vết. Switch names keep today's tool names.
  - "Vật thể" (Advanced).
  - "Bài có hướng dẫn" (40 px rows).
- Folded spine x1302–1366: "Mở khay Điều chỉnh" 64×72 + section buttons 64×56.

**Bench edge**

- D0 "Chạy (Space)" / "Tạm dừng (Space)": 144 px whatever its word ("Chạy để kiểm tra" on two lines). The kit's "Space" key chip left no room for those words, so the shortcut is in the tooltip, the accessible name and `aria-keyshortcuts`.
- D1 "Bước tiếp (.)".
- D2 "Ghim lần chạy này để so sánh".
- D3 "Đặt lại (R)".
- Readout "t = 1,24 s".
- Scrubber (aria-valuetext carries t, which removes the per-frame aria-live).
- Speed: three 40 px steps 0,5× · 1× · 2× in the 168×40 slot (Basic; user decision 2026-11-02, replacing "Chậm | Thường") or a select of every speed (Advanced).
- Confidence chip. "Chạy chậm hơn tốc độ chọn" appears as an amber text chip above the speed control.

**Main action:** D0. It is the largest labelled control, never in a menu, and never moves.

**Basic:** first 5 parameters (basicSplit) plus any from the problem or the user; Thước and Vectơ only; tabs Thử thách, Đồ thị, Lời giải, Thẻ khoa học, Hỏi AI.

**Notebook open** (first visit lands on Thử thách): drawer x64–416, header 48 (title 18/26 + "Đóng sổ" X 40), content 312. Stage x416–1062 (646×656).

- **Thử thách:**
  - POE card: question 18/26; radio cards 312×48; "Chốt dự đoán" tonal. Locking relabels D0 to "Chạy để kiểm tra".
  - After the run: "Bạn dự đoán: …" | "Mô phỏng cho thấy: 22,1 m → 22,1 m" from `observe()`, with icon + text + colour, never a red X.
  - "Tự giải thích (không lưu, không gửi đi)" in learner ink.
  - Challenges: an ordered list, nothing locked. "Mục tiêu" / "Hiện tại" in mono; "Gợi ý 1/3" ladder (earlier hints stay); "Kiểm tra" tonal; a rationale built only from `solve()`; a static Celebrate line.
- **Đồ thị:** radiogroup "Chọn đồ thị"; uPlot 312×232 (`.u-over` ≥ 80 kept) with the cursor tied to the scrubber; 3 monitor tiles 96×56 in mono with an engine origin chip.
- **Lời giải:** the existing hint-first flow; "Xem lời giải ngay"; `.solution__answers`.
- **Số liệu (Advanced):** the drawer widens to the push/overlay limit. Graph stacked above a 40 px-row table; hovering a row moves the scrubber; "Xuất CSV".

### 9.5 Chemistry: reactions and mechanism

**Stage 998×656**

- TC: equation band 720×56 at x203–923, y60–116 (solid surface-1, KaTeX 22).
- Under it: HUD step name "Bước 2/4 · OH⁻ tấn công nguyên tử C".
- The mechanism canvas fills the rest. Reacting atoms and curly arrows use data colours; spectators are muted.
- BL dashed stamp, shown whenever interpolated frames are on screen: "Chuyển tiếp minh họa — không phải quỹ đạo nguyên tử thực". The matching scrubber segments are hatched.
- Reaction not in the library: no mechanism is offered. The equation band shows the balance check, and a dashed amber stamp across y124–172 (full width minus 24) reads "Phản ứng này chưa có trong cơ sở dữ liệu đã kiểm chứng — SimLab chỉ kiểm tra cân bằng." with "Mở công cụ Cân bằng" outlined 40.

**Tray "Phản ứng"**

- Science summary.
- Search 268×40.
- List of the 39 curated reactions, rows 48: formula + name + chips "Có cơ chế" and source.
- "Điều kiện".
- "Viết phản ứng khác" field 40 + "Kiểm tra" tonal.

**Bench edge** (group "Điều khiển các bước")

- D0 "Chạy", D1 "Bước trước", D2 "Bước sau", D3 "Đặt lại".
- Readout "Bước 2/4".
- Scrubber with labelled ticks.
- Speed "0,5× | 1× | 2×".
- Chip.

**Advanced:** labelled electron-pushing arrows, a source line per step, conditions.

### 9.6 Biology 3D lesson (mitosis as the example; the same frame for meiosis, dogma, mutation, Mendel 3D, enzyme, transport)

**Stage 998×656** (post-processing only on High tier with a discrete GPU)

- TR camera column x1010–1050 from y60, 40×40 buttons: Vừa khung · Đặt lại góc nhìn · Nhãn (popover "Không | Tên") · "Toàn cảnh | Cận cảnh" · "3D | 2D". Today's radio names are kept.
- TC caption chip (solid, max 560): "Kì giữa: nhiễm sắc thể xếp ở mặt phẳng xích đạo".
- BL stamps: "Chuyển động minh họa · số lượng từ mô hình" + scale chip.
- No module-drawn chip rows. `.m3d__caption` and `.m3d__info` move into these slots.

**Tray "Bộ phận tế bào"**

- Science summary.
- "Động vật | Thực vật" 268×40.
- "Hiện tên các phần" switch.
- "Số liệu từ mô hình" card: 2n, NST, crômatit in mono, right-aligned, engine chip.
- Parts list (group "Bộ phận tế bào", 40 rows). A pick on the stage selects the same row.
- Picked-part card under the list.
- "Làm mờ phần còn lại" (Advanced; new, decided 02/11).

**Notebook:** the module's `Bottom` ("Các kì" chart) in Đồ thị. Modules with no Bottom get no Đồ thị tab, so `bottomPanel.test` keeps "no empty box".

**Bench edge**

- D0 "Chạy", D1 "Kì trước", D2 "Kì sau", D3 "Đặt lại".
- Readout "Kì giữa (3/6)".
- Scrubber with named ticks.
- Speed (Advanced only; Basic hides speed and camera mode as today).
- Chip.

**No WebGL, Low tier or lost context:** the 2D view renders, and a TC chip says "Đang hiện bản 2D: máy chưa hỗ trợ 3D" with "Thử lại 3D".

### 9.7 Guided lesson step (Science Studio)

**Header:** breadcrumb "… › Ném xiên › Góc ném nào bay xa nhất?".

**Lesson panel x64–480** (416, paper)

- Header y48–104: title 16/22 600 on 2 lines + "Về Virtual Lab" ghost 40 (label kept; it returns to this topic's free bench).
- Stepper y104–160: `ol.studio-steps`, 6 segments × 64, icon 16 + label 12/14 (Dự đoán · Thí nghiệm · Quan sát · Giải thích · Kết luận · Báo cáo). Done = Check; current has `aria-current=step`.
- Body y160–640 (scrolls): driving question 22/30 600; lead 16/26 (max 60ch); radio cards 384×48; the 1–3 controls the scenario binds; "Hỏi thầy" ghost (18+ only).
- Footer y640–704:
  - "Quay lại" ghost 112×48 at x80, always enabled after step 1;
  - blocker sentence 13/18 (aria-describedby on the slot), e.g. "Chạy thí nghiệm để có số đo";
  - the single filled slot 160×48 at x304–464. Its role changes: "Chốt dự đoán" → "Chạy thí nghiệm" (runs the bench) → "Tiếp: Quan sát" … → "Lưu báo cáo". `/^Tiếp:/` is kept.

**Stage** x480–1302 (822×656). **Tray** stays a spine x1302–1366. Opening it overlays the stage, since 518 < 560, and marks the evidence as learner-changed. **Rail:** only Thẻ khoa học and Hỏi AI ("Hỏi thầy" with the step context); they open as overlays over the lesson panel. **Bench edge:** D0 is tonal, because the lesson footer owns the filled slot.

**Báo cáo:**

- The panel widens to x64–704 (640); the stage stays live at x704–1302 (598).
- Sections Dự đoán / Số đo / Giải thích / Kết luận. Every item has an origin chip: "SimLab tính" / "Bạn ghi" / "AI hỗ trợ".
- Footer: "Lưu báo cáo" filled, "Sao chép", "Làm lại", and the link "Thử tự do trong Phòng thí nghiệm".

**Soạn bài (Advanced):** the same frame; panel 640 = step list 160 + form 448. Selects are fed only from engine ids and data keys. Chip "Bài tự soạn · chưa được duyệt". "Nhập JSON" / "Xuất JSON". "Lưu bài" filled. "Tạo bài mới" is kept.

### 9.8 AI Teacher room ("Giảng trên bảng")

**Header y0–48** (frame)

- "Về trang chủ" ghost 144 at x8.
- h1 "AI Teacher" 16/22 600 at x168, with the chip "Là một AI".
- Segmented "Trò chuyện | Giảng trên bảng" 240 at x456.
- Engine select 280 at x704, grouped: "Trên mạng: Gemini · Claude · Groq" / "Trên máy này: Gemma 270M · 1B · E2B" / "Máy khác (cùng máy tính): Ollama · LM Studio · llama.cpp…".
- "Giọng đọc" 40 at x1190, micro 40 at x1234 (opt-in), Cài đặt 40 at x1318.

**Board x0–920, y48–704** (region "Bảng trắng của AI Teacher")

- Face tabs "Bảng 1 · 2 · 3" (40) at the top-left edge.
- SelectionBar as a solid strip across the board top: "Hỏi thầy chỗ này" filled, "Bỏ chọn", "Quay lại bài giảng".

**Bench edge under the board, x0–920, y704–768** (group `board.controls`). One row via `toolbarFit`: Tạm dừng/Tiếp tục 120 · Giảng lại · Viết nhanh · Tốc độ · Bút của tôi · Xóa nét bút · Khoanh để hỏi · − · Vừa khung · +.

**Conversation x920–1366, y48–768** (region "Trò chuyện với AI Teacher")

- Header 48: "Trò chuyện", data-flow chip ("Gửi tới Google Gemini" / "Không gửi lên mạng"), "Xóa cuộc trò chuyện".
- Messages: every answer has an AiContentBar; a "Kết quả do SimLab tính" card for tool numbers; "Số do AI tự đưa ra — chưa kiểm tra" chips; AI links are never clickable.
- Composer y632–768:
  - textarea "Nhập câu hỏi" 414×56;
  - row: "Suy nghĩ kĩ (Think)" switch (`/Think/` still matches), "Tra Wikipedia" (opt-in), "Gửi câu hỏi" filled 120×40;
  - footer 12/16.

**Main action:** "Gửi câu hỏi". While a selection exists, "Hỏi thầy chỗ này" takes the slot.

**Trò chuyện layout:** board hidden; column centred at x303–1063; the bench edge becomes a voice strip ("Đọc to", "Dừng đọc", voice engine select).

**No AI available:** a 480×240 card with "Mở Kết nối AI" / "Dùng Gemma trên máy" / "Dùng AI trên máy khác".

### 9.9 Settings sheet

- Sheet 1200×688 at x83, y40 (surface-1, L3, solid scrim). Header 56: "Cài đặt" + "Đóng (Esc)" 40.
- **Nav x83–339, y96–728:** vertical tablist with arrow keys, rows 40, groups in 12/16 600 muted:
  - "Chung": Giao diện · Mô phỏng · Phím tắt · Lịch sử phiên bản, plus the optional new page "Hiển thị và trợ năng".
  - "AI": Kết nối AI · AI Teacher · Gemma trên máy · AI trên máy khác (`#settings-runtimes`) · Card đồ họa · Thư viện kiến thức · Trí nhớ hội thoại · Giọng nói.
  - "Riêng tư và an toàn": An toàn.
- **Content x339–1283:** page title 22/30 at x363; `.settings-group` cards in one column x363–1003 (max 640); help column x1019–1259 (GuideArt, key-test result).
- Today's 13 `SETTINGS_SECTIONS` ids, `openSettingsAt(id)` and "visited page stays mounted" are kept. "Đặt lại bố cục" goes on Giao diện.
- **Main action:** at most one filled button per page ("Kiểm tra key", "Tải Gemma", "Tìm AI trên máy này"). Everything else saves on change.

### 9.10 Other screens (same frame, short)

- **Periodic table:**
  - `role=grid` with arrow keys. 18 × 50 px tiles + 2 px gaps = 934, at stage x96, y96–446; f-block y466–566.
  - Tile text flips between ink and white per ramp step (≥ 4.5:1).
  - BL legend: ramp, hatched "Không có dữ liệu", "Tuyến tính | Lôgarit".
  - Tray = "Nguyên tố" card with the configuration "theo bảng dữ liệu" and the badge "cấu hình ngoại lệ".
  - Bench edge: element stepper "‹ 26 · Fe · Sắt ›" in D0–D2 + search. No filled button.
  - `minStageWidth` 790, so the notebook overlays.
- **Molecule 3D:** TR camera column; BL stamp "Hình 3D do máy tính dựng (RDKit ETKDG + MMFF94), không phải đo bằng thực nghiệm" (new wording → DATA_REVIEW). Tray: search, VSEPR shape/angle from data, RDKit 2D 268×160. Bench edge: stepper "‹ H₂O ›", "Tự xoay" (off; unavailable with reduced motion).
- **Balancer:** the tray starts folded (stage 1238). A stage card 760 wide: mono 22 input, "Cân bằng" filled 160×48, result KaTeX 26, atom ledger rows 40. No D0.
- **Particles:** standard time driver; tray parameters + monitors.
- **Titration** (PR #108, `feat/106-titration`): D0 "Nhỏ thêm", D1 "Rút bớt", D3 "Đặt lại"; readout "V(NaOH) = 9,50 mL"; volume scrubber; step "0,1 mL | 1 mL". TR pH meter 200×96 (mono 28). BL stamp "Màu minh họa". Tray "Thông tin dung dịch". Đồ thị: pH–V with the engine's V_eq. The equivalence label appears only when the model's own test says so.
- **Biology 2D:** stage player in the driver grid. Lessons with no time put their action in D0 ("Lai", "Chạy 100 lần").
- **Habitats:** BL stamps "1 hình = 10 cá thể" + "Con vật, cây và chuyển động: minh họa". Tray monitors (N, p, q) in mono. Driver: D0 Chạy, D1 "Bước 1 thế hệ", scrubber = slider "Thế hệ" (name kept). Predator–prey readout "Mẫu tính gần nhất — không nội suy".
- **Cell → DNA zoom** (`feat/107-cell-to-dna`, six levels in `LEVELS`: Tế bào nhân thực › Nhân tế bào › NST kép ở kì giữa › sợi › nucleosome › DNA):
  - TL rung ladder 168×40 × 6 (aria-current);
  - BL scale bar only from `data/cell_dna_zoom.json` rows, else "Minh họa — không theo tỉ lệ";
  - driver: D0 "Phóng to", D1 "Thu nhỏ";
  - readout "Bậc 3/6 · NST kép ở kì giữa";
  - chip "Định tính" during transitions.
- **Đề bài sheet:** 760 wide at x303, y48, L3.
  - Input: `textarea#problem-text` (id and label kept) 712×160, then "Chụp đề" / "Tự dựng cảnh (không dùng AI)" / "Phân tích đề" filled (Ctrl+Enter).
  - Confirmation "Tôi hiểu đề như sau": `.qty-card` 3 per row 232×96, each with a source chip and quote; "Phần chưa hỗ trợ"; AiContentBar; "Dựng cảnh" filled.
- **Hỏi AI drawer:**
  - Header: engine/status chip + "Mở rộng thành AI Teacher".
  - "Lấy thông tin từ màn hình" (off). When on, it lists exactly what will be sent.
  - `.chat-panel` kept; composer "Gửi câu hỏi" tonal (D0 owns the filled slot).
  - Under 18: the tab shows a Lock and one explanation card; no key field anywhere.
- **Palette** 640 at x363, y88; groups Đi tới / Chủ đề / Bài có hướng dẫn / Cài đặt / Thao tác; rows 44; solid scrim, no blur.
- **Tệp menu** 288, anchored under Tệp, items 40: Lưu dự án · Mở dự án · Xuất ảnh PNG · Xuất CSV (Advanced) · Lịch sử · Chế độ trình chiếu (F5) · Nguồn tham khảo · Hướng dẫn nhanh · Quyền riêng tư · Có gì mới · Kiểm tra cập nhật.
- **Presentation (F5):**
  - header, rail, tray and notebook hidden; stage 1366×704; strokes ×1.5, stage text +25 %;
  - "Thoát trình chiếu (Esc)" at x1150–1354, y12;
  - the bench edge stays, with the chip; clicking the chip opens the Science Card as a 480 px popover;
  - never persisted.
- **States:**
  - loading: static skeleton + "Đang mở bài…" (the second line after 1,5 s);
  - region error card 480: "Mình chưa mở được phần này. Các phần khác vẫn dùng bình thường." + "Thử lại" filled + "Về kệ bài";
  - offline: "Phân tích đề" and Wikipedia disabled with a reason; local engines keep working;
  - overload chip "Đang bỏ bớt khung hình — kết quả không đổi".

## 10. Interaction rules

1. **One filled button per window state.** A tiny `MainActionSlot` store decides which button is filled. Priority, highest first:
   1. modal/sheet primary;
   2. region error "Thử lại";
   3. lesson footer slot;
   4. Teacher selection ("Hỏi thầy chỗ này");
   5. Teacher composer;
   6. bench D0.

   The button component carries `data-emphasis="filled|tonal|ghost"`. A unit test proves exactly one filled per store state. The E2E helper `expectOneFilled(page)` runs in every bench spec (zero on the gate).

2. **POE through the role-changing Play.** "Chốt dự đoán" relabels D0 to "Chạy để kiểm tra". After the run D0 reverts and the notebook shows the before/after pair.
3. **Intervention.** Any drag, nudge or mid-run state edit, at the same moment:
   - the chip drops to "Gần đúng" with "Đã có can thiệp";
   - the TC chip "Đã có can thiệp — kết quả là mô phỏng số" stays until "Đặt lại";
   - the tray summary gets its band;
   - runs recorded afterwards are tagged "sau can thiệp" (pin legend, history rows, report);
   - the live region announces once, at the end of the drag.

   This is wired to the existing `withIntervention()`.

4. **Drag alternatives (WCAG 2.5.7):** NumberField with ±, arrow keys nudge the picked body (Shift for fine steps), camera buttons and arrow-key orbit.
5. **Linked views.** Focusing a parameter outlines its body (`--stage-accent`) and its series. Hovering a graph point or table row moves the scrubber marker. Values change only through `sim.applyParams`.
6. **Keyboard:**
   - Space, ".", R, F, V/H, M, A, T, Ctrl+Z/Y/S/O, Ctrl+K, F5/Esc, font ±, Ctrl+Enter (problem).
   - F6 / Shift+F6 cycle: header → notebook → stage → tray → bench edge.
   - Single-letter keys are ignored in inputs, textareas and contenteditable, and while `event.isComposing`.
   - No pane-hiding shortcut at all.
7. **Screen readers.** A hidden screen summary built only from engine numbers through `formatNumber` comes before "Khung mô phỏng". aria-live only on state changes.
8. **Touch:** 40 px targets (48 under coarse pointers); long-press shows the tooltip; no gesture-only actions.

## 11. Science and provenance

**Science Card at three depths**

1. The bench-edge chip: always on, including in presentation mode.
2. The tray summary: pinned, never collapsible.
3. The notebook tab "Thẻ khoa học": sections in sentence case — Mô hình, Phương trình, Giả thiết, Phạm vi dùng được, Độ tin cậy, Nguồn. Each source has a review chip "đã kiểm chứng" / "chờ duyệt". In Advanced, readouts carry superscripts ¹–ⁿ that jump to the matching assumption. Basic folds the details, as `ScienceCard.test` pins today.

**Three inks**

- Engine numbers: mono + "SimLab tính".
- Learner text: blue pen + "Bạn ghi".
- AI text: violet rule + AiContentBar ("Do AI hỗ trợ · <provider> · có thể sai" + "Báo nội dung").

**Stamps.** One `ProvenanceStamp` component (dashed border, fixed text, no close) for every label: "chưa có trong cơ sở dữ liệu đã kiểm chứng", "Chuyển tiếp minh họa…", "minh họa", "1 hình = N cá thể", "Màu minh họa", the RDKit caption, and "chờ giáo viên duyệt" on every placement.

**Overload.** Smoothness is dropped first, never accuracy.

## 12. Components

**New chrome components** (written for the bench, styled only by tokens):

- `BenchFrame`, `BenchHeader` + `Breadcrumb`
- `NotebookRail` + `NotebookDrawer`
- `Tray` + `TraySpine`
- `Splitter` (reuse today's keyboard and limit logic)
- `BenchEdge` with `DriverGrid` slots
- `StageSlot at="tl|tc|tr|bl|br"` (a portal, marked `data-inset`)
- `ConfidenceChip`, `ScienceSummary`, `ProvenanceStamp`, `OriginChip`
- `MainActionSlot` store + `Button emphasis`
- `NumberControl` (label, source chip, existing NumberField, ±, slider)
- `ToolSwitch`, `HudChip`
- `Sheet` (modal / side), `Menu`, `DoorCard`, `ShelfCard`, `LessonPanel` + `Stepper`, `ErrorCard`

**Kept and restyled through tokens:**

- ScienceCard content, AiContentBar, CrisisCard
- PoeFlow, SolutionPanel, ChallengePanel logic
- GraphPanel / XYChart (uPlot), DataPanel
- ProblemDialog / qty-cards, ChatPanel, Whiteboard / toolbarFit
- Segmented (sliding indicator), Skeleton, ProgressBar, Celebrate, Toaster, CommandPalette
- every module Stage

New shell, same organs: rewriting domain logic would add risk without adding anything visible.

**Controls: uiverse kit B** (user choice 2026-11-02, checked before it went in: 15 fixes; sources and the MIT notice in `docs/THIRD_PARTY.md`). All in `src/app/bench/bench.css`, tokens only:

- **One surface hook.** Controls are drawn for paper. `[data-surface="frame"]` (header, notebook rail, bench edge, tray spine) maps the paper tokens (`--text*`, `--bg-panel`, `--bg-hover`, `--bg-active`, `--border*`, `--accent*`, `--focus-ring`) to the frame's, so the same rules draw the frame variant and the focus ring turns `--focus-frame`; `[data-surface="paper"]` (the file menu, the confidence chip) maps them back. E2E: every focus ring ≥ 3 : 1 against the surface it is drawn on, frame and paper, light and dark.
- **Disabled:** dimmed text and a dashed border (never colour alone), `not-allowed`; hover only `:not(:disabled)`. On the frame, `:active` is `--frame-pressed`.
- **Targets:** 40 px; under `any-pointer: coarse` every icon button on the frame and the bench (the tray's − / +, a chart's CSV button) is 48 px; bench-edge icons 48. Basic's speed steps are 0,5× · 1× · 2× plus the open lesson's own speed (`suggestedSpeed`: ×1000 for an hour-long trip, ×0,1 for a 100 Hz wave), kept in the store and reset by every open (a lesson's own speed never follows into the next one). At every switch to Basic and every open, a speed off the steps lands on the nearest step, whatever is on screen.
- **Focus rings everywhere (#205 A4).** The global `:focus-visible` ring (2 px `--focus-ring`) is removed only where another rule shows focus: the box of a field (parameters, problem, periodic search, Ctrl+K row, AI Teacher's message box), the shelf card, the splitter's accent, the open list's option. The stage canvas (it takes the keyboard) has an inset ring. `focusRing.test.ts` lists each removal with its replacement; `focus-rings.spec.ts` reaches the four places that had none with Tab.
- **Short labels (#205 A5).** Labels in the header and the tray stay on one line ("Cơ bản" / "Nâng cao" too). The lesson name and the tray's Science Card title are cut to "…" when long or large; `useCutTip` (`src/ui/useCutTip.ts`) then gives them their whole text as a tooltip and a Tab stop, so the keyboard reaches it as well as the pointer. The tray's title has its own line under the confidence chip. In the narrow header the mode steps take `--space-2` padding so a long name keeps its first two words (B8 check). `labels.spec.ts`.
- **Parameter row (§9.4):** the 112×40 number box is one `<label>` (its focus ring by `:focus-within`), the number is described by its unit, the slider's `aria-valuetext` is the number with its unit, − / + in the bench (`BenchContext`).
- **Tooltip:** `TooltipLayer` in the top layer, nudged inside the window (WCAG 1.4.13). Esc hides the bubble; a bubble shown by hover takes that Esc for itself (the next one closes the drawer or dialog), one shown by keyboard focus lets it go on (a dialog still closes with one Esc). A bubble shown by hover stays while the pointer is on it or crossing the 8 px gap, judged from the pointer's position: the bubble keeps `pointer-events: none`, so a click always reaches what lies under it (in the classic shell too).
- **Sections** become cards with sentence-case titles; chips and key caps 12/16; the skeleton pulses gently.

**ModuleView** gains two optional fields:

- `Driver?: ComponentType`: the module's bench-edge group, replacing each module's own player.
- `minStageWidth?: number`.

`Stage` → stage, `Panel` → tray, `Bottom` → notebook Đồ thị. Stamps and camera buttons move into `StageSlot`.

## 13. Old decisions revisited (owner decisions)

- **(a) "Lab panels cannot be hidden, only resized" (0.4.3): revisited.**
  - The tray folds to a labelled 64 px spine; the notebook closes to its always-visible rail.
  - Nothing reaches zero width. No shortcut hides anything, and there is no X on the tray.
  - "Đặt lại bố cục" sits in the palette and in Settings. Presentation mode is unchanged.
  - **Fallback if refused:** the tray is resize-only (min 256), and the closed notebook counts as "resized to its rail". The stage stays 998×656 and the overlay rule covers narrow cases.
- **(b) Two launch cards; Studio inside the lab: kept.** The returning-user text link "Tiếp tục: …" (not a card) was decided on 02/11.
- **Other changes that move pinned behaviour:**
  - the chat bubble is removed (the Hỏi AI tab replaces it, which ends UI-01);
  - the top-bar problem box becomes the Đề bài sheet;
  - the top-bar subject radiogroup becomes the breadcrumb + Library;
  - timeline + status bar become the bench edge;
  - inspector → tray, bottom panel → notebook;
  - stage tool buttons become tray switches;
  - Studio tabs become Library filters;
  - presentation moves to Tệp / F5; the light / dark control sits in the header and in Settings → Giao diện, where "Theo máy" toggles following the device; it was the uiverse switch JkHuger/old-falcon-20 (user choice 2026-11-02) until the user asked for another kind (11/11/2026, #202): now a 40 × 40 icon button, moon ⇄ sun, pressed = dark;
  - the face-ring column is removed;
  - "Think" becomes "Suy nghĩ kĩ (Think)";
  - Segoe UI → bundled Be Vietnam Pro + JetBrains Mono (new dependencies: one Vietnamese-safe face on every Windows build, and tabular readouts);
  - all seven light `--chart-*` colours change in the bench (hues kept, lightness spread out, ≥ 3:1; §4);
  - `--glass-*` blur becomes solid.
- **New features, all decided on 02/11, built after the frame (not needed for the rebuild):** run log "Sổ ghi", "Ví dụ" presets, parameter sweep, Ctrl+/ sheet, the "Hiển thị và trợ năng" page, "Làm mờ phần còn lại", "Theo dõi một hạt", the resume link.

## 14. Build plan for 0.8.1

**Dev switch (B1–B7; B8 removed it).** One build only, no `VITE_*` flag.

- `AppShell` renders `BenchShell` when `import.meta.env.DEV && localStorage['stemsim.dev.shell'] === 'bench'` (wrapped in try/catch).
- A unit test proves a production build ignores the key.
- Production ships the classic shell until B8.
- Tokens and fonts apply only under `[data-shell=bench]`, so classic is untouched.

**Test policy.** No test is ever weakened.

- Playwright gets a `chromium-bench` project (plus `chromium-3d-bench` for `HEAVY_3D`) with a storage state that also sets `stemsim.dev.shell`.
- A bench spec is a **copy** in `tests/e2e/bench/<name>.spec.ts` with the **same test titles**. A ~20-line `scripts/e2e/title-parity.mjs` in CI fails if a classic title is missing from its bench twin.
- Classic specs stay green until the flip, and are deleted only in B8 once parity holds.
- `nav.ts` gains `openTopic(subject, topic)` and `openProblem()`, which branch on the shell, so most specs change in one helper.
- Every PR updates vi and en (`i18n.test`), `fakeAi.ts` where labels move, and docs.

**Selector migration** (landmark names kept wherever possible):

| Today                                                                                                                                   | Bench                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| landmarks "Thư viện chủ đề", "Bảng thuộc tính", "Khung mô phỏng", "Bảng đồ thị và lời giải", "Điều khiển thời gian", "Công cụ mô phỏng" | kept (see §3)                                                                                                                                                             |
| `.tree__topic-title`, `.tree__mark[data-state]`                                                                                         | `.shelf-card__title`, `.shelf-card__mark[data-state]` (same values)                                                                                                       |
| radio "Sinh học" ×20 (top bar)                                                                                                          | Library "Môn học" radio, same name, reached via `openTopic`                                                                                                               |
| `textarea#problem-text`, "Phân tích đề"                                                                                                 | inside the Đề bài sheet, same id, label and name                                                                                                                          |
| `.chat-bubble`                                                                                                                          | removed; rail tab "Hỏi AI"; `.chat-panel` and "Lấy thông tin từ màn hình" kept. UI-01 becomes the stronger "no floating element overlaps tray, notebook or lesson footer" |
| `.launch-card--teacher`, `/Virtual Lab/`, "Về trang chủ", "Cài đặt", "Tệp", `/Hoàn tác/`, `/Làm lại/`                                   | kept                                                                                                                                                                      |
| `.topbar .ai-status`                                                                                                                    | `.bench-header .ai-status`                                                                                                                                                |
| toolbar tool buttons ("Thước", `/Thước đo góc/`)                                                                                        | tray `role=switch` with the same names                                                                                                                                    |
| tabs "Lời giải", "Thử thách", "Đồ thị", "Số liệu"                                                                                       | rail tabs, same names                                                                                                                                                     |
| `.inspector/.bottom-panel .panel__scroll`                                                                                               | `.tray/.notebook .panel__scroll`                                                                                                                                          |
| `.science-card` ×18                                                                                                                     | the tray summary carries `.science-card`; the full card in the notebook too                                                                                               |
| `.home__subject` ×3, "Hôm nay học gì?"                                                                                                  | Library subject rows, same class and heading                                                                                                                              |
| `.tour`, `data-tour`                                                                                                                    | kept, spots = play / tray / notebook                                                                                                                                      |
| Studio tabs                                                                                                                             | Library "Loại bài" + "Môn học" (spec rewritten). `.studio-steps [aria-current=step]`, `/^Tiếp:/`, "Về Virtual Lab", `table.studio-table`, "Tạo bài mới" kept              |
| Teacher: "Nhập câu hỏi", "Gửi câu hỏi", "Viết nhanh", `/Think/`, Esc back, board one row at 1366×768 and 1366×640                       | kept                                                                                                                                                                      |
| 3D: radio "3D"/"2D"/"Toàn cảnh", group "Bộ phận tế bào"/"Các kì", slider "Thế hệ"                                                       | kept, now in slots, tray and driver                                                                                                                                       |
| `layout.spec` geometry                                                                                                                  | bench geometry at 1366×768 and 1366×688: stage ≥ 998×656 default, no horizontal scroll at the largest font in English, `.u-over` ≥ 80, targets ≥ 40                       |

**Phases** (one machine; each PR green: lint, typecheck, unit, both E2E projects, Rust untouched):

| Phase | Work                                                                                                                                                                                                                                                                                              | Weeks |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| B0    | Tokens (bench scope), light chart re-step + `tokens.test` contrast table (the pairs in §4) + ΔE checks rerun (adjust terrain tokens, never the floor), no-`backdrop-filter` test, fonts, diacritic visual check                                                                                   | 1     |
| B1    | Dev switch, `BenchFrame`, header, rail/drawer, tray/spine, splitters, `stemsim.layout` fields (still version 1), push/overlay rule, `StageSlot`, `DriverGrid`, `MainActionSlot` + `expectOneFilled`, hidden summary, title-parity script                                                          | 2     |
| B2    | Physics bench: `NumberControl`, tool switches, notebook tabs with existing panels, Science summary + chip + intervention, role-changing Play, first-visit Thử thách, series dash/marker/"đã cũ"; bench copies of `physics`, `layout`, `learner` (parts)                                           | 1.5   |
| B3    | Launch, first run, Library, Đề bài sheet + ProblemDialog; bench `project`, `learner`, `ai-flow`, `whatsnew`                                                                                                                                                                                       | 1.5   |
| B4    | Chemistry: `Driver` + slots for the 6 views (titration after #108 merges); `chemistry` bench spec                                                                                                                                                                                                 | 1.5   |
| B5    | Biology 2D, 3D, habitats, zoom (after #107 merges): players → `Driver`, camera → TR, chips → stamps; 3D bench specs                                                                                                                                                                               | 2     |
| B6    | Guided lessons, report, authoring in `LessonPanel`; `studio`, `studio-biology` bench specs                                                                                                                                                                                                        | 1.5   |
| B7    | AI Teacher room, Hỏi AI tab, Settings sheet, palette restyle, presentation, all states, under-18; `teacher`, `board`, `lesson-flow`, `local-ai`, `board-picture` bench specs                                                                                                                      | 2     |
| B8    | Flip: bench becomes default, classic shell + classic specs + `--glass-*` + launch blobs deleted after parity passes; native WebView2 check (window height, KaTeX subscripts, diacritics, board toolbar width); CLAUDE.md "Bench" section; release-notes entry (`notesReady` false until reviewed) | 1     |

Total: about 14–15 builder-weeks, including the duplicated specs.

**B8 done (#193, PR #198, merged 12/11/2026 as `f2e535e`).** Native WebView2: window height,
KaTeX subscripts under the real CSP, diacritics and the first frame passed; the whiteboard toolbar
was accepted through E2E `board.spec` (user decision 11/11/2026). CI run 43051736789 on the last
head `d086b3e`: 8/8 green (two jobs re-run after a DNS error installing apt packages on the runner).
The bench is the only shell. Parity first: every classic E2E title
had its bench copy (143/143) before the 37 classic specs went; the classic shell's unit tests now
check the same things on the bench. Deleted after an import walk from `src/main.tsx`: the classic
shell and its parts, their CSS, `--glass-*`, the launch blobs and 30 i18n keys. Kept from them where
the bench had nothing: the slow-motion and lower-quality notices (`PerfNotes`, on the stage) and the
§9.3 empty-search ways out on the shelf. The Playwright projects `chromium`, `chromium-3d`,
`chromium-3d-perf` run `tests/e2e/bench/`; `title-parity.mjs` went with the classic specs.

**Owner decisions (all decided on 02/11):**

- rule (a): yes, the tray folds to a spine;
- the resume link: yes;
- the two font dependencies: yes;
- "Think" → "Suy nghĩ kĩ (Think)": yes;
- the new features of §13: all of them, after the frame.

Before Codex agents touch B0–B8: refresh the stale untracked `AGENTS.md` (the bundle notes it still describes the pilot edition and "no local AI").

## 15. Risks

- **Narrow stage.** With both drawers open the stage is 646 px. Per-module `minStageWidth` and the overlay rule cover it, but each chemistry view needs a measured minimum.
- **Board width.** The 920 px board may fold `toolbarFit` names, and `board.spec` requires names at 1366×768 and 1366×640. Measure in B7; if they fold, the conversation column drops to 406 and the board grows to 960.
- **Re-stepped chart colours.** They shift 3D role colours. The 3D ΔE_OK ≤ 0.02 post-fx check and the terrain ΔE ≥ 0.15 checks must be rerun in B0.
- **CI time.** Spec copies roughly double E2E time for migrated screens until B8.
- **Drawer resize.** The one-resize-after-transform approach must be measured on the AMD 780M (simulations only, never Gemma) and in WebView2.
- **Dark frame in the light theme.** This is a taste call; get a quick owner look at B0 tokens before B1.

Contrast, ΔE and colour-vision numbers are checked by `src/app/theme/tokens.test.ts` (bench contrast table, data-colour pairs, terrain) and the 3D look tests (`recipes.test.ts`, `division3d/looks.test.ts`).

Not checked: the native WebView2 window height, the board toolbar width, real font bundle size, and whether JetBrains Mono has subscript digits. #107 and #108 merge status comes from local refs that were not re-fetched. I did not build a mock-up, and the pixel sizes are planned, not measured.
