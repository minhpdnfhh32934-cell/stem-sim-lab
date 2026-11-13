# Phase S contract — the game's sound (2026-11-05)

Status: **APPROVED** by Phú, 2026-11-05, with the decisions of §12; built in three steps (D4),
each with Phú's QA by ear and a commit. Step S-1 first.
Request (Phú, 2026-11-04): "add sound to the game — every sound, not only some for show". Already
decided by Phú (2026-11-05): mixed sources, recorded sounds for physical things and sounds made in
code for beeps, hums and the interface; the sound files live inside the game (in the repository),
so that the game can be copied to another machine and run there with nothing to download.

## 1. Objective

Everything the player does or sees happen has the sound it has in a real lab, where it comes from:

1. **The player.** Footsteps by floor (vinyl, epoxy, tile, the hub's floor), walking and running,
   crouching; the coat's rustle as it is put on and off.
2. **Doors and rooms.** The card reader's beep (accepted and refused), the cleanroom's sliding
   doors and air lock, hinged doors, wardrobe and cabinet doors, light switches.
3. **The entry procedure.** The tap turned on and off and the water running (on the basin, on the
   hands), the soap pump, the sanitizer, paper towels pulled and crumpled, the waste bin's lid,
   gloves pulled out, pulled on and snapped at the cuff, peeled off; goggles and the face shield
   set on.
4. **Lab equipment.** Objects picked up and set down, by material (glass, plastic, metal, wood);
   knocks and falls by impact speed (a tap, a clink, a drop on the floor); a ball's bounce; pouring
   that follows the flow rate; drops from a dropper or a burette; the burette's stopcock, stoppers,
   clamps; instruments (balance, pH meter, colorimeter: buttons, beeps when a reading is ready);
   dials; the experiment apparatus (pendulum release, the free-fall ball's release and landing,
   the launcher, the trolley on its track).
5. **Rooms.** A sound for each room's air: the cleanroom's ventilation, the fume hood's fan, a lab's
   hum, the hub; muffled through a closed door, heard through an open one.
6. **The interface.** Menu clicks, a task step done, a task complete, an action refused, a save,
   a notice.
7. **Settings.** Master, effects, room, interface volume and a mute, in the main and pause menus;
   sound paused with the game.

## 2. Scope

| #   | Part         | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Engine       | `src/platform/audio/`: an `AudioView` on the Web Audio API (the only code that makes sound). One `AudioContext`, started at the first click (browsers forbid sound before one); buses master, effects, room, interface; a pool of at most 32 voices (the quietest and farthest give way); the listener at the camera. Positional voices (HRTF panning, distance roll-off) for anything in the world; a room's reverb from its size (an impulse response computed in code, not downloaded).                                                                                                                                                             |
| S2  | Sound bank   | `src/content/sounds.json` (data, Zod): each sound's id, its files (several takes, one chosen at random, never twice in a row), volume, pitch spread, bus, distance range. Core sounds (interface, steps, doors) with the core content; lab sounds in the lab pack, loaded with it.                                                                                                                                                                                                                                                                                                                                                                     |
| S3  | Files        | `public/audio/<group>/<name>.ogg` (Ogg Vorbis, mono for positional sounds, 44.1 kHz), committed in the repository: `npm run build` copies them into `dist/`, nothing is fetched from the internet at run time. `public/audio/CREDITS.md` names each file's source, author, licence and link.                                                                                                                                                                                                                                                                                                                                                           |
| S4  | Made in code | Beeps (card reader, instruments, timers), clicks, the interface's sounds, ventilation and fan noise (filtered noise), the lab hum: generated by Web Audio at start, no files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| S5  | Hooks        | Sounds start from what already exists: game events (doors, equipment, set-down, pours, tasks, procedures, experiments, refusals, saves); entity states for what lasts (the water running, a fume hood on); action keys for what the hands do (`actions.json` keys gain `sound`, played at that key's moment, where the hand is). New data: a room's `floor` (a surface) and `ambience`; an item's `sound` (what it is made of: glass, plastic, metal, wood, paper, cloth). New events: footsteps (`Footstep`, from the player's walk, the body's stride) and impacts (`ObjectImpact`, from Rapier's contact forces, in `src/physics`, with the speed). |
| S6  | Rooms        | A sound from another room passes only through an open door (closed: quieter and muffled).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| S7  | Settings     | Four volumes and a mute, a browser preference (`simlab.settings.audio`), never in the save; with their Vietnamese; the sound pauses with the game and when the window is hidden.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| S8  | Tests        | Every sound id used by data exists; every file in the bank exists and is in `CREDITS.md`, every file in `public/audio` is used; events and keys start the right sound (a fake output in tests); the voice limit; e2e: the context runs after the first click, sounds start on a door, a step, a set-down, a pour (counted through the debug panel), and nothing is fetched from outside the game's own address.                                                                                                                                                                                                                                        |

## 3. Non-goals

- Music, voices or narration, sound for things that do not exist in the game.
- Any change to an experiment's model or measurements: sound follows what happened, never adds
  information (a "reading ready" beep only when the reading is ready).
- Simulated acoustics beyond a reverb per room and muffling by doors.

## 4. Constraints

- Architecture: Web Audio only in `src/platform` (as three.js); gameplay and physics publish events
  and state, never play sound; data validated with Zod; no code branches on a sound or content id.
- Licences: only sounds whose licence allows using and redistributing them in the game (§11 D1).
  Every download is asked of Phú first: the file, its page, its licence, its size.
- Size: files are loaded when they are needed (lab sounds with the lab pack); the menu's JS guard
  (500,000 B) is unaffected (sound files are not JS). Expected total about 10–20 MB.
- Performance: no allocation per frame (voices pooled, nodes reused); the audio thread is the
  browser's own; frame time A/B on the GPU before and after (High, every lab).
- Honesty: thầy cannot hear. Tests prove that a sound starts, when and where; whether it sounds
  right is Phú's QA by ear, as the display QA is by eye.

## 5. Risks

- Sources that need an account (Freesound): thầy cannot sign in; such files would be downloaded by
  Phú (§11 D3).
- Sounds that repeat (steps, clinks) get tiring: several takes, pitch spread, never the same take
  twice in a row.
- Too many sounds at once (a dropped tray, a pour while walking): the voice pool and a per-sound
  limit.
- Headless e2e has no sound card: e2e counts started voices, it does not listen.

## 6. Tests and verification

`npm run check`; full `npx playwright test`; GPU A/B; Phú's QA by ear on their own speakers or
headphones after each step.

## 7. Rollback

Each step is one commit series after QA; the sound can be muted in settings at any time.

## 11. Decisions for Phú

- **D1 — licences.** (a) **Recommended:** CC0 only (free to use, nothing to credit, no conditions).
  (b) Also CC-BY (credit the author on a credits screen).
- **D2 — where a sound comes from.** (a) **Recommended:** 3D (HRTF): heard from its side and
  distance, best with headphones; a reverb per room. (b) Left/right panning only.
- **D3 — sources needing an account (Freesound).** (a) **Recommended:** thầy uses sources that need
  no sign-in (Kenney, OpenGameArt, others found CC0); for what is missing, thầy lists exact
  Freesound links and Phú downloads them into a named folder. (b) What is missing is made in code.
- **D4 — order.** (a) **Recommended:** three steps, each with Phú's QA by ear and a commit: **S-1**
  engine, settings, interface, footsteps, doors, room sounds; **S-2** the entry procedure (water,
  soap, towels, gloves, coat, PPE); **S-3** lab equipment (objects, impacts, pouring, drops,
  instruments, apparatus). (b) All in one delivery.

## 12. Decisions (Phú, 2026-11-05)

1. D1 (a): CC0 sounds only.
2. D2 (a): 3D sound (HRTF), a reverb per room.
3. D3 (a): sources that need no sign-in; for what is missing, exact Freesound links that Phú
   downloads.
4. D4 (a): three steps — S-1 engine, settings, interface, footsteps, doors, room sounds; S-2 the
   entry procedure; S-3 lab equipment — each with Phú's QA by ear and a commit.
