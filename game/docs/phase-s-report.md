# Phase S report — the game's sound

Contract: `docs/phase-s-sound-contract.md`. One section per step (S-1, S-2, S-3).

## 1. S-1 — the sound engine, settings, the interface, footsteps, doors, the rooms' air (2026-11-05)

Contract: `docs/phase-s-sound-contract.md` (approved by Phú, all (a): CC0 only, 3D sound, sources
without sign-in, three steps). Phú: the sound files live in the game, so it runs on another machine
with nothing to download.

- **Engine** (`src/platform/audio/AudioView.ts`, Web Audio, the only code that makes sound): buses
  master / effects / room / interface at the settings' volumes; sounds of the world heard from where
  they are (HRTF panner, inverse distance, not played past their reach) and in the room's reverb
  (a convolver; its impulse made in code from the room's size by Sabine's formula with α 0.2 — an
  estimate: bathroom 0.30 s, corridor 0.51 s, a lab 0.90 s, the hub 1.96 s); the room's air loops
  and fades into the next room's (1.2 s); at most 32 voices; a take at random, never the same twice
  in a row, its pitch spread per sound. Paused: the world's sounds silent, the interface's kept;
  window hidden: the engine suspended. Per frame only the listener follows the eye.
- **When and where** (`cues.ts`, testable without a sound card): card reader beep (accepted at the
  reader where the card is tapped, refused when the entry's rules refuse the door), the sliding
  leaf's motor and seal (opening, closing, closed), hinged leaves (the latch as it opens; as it
  shuts, after its swing), switches, footsteps, task step and task chimes, a refusal's buzz, menu
  clicks. A scene's loading is silent (its doors and switches set without a click).
- **Footsteps**: a `Gait` (`gameplay/player/gait.ts`, `GaitSystem` after physics) gives the walk's
  speed and phase; a foot is heard where the swing is widest, to its side of the feet, louder when
  running, never shuffling (< 0.35 m/s); the body's legs now swing by the same gait (BodyView no
  longer keeps its own). Rooms gain `floor` (vinyl, wood, tile, stone, concrete) and `ambience`.
- **Bank** (`content/sounds.json`, Zod, `bank.ts`): 20 sounds — 5 recorded (16 files), 15 made in code
  (`synth.ts`: tones, filtered white/pink/brown noise, a fan's swell; seeded, deterministic, loops
  crossfaded at the seam). Levels measured: no recipe clips (peak < 0.999), each audible.
- **Files** (`public/audio/`, 228 KB, copied into `dist/` by the build; nothing fetched from
  outside the game at run time): Kenney "Impact Sounds" (footsteps on concrete and wood) and "RPG
  Audio" (hinged doors), both CC0, downloaded with Phú's permission (the zips 0.80 MB and 0.96 MB,
  kept outside the project; only the 16 files used are in it). `public/audio/CREDITS.md` names each.
- **Settings**: master 80 %, effects 100 %, room 70 %, interface 70 %, a mute; browser preferences
  (`simlab.settings.volume.<bus>`, `simlab.settings.muted`), never in the save; with Vietnamese.
- **Loading**: the engine, its bank and the sound's settings are a chunk of their own (`AudioView`,
  19.8 KB), fetched at the first click or key (`AudioLoader`) — the moment a browser lets a page make
  sound; the settings get the sound's section then. The very first click is therefore silent.
- **Menu JS guard**: the menu reached 502,020 B (it was already near 500,000 before this step: the
  sound adds about 3 KB to it). Phú (2026-11-05): "the size is not limited" — the guard raised to
  600,000 B (still a three.js regression guard: three.js adds ~470 KB).

SPEC DEVIATION / limits:

- Vinyl and tile floors use the concrete takes (vinyl quieter): no CC0 recording on those floors
  found yet without an account — candidates for Phú to download from Freesound later (D3).
- The cleanroom's sliding door, the card reader, switches and the rooms' air are made in code (a
  motor's hum and the leaf's air, filtered noise): plausible, not recorded.
- The hinged-door recordings (RPG Audio, wooden doors) are used for the wardrobe, the cabinets and
  the washroom door alike.
- A sound from another room through a closed door is not muffled yet (S6): nothing in S-1 is heard
  from another room; it comes with S-3 (equipment).
- The reverb switches at a doorway without a crossfade (`shortcut:` in AudioView).
- No save chime: the game only autosaves (a chime on each would be noise).
- thầy cannot hear: tests prove a sound starts, when, where and how loud in samples; whether it
  sounds right is Phú's QA by ear.

Verification: `npm run check` PASS (193 files, 3155 passed, 1 skipped). `npm run build` PASS.
e2e `sound.spec.ts` alone PASS (headless Edge: engine running, the preparation room's air playing,
footsteps on vinyl, the settings kept, every audio file from the game's own origin).
Full e2e (`npx playwright test`, with this step and §18.4 of the labs report): 93 passed, 2 failed —
both production specs, which pass alone (`--project=production`: 3/3); flaky in full runs as
before, not counted as passes.

Not done in S-1: Phú's QA by ear; the entry procedure's sounds (S-2) and the lab equipment's (S-3).
Committed at Phú's request (2026-11-05) in dc3a234, before the QA by ear, which is still to be
done.

## The opening's sound (2026-11-14)

Phú: "Âm thanh khởi động đã có chưa, nếu chưa thì làm đi" — there was none: the app's opening
(`AppIntro`, the emblem and SIMLAB) was silent, and the menu's music begins at the first click.

- `src/platform/audio/opening.ts`: the opening's own sound, made in code, in the menu music's key
  (D major) and on the opening's picture — air rising as the rings spin in (0.1–1.9 s), a swish and
  a quiet glide up with the ball's flight (1.05–2.2 s), a bell where it lands (2.2 s) with the
  menu's first chord (Dmaj9) under it, a run of small bells as the light sweeps across the name
  (2.95 s, a letter each 0.07 s), the chord ringing into the menu (to 6.5 s), in a 2.4 s hall.
  `OPENING` is the score (data), `scheduleOpening` puts it on any context's clock, `playOpening`
  plays it at the player's master × music volume (nothing when muted or at 0).
- `AppIntro` starts it; skipped (a click or key), it fades with the picture; run its course, the
  chord rings on into the menu. With reduced motion it starts at the landing.
- Browsers allow no sound before the first click unless told otherwise: the opening plays only
  when the browser lets it, else it stays silent (its context closed after 600 ms, no error). The
  desktop app (`scripts/desktop-app.ps1`) now starts Edge with
  `--autoplay-policy=no-user-gesture-required`, so it plays there; in a browser tab it usually
  does not.
- Menu JS: +5,437 B (863,183 → 868,620 B, the production spec's count).

Checks:

| Check                                                                                                                                                                                                                      | Result                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint src/platform/audio src/platform/ui/AppIntro.ts`, `npx prettier --check src scripts e2e docs`                                                                                          | PASS                                                                                                                                                                                                                                                                                   |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                            | PASS — 323 files, 4143 tests (`opening.test.ts`: in D major, never past full scale at full volume)                                                                                                                                                                                     |
| Headless Edge, dev server, `?intro=1`, AudioContext recorded (scratch script)                                                                                                                                              | with `--autoplay-policy=no-user-gesture-required`: running at once, 37 oscillators and 2 noise sources scheduled, closed after; without: suspended, closed, nothing scheduled; no console warning or error in either                                                                   |
| The same score rendered offline (OfflineAudioContext, 48 kHz, default volumes 80 % × 70 %)                                                                                                                                 | peak 0.274 (at the landing, 2.0–2.5 s: −24 dB RMS); silent after 6.5 s                                                                                                                                                                                                                 |
| `SIMLAB_DEV_PORT=5197 SIMLAB_PREVIEW_PORT=5196 npx playwright test e2e/intro.spec.ts e2e/play-menu.spec.ts e2e/sound.spec.ts e2e/renderer.production.spec.ts --project=dev --project=production --workers=1` (SwiftShader) | 5 PASS; 2 FAIL `renderer.production.spec.ts`, both also failing at HEAD aa0504c (run with this change's `AppIntro` taken out): the menu JS is over the 600,000 B guard (863,183 B at HEAD), and the failed-download test looks for the menu's SIMLAB heading on the Single player page |

Left: whether it sounds right is Phú's QA by ear (thầy cannot hear); the menu JS guard and the
failed-download test are out of date since before this step (not changed here).

## Entering a world (2026-11-14)

Phú: "thêm âm thanh cho khi vào phòng chơi nữa" — the entering transition (EnterTransition: a LAN
room or a solo world, the portal, then the white light onto the world) was silent.

- `WorldEntry` (GameEvents): the menu says when the portal opens and when the world is shown;
  `SoundCues` plays `enter-portal` (a rumble swelling, a tone gliding up an octave from D2, a rising
  whine, the streaks' air, a chime as the screen is covered; 1.9 s) and `enter-arrive` (the white
  light's whoosh, a low thump as it clears, a D major chord blooming into the world; 2.4 s), both made
  in code (`sounds.json`), on the interface bus.
- Levels (renderSynth): peak 0.748 and 0.797 (at the default master 80 % × interface 70 %, 0.29 and
  0.38 heard); the bank test checks no sound made in code clips.
- The very first click of a session loads the sound engine: a world entered with that click has
  no portal sound (the arrival is heard).

Checks: `npx vitest run src/platform/audio src/content` PASS (39 tests: `cues.test.ts` the two cues
on `WorldEntry`; `bank.test.ts` levels); the full checks are in `docs/phase-c-report.md` §11 (same
run). Whether they sound right is Phú's QA by ear.

## Two fixes (2026-11-18)

- **The volume sliders and the opening's sounds.** The emblem opening's chord (`audio/opening.ts`)
  and the rocket opening's roar (`audio/rocketSound.ts`) play in audio contexts of their own,
  before the game's mixer starts. They read the volumes once, at their start, so a slider moved
  while they played changed nothing. Both now take `volume(master, bus, muted)`; the main menu
  passes every `AudioSettingsChanged` to them (the live menu forwards it to the roar). The menu's
  music was already following the sliders: measured in the browser pane, Music or Master at 0 %
  brings the output to 0 (RMS 0.061 → 0.000), back up at 80 % (0.058).
- **Two sirens at once on a call to the police (113) or the brigade (114)** (Phú). The fire's
  cues counted down all four beats, the siren's too, and the call counted the siren's down again:
  its cycle came twice as fast, and a new siren started while the last still sounded. The fire
  now counts only its own three. Test in `cues.test.ts` (it failed before the fix: 4 sirens where
  3 fit).
- Checks: `npx tsc --noEmit -p .` PASS, `npm run lint` PASS, `npx prettier --check .` PASS,
  `npx vitest run --maxWorkers=6` PASS (338 files, 4218 tests). Not heard in the desktop app.
