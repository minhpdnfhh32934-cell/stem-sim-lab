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
