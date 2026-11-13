# Phase F — furniture, the hub laptop and its books, one world for a LAN room

Phú asked (2026-11-11, while E-2b was under way), all to be built and self-checked without
questions: the hub's benches to sit on; the Physics Lab's sink to wash hands at and its cabinet to
open and fill; a bed to lie on and sleep (a "zzz" rising from the head, growing and fading), woken
with a start when hit; the same in the teacher's room; a gaming laptop on the hub's desk (lights,
vents, the look of a ROG Strix G16) that starts up with a SimLab intro and shows nine books —
Physics, Chemistry and Biology for grades 10, 11 and 12 — each lesson laid out like a textbook but
friendlier; and for LAN rooms: the other player sees one's lab coat and what one does (what is
held, the hands at work), objects thrown at someone hit them (their screen flashes red), nobody
walks through anybody (the teacher neither), what one does at a simulation the others see, and the
teacher is shared — the others see him teach someone else, hear him nearby, see his board, and wait
until he is free. Also: why the city below the hub was not drawn, and whether the game as an APK on
other computers of one network could play together.

## F-1 — furniture to use, being hit

- **Sitting** (`gameplay/player/RestSystem.ts`, item `rest` spots): E on a hub bench (`hub-bench`,
  three seats) or a chair sits on the free seat nearest the player, facing away from the seat
  towards where they stood; the view drops to a seated eye (0.74 m over the seat). A move key or E
  gets up, the view easing back up (0.6 s). No walking while seated.
- **Lying and sleeping**: E on a bed lies down (the view at the pillow, looking up); after 4 s the
  player is asleep: the screen dims and "z z Z" rises over it. A hit (below) wakes them with a
  start (the rise begins part-way, quicker). E or a move key gets up.
- **Being hit** (`gameplay/player/HitSystem.ts`): an object thrown (`ObjectReleased` "throw") is
  followed for 3 s; reaching the player's body faster than 1.5 m/s (and 0.35 s after leaving the
  hand, so a thrower cannot hit themself) it hits once: `PlayerHit`, the screen flashes red
  (`.hud-hurt`), a sleeper wakes.
- **Sinks** (`teacher-sink`: the Physics Lab's and the teacher's bathroom's): the tap (E) runs
  water; "Wash hands" (an action acted out, 3.3 s) is refused until the water runs. **Cabinets**
  (`teacher-cabinet`: the Physics Lab's two and the teacher's room's) open on hinges (E) and take
  objects set into them, as the reagent cabinets do. Beds and chairs: the preparation room's and
  the teacher's room's.

## F-2 — the hub laptop and its nine books

- **The laptop** (`hub-laptop`, prop `gaming-laptop` in `platform/render/props/laptop.ts`) on the
  reception counter: a dark gunmetal deck and lid (open at ~108°), the keyboard with a numpad, a
  touchpad, hinge, vent grilles on the back and sides, rubber feet; at Ultra the small parts (screws,
  ports, finer grilles). `platform/render/laptopView.ts` lights it: the screen shows the SimLab
  lock screen ("Press E to use it"), the RGB light bar along the front runs through the colours,
  the keyboard's backlight follows it (dimmed). **No maker's logo** — the look is a gaming laptop of
  that class, not a copy of a trademark.
- **Start-up** (`platform/ui/LaptopView.ts`): E opens the laptop full screen: a 5.6 s intro — a
  dark grid, a glow, the SimLab atom emblem drawing itself with electrons in orbit, the letters
  SIMLAB arriving one by one, a light sweep, the tagline, a progress bar — then the desktop. A click
  or Space skips it; with reduced motion it is 1.2 s.
- **The desktop**: three columns (Physics, Chemistry, Biology), each three files (grades 10, 11,
  12), a taskbar with the clock and a Close button. Esc steps back (book → desktop → game).
- **The books** (`src/content/books/<subject>-<grade>.json`, `content/books.ts`, loaded only when
  opened): table of contents by chapter; each lesson a page — a hook ("Did you know?"), sections,
  formulas written as a teacher writes them (`formulaNodes`), a worked example, a tip, "Remember",
  a self-check with a hidden answer, and where the lab has it, "Try it in SimLab: <experiment>".
  Physics 34 + 26 + 25 lessons, Chemistry 17 + 19 + 22, Biology 26 + 29 + 35 (233), following the
  Vietnamese 2018 curriculum's grade topics. Written by three agents (one per subject) from the
  curriculum and checked here for shape (`books.test.ts`); **SPEC DEVIATION:** the books are in
  Vietnamese only (the game's other content is English with Vietnamese); a translation is a
  separate job. Lesson numbering follows one textbook series where it was known; some chapter
  reviews were left out.

## F-3 — one world for a LAN room

What the others see and share, on top of Phase M's poses and station commands:

- **The pose carries more** (`protocol.ts` `PoseSchema`): where the player looks (`pitch`), what
  they wear (`gear`: item ids), what their hand holds (`held`: an item id, the phone as "phone"),
  seated, lying or asleep (`rest`, with the seat or pillow and the facing in `restAt`) and the
  action their hands act out (`act`). Sent as before (15 Hz, again only when it changed).
- **Drawn** (`platform/render/remotePlayers.ts`): their lab coat, goggles, face shield and gloves
  as worn (`Actor.wear`); what they hold, in the right hand, its size and colour, the arm held out
  (the phone: the actor's own phone gesture); hands at work during an action; seated on the seat
  (raised or lowered to its height); lying on the bed on their back; asleep, three "Z"s rising from
  the head, growing and fading.
- **Nobody walks through anybody** (`Peers` → `PhysicsSystem.placeAgent`): each other player
  resident here has a kinematic capsule like the teacher's; the player is stopped by it, thrown
  objects bounce off it. (The teacher has had one since Phase Y.)
- **Throwing at someone** (`HitSystem` dep `others`, room event `hit`): an object this player throws
  that reaches another player's capsule faster than 1.5 m/s — seen each frame, or by physics' own
  impact beside them (every step: a fast object bouncing off between two frames) — hits them at
  once (no wait after the throw: it cannot start inside them); their game is told
  (`PeerHit` → event → their `PlayerHit`): the red flash, a sleeper waking. What they throw flies
  in the others' games too (`throw` event: a box of its size and colour on its ballistic path,
  coming to rest on the floor, gone after 2.5 s; it touches nothing there).
- **The same world state** (`state` events, `SHARED_STATE_KEYS`): doors and cabinets open, taps
  running, lamps and switches, the circuit benches' boards (`CircuitSystem.adopt`: a part they plug
  in leaves this world; one they take off comes back to its shelf), fires lit and put out
  (`FireSystem.adopt`; each game grows its own fire), parts broken, soot. A state set because
  another player set it is not sent back. Stations (experiments) were already shared (Phase M).
- **The teacher is shared** (room event `npc`, lock `npc:<id>` on the server):
  - The game whose player talks with him, is followed by him, has him lecture, teach at a board or
    work on a test drives him (`NpcSystem.engaged`) and sends him 8 times a second: where he is and
    what he does (`snapshot`), the line he says, the board as written when it changed. Done, it
    frees him (`npcFree`).
  - The other games draw him as it says (`NpcSystem.mirror`, `mirrorBoard`): walking, pointing,
    writing on the board — the board's letters appear as he writes them. Talking to him is refused
    with "Mr. Quang is helping {name} now: wait until he is done." When he is free he walks back
    to his day from where he is, and anyone can ask him again (an explanation, a test).
  - **Overheard** (`platform/ui/OverheardView.ts`): within 12 m in the same scene, his lines to
    someone else are shown at the bottom ("Mr. Quang, to An") and read aloud with the teacher's
    voice, quieter with distance.
- **Checked**: every event is checked with Zod in the server and in each browser; the server
  relays the events and keeps the teacher's lock (only who holds it may drive or free him).

## F-4 — touch controls on phones and tablets

Phú asked (2026-11-12): the game should know what it runs on — a computer stays as it is; a phone
or tablet gets buttons to play with.

- **Which device** (`platform/device.ts`, unit tested): a touch screen first — the finger as the
  main pointer with no hover, or a mobile browser with a touch screen (an iPad says it is a Mac,
  but its pointer is coarse) — is a phone (shorter screen side under 600 px) or a tablet; anything
  else is a computer, a laptop with a touch screen too. `?device=phone|tablet|computer` in the
  address overrides it (to try the controls on a computer, or turn them off). The page's
  `<html data-device>` and the debug panel's `Device:` line say which.
- **The controls** (`platform/ui/TouchControls.ts`, phones and tablets only): a stick under the
  left thumb (where the thumb comes down; pushed to its edge it runs), a drag anywhere else turns
  the view (1.6 × a mouse's move), buttons on the right — E Use, Throw, F More, Q Put away/take
  out, R Pour and C Closer (held as long as the finger stays) — and along the top — Bag, Tasks,
  Explain, Phone, Pause; the hotbar's slots are tapped. With the phone out, a keypad dials (0–9,
  Delete, Call). They press the same actions as the keys (`InputState`): nothing else in the game
  changed. Smaller on a phone; a phone held upright is asked to turn sideways. Hidden while paused,
  on the menu and while a panel is open (panels are tapped as they are).
- **No mouse capture on touch**: `BrowserInput` never asks for pointer lock there (the game never
  pauses for a freed mouse), and the "click to capture" hint is hidden. The debug panel (dev
  builds) starts hidden on a touch device — no F3 there; `?debug=1` shows it.

Results (F-4):

| Command                                                                                                                           | Result                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npx playwright test e2e/touch.spec.ts e2e/controls.spec.ts e2e/pause.spec.ts e2e/pointer-lock.spec.ts --project=dev --workers=1` | 7 PASS (touch: phone and computer; controls; pointer-lock; pause but one), 1 FAIL (below) |
| `npx playwright test e2e/pause.spec.ts --project=dev --workers=1 -g "picture stands still"`                                       | PASS                                                                                      |

The paused-draw test fails when SwiftShader offers fewer than ~20 frames a second (27 in 2 s
here): drawn at 20 Hz then means every frame. It failed twice in loaded runs and passed alone:
flaky, not a clean PASS. `e2e/touch.spec.ts` drives the controls with the mouse's pointer events
(Edge under Playwright has no touch screen) at a phone's landscape size with `?device=phone`.

Looked at in the browser pane: at 844 × 390 with `?device=phone`, the controls laid out; the stick
walked 1.28 m in 1.5 s, a 150 px drag turned the view 34°, the keypad dialled 114 and rang. With
the pane's Mobile preset (375 × 812, Android, touch), the device was found to be a phone without
the address override, the debug panel hidden, and "Turn the device sideways to play." shown.
Not tried on a real phone or tablet.

Limits (F-4), since lifted by F-5 below: an eight-direction stick, no gyroscope, no gamepad, the
keypad over the task panel, no look setting. Performance on phones is unmeasured (the graphics level is
fitted to the machine as on a computer).

## F-5 — look sensitivity, tilt to look, an analog stick, gamepads

Phú asked (2026-11-12): the sensitivity adjustable, for the computer too; the tilt sensor; and
the rest of F-4's gaps done.

- **Look sensitivity** (Settings → Controls, every device): 0.25× to 3× in nine steps (× the
  configured 0.0025 rad a pixel), for the mouse, a finger's drag and a gamepad's stick alike
  (`PlayerSystem` dep `sensitivity`). A browser preference (`simlab.settings.lookSensitivity`),
  apart from every save, like the language.
- **Tilt to look** (phones and tablets; Settings → Controls): the gyroscope's turn rates
  (`devicemotion` `rotationRate`), integrated between readings, turn the view as far as the device
  turned (`platform/tilt.ts`): about the screen's up axis turns, about its right axis looks up or
  down, for the screen upright or turned either way (`screen.orientation.angle`; `tiltTurn`, unit
  tested), added to the finger's drags. Its own sensitivity (0.25×–3×) and "Reverse the tilt". Off
  by default. iOS asks for the sensors from the tap that turns it on. **The browser gives the
  gyroscope only to a secure page** (https, or localhost on the device itself): opened over the
  LAN address (`http://192.168…`) the switch is disabled and says why.
- **The stick is analog**: the touch stick and a gamepad's left stick walk as fast as they are
  pushed (`InputState.stickX/stickY`; past the dead zone up to walking speed), the touch stick runs
  at its edge. Pushing it gets a seated or lying player up, as a walking key does.
- **Gamepads** (`platform/gamepad.ts`, any device, the browser's standard layout): left stick walks
  (pressed in, or LB, runs), right stick looks (2.6 rad/s at 1×), A use, B more, X put away, Y bag,
  RT throw, LT look closer, RB pour, d-pad left/right the hotbar, up the phone, down Explain, View
  tasks, Start pause and resume. Listed in Settings → Controls. Menus and panels still want the
  mouse or a finger.
- **The phone's keypad on a phone** no longer lies over the task panel: the panel steps aside
  while the keypad is out.
- `InputState` gained `turnYaw/turnPitch` (radians, for the gyroscope) beside the look deltas.

Results (F-5):

| Command                                                                                                                                                                         | Result                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`                                                                                                                                                              | PASS                                                                                                                                       |
| `npx eslint .`                                                                                                                                                                  | PASS                                                                                                                                       |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                                                                      | PASS                                                                                                                                       |
| `npm run test`                                                                                                                                                                  | PASS — 308 files, 4012 tests (a first run had 1 FAIL: `Game.test` listing the read warnings did not yet list the four new settings; added) |
| `npx playwright test e2e/touch.spec.ts e2e/settings.spec.ts e2e/game.spec.ts --project=dev --workers=1`                                                                         | 9 PASS, 1 FAIL (the computer's sensitivity check read the view before the panel caught up: test fixed)                                     |
| `npx playwright test e2e/touch.spec.ts --project=dev --workers=1 -g "computer"`                                                                                                 | PASS                                                                                                                                       |
| `npx playwright test e2e/touch.spec.ts e2e/settings.spec.ts e2e/controls.spec.ts e2e/pointer-lock.spec.ts e2e/game.spec.ts --project=dev --workers=1` (stopped part-way by Phú) | the 6 that ran first PASS (controls, pointer-lock, settings ×4); the rest cut off, rerun above                                             |

Unit tests: `platform/tilt.test.ts` (the turn mapping upright and turned both ways),
`platform/gamepad.test.ts` (dead zone; half a push walks half as fast; the right stick turns 2.6
rad/s, twice as far at 2×; LB and the pressed stick both run; Start pauses and resumes; a pad
unplugged lets go; a gyroscope's turn turns once), `Game.test` (the look settings kept apart from
saves, a bad stored value falling back). E2E (`e2e/touch.spec.ts`): on a phone, tilt switched on
in the pause menu's settings and synthetic gyroscope readings turning the view left; on a computer,
the sensitivity slider at 2× doubling the mouse's turn, and no tilt switch.

Not tried on a real phone, tablet or gamepad: the gyroscope's directions are from the spec's axes
(hence "Reverse the tilt"), and the pad's from the standard layout.

## F-6 — what the others see a player doing

Phú asked (2026-11-12): in a LAN room, whether the others see a player look down at their hands,
hold the phone, do a test or talk with the teacher — then to make all of it seen.

- **The pose says what they do** (`PoseSchema.doing`, `platform/net/doing.ts`): a test paper in
  hand (`paper`), talking with a person of the world (`talk`), at a station's workspace or Explain
  view (`work`), the phone on a call (`call`) or out to dial (`dial`), looking at their own hands
  (`hands`: looking down past 0.6 rad with nothing held and no action) — the first that holds.
- **Drawn** (`remotePlayers.ts`, `body/actor.ts`): the head (and a little of the neck) follows
  their view's pitch, now drawn; `hands`: both forearms up before the waist, the palms in and up;
  `dial`: the phone before the chest in the right hand; `call`: at the ear; `paper`: a test paper
  in the left hand and a pen writing in the right; `talk`: listening, nodding; `work`: hands at
  the bench. The props are named (`phone`, `test-sheet`).

Results (F-6):

| Command                                                                                                                 | Result                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                      | PASS                                                                                                                                                                             |
| `npx eslint .`                                                                                                          | PASS                                                                                                                                                                             |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                              | PASS                                                                                                                                                                             |
| `npx vitest run --maxWorkers=4`                                                                                         | PASS — 310 files, 4016 tests                                                                                                                                                     |
| `npm run test` (all workers)                                                                                            | twice: workers ran out of memory ("Zone Allocation failed"; 17, then 6 files not run, none failed) — the machine's memory, not a test: the same files passed in the 4-worker run |
| `SIMLAB_DEV_ONLY=1 npx playwright test e2e/multiplayer-world.spec.ts e2e/multiplayer.spec.ts --project=dev --workers=1` | PASS — 3 tests (+ warm-up)                                                                                                                                                       |

Unit tests: `platform/net/doing.test.ts` (nothing; the hands looked at; holding something is not
looking at the hands; the phone dialling, then a call; a test paper; talking with the teacher),
`platform/render/body/actor.test.ts` (the head follows the view down; the phone at the chest while
dialling; the paper while doing a test; the forearms up for the hands). E2E: in the two-browser
test B sees A "doing talk" while A talks to the teacher and "holds phone doing dial" with the phone
out (`test-results/mpw-3b-dialling.png`: A's hand with the phone before the chest). The e2e's aim
helper was made sturdier (aim again until the view settles; never a click while the mouse is
captured: that throws what the hand holds).

Not drawn: the exact fingers of the looking-down hands (the pose's, not the player's own); a call
on the speaker; what is written on the paper.

## F-7 — the laptop fixed, the app's own opening

Phú (2026-11-12): the laptop's vents flickered, the keyboard's light did not cover the keyboard,
the start-up's emblem was broken; and an opening animation of the app's own — its rings spinning
in and settling into their orbits.

- **Vents** (`props/laptop.ts`): the slots' outer faces lay in the shell's own plane (back and
  sides), so the two fought for the same depth and flickered. The shell now stands 1 mm in from
  the box (`SHELL_IN`) and the slots stand out of it (still inside the item's box).
- **Keyboard light** (`laptopView.ts`): the glow was a fixed 11 cm strip, short of the first row.
  It now takes the keyboard's own layout (`laptopKeyboard`: first row to last, the left keys to the
  number pad's edge).
- **Start-up emblem** (`LaptopView.ts`): its orbits used the class `emblem-orbit`, which is the main
  menu's: the menu's rule turned them about the view box's corner (`transform-origin` 50% of a box
  from −60), flinging two orbits off to the right. They have their own classes now
  (`laptop-orbit`, `-electron`, `-nucleus`), and each comes spinning in round the nucleus and
  settles into its place before its electron sets off.
- **The app's opening** (`platform/ui/AppIntro.ts`, over the page while the game loads): the
  emblem's rings come spinning in from far and wide and settle into their orbits (the dial, its
  ticks, the inner ring; the satellite whirls round and slows to the menu's pace), the floor tape
  draws, a ball flies in on a long parabola and lands on the trajectory's top (its trail behind
  it, a ripple as it lands), the strobe images light, the letters of SIMLAB rise one by one and
  flare in turn, then it opens into the menu (≥ 3.6 s, and until the game is ready). A click, a tap
  or a key skips it once the game is ready; reduced motion gives a short still. No text but the
  name (the language is not known yet). Automated browsers skip it unless `?intro=1`; `?intro=0`
  turns it off.

Results (F-7):

| Command                                                                                                                | Result                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`                                                                                                | PASS                                                                                                                    |
| `npx eslint .`                                                                                                         | PASS                                                                                                                    |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                             | PASS                                                                                                                    |
| `npx vitest run --maxWorkers=4`                                                                                        | PASS — 310 files, 4016 tests (a first run: 1 FAIL, the vents standing out of the laptop's box; the shell inset instead) |
| `SIMLAB_DEV_ONLY=1 npx playwright test e2e/intro.spec.ts e2e/menu.spec.ts e2e/touch.spec.ts --project=dev --workers=1` | PASS — 6 tests (+ warm-up)                                                                                              |

Looked at in frames (Playwright, SwiftShader): the opening at 0.4–3.6 s and after (the rings in,
the ball's flight, the name, the menu); the laptop's start-up with the atom whole; the keyboard
glow over all the keys. Not looked at: the laptop's back after the vent fix (the shot's aim went
astray); anything on the 300 Hz display.

## F-8 — a face from a photo

Phú (2026-11-12) asked for a character face made from a photo. The player either takes the photo
with the camera or picks one. The face is read and made into the character's own. The face made
from a photo can be deleted.

Phú's choices:

- **MediaPipe** reads the photo, in the browser.
- **Colours and features** come from the photo: face proportions, hairstyle and the other
  measures. A hairstyle with no template is drawn new from its measures.
- **The photo is never kept.** Only the derived values are kept. (Changed in F-8b: a small picture of the face is now kept and laid on the head.)
- **The result may look funny** ("meme"). It need not be a likeness.

**Reading the photo**

- `characterPage/photoFace.ts` uses two MediaPipe tools, loaded the first time a photo is read:
  - the face landmarker: 478 points, with the irises;
  - the hair segmenter: how likely each pixel is hair.
- Files:
  - `@mediapipe/tasks-vision` 1.2.3, with its wasm bundled by Vite;
  - `public/models/face_landmarker.task` (3.8 MB) and `hair_segmenter.tflite` (0.8 MB).
- The photo is drawn into a canvas (longest side 768 px), read, then dropped.

**Measuring the face** (`characterPage/faceFromPhoto.ts`, pure)

- The face gets its own frame: the origin between the irises, the unit the distance between them.
  Tilting the head or the photo's size does not change the measures.
- Proportions: width, length, jaw, chin, eye size, eye spacing, nose height and mouth height. Each
  is compared with an average adult face and clamped to the schema's range.
- Colours: skin from the cheeks and forehead (hair left out), eyes from the iris ring, hair from
  the hair mask. Each is a median.
- Beard: hair over the chin, or a chin darker than 0.72 of the skin.
- Hairstyle:
  - length: how far down the sides the hair falls, in eye-to-chin lengths, on the same stops as the
    drawing;
  - fringe: how much of the forehead is hair;
  - parting: which side of the fringe covers more;
  - volume: the hair's width at the crown;
  - curl: how ragged the silhouette's edges are.
- A face turned from the camera is still read (Phú: a funny face is fine).

**The character**

- `character.ts` adds `appearance.face` (8 proportions, 1 = the drawn face), `hairDesign` (5
  measures) and the hairstyle `photo`. All have defaults, so old saves still parse.
- `BodyModel` draws the head from these proportions. The `photo` hairstyle is built from its
  measures:
  - the scalp is as full as the volume;
  - a mass round the back and sides falls to the length;
  - the fringe comes down the forehead as far as it covers and sweeps from the parting;
  - long hair gets locks framing the face;
  - curly hair gets curls over the crown.

**The customiser**

- The Face tab opens with three buttons:
  - **Take a photo**: the camera opens, shown mirrored; the photo taken is not mirrored.
  - **Choose a photo**.
  - **Delete the photo face**: gives back the skin, eyes, hair, beard, proportions and hairstyle as
    they were before the photo.
- What the face was before the photo is kept beside the character
  (`simlab.character.custom.beforePhoto`). It holds those fields, never the photo.
- New sliders: the eight face proportions on the Face tab, and the photo style's five measures on
  the Hair tab. A badly estimated face can be fixed by hand.
- Without a secure page (a LAN address over plain http) the browser has no camera. The page says
  so and points to Choose a photo.
- All the new words are in Vietnamese too.

Results (F-8):

| Command                                                                                                                              | Result                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`                                                                                                              | PASS                                                                |
| `npx eslint .`                                                                                                                       | PASS                                                                |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                           | PASS                                                                |
| `npx vitest run --maxWorkers=4`                                                                                                      | PASS — 311 files, 4025 tests                                        |
| `SIMLAB_DEV_ONLY=1 npx playwright test e2e/face-photo.spec.ts e2e/character-page.spec.ts e2e/menu.spec.ts --project=dev --workers=1` | PASS — 6 tests (+ warm-up)                                          |
| `npm run build`                                                                                                                      | PASS: the wasm (14.7 MB, 4.2 MB gzip) and the models are in `dist/` |

**What the tests cover**

- `faceFromPhoto.test.ts` uses synthetic landmarks, pixels and a hair mask of another size. It
  checks:
  - the average face gives 1;
  - a wider face is wider, and extremes are clamped;
  - a rolled head gives the same proportions;
  - skin and eye colours;
  - no mask;
  - hair length near the jaw-to-shoulder stops;
  - fringe and parting;
  - beard.
- `e2e/face-photo.spec.ts` runs the real app and the real MediaPipe. The photo is the preview's own
  drawn head, shot at 3× and chosen as a file; no photo of a real person is bundled. The spec
  checks:
  - a face is found and the character is made (`hair: photo`, proportions changed);
  - what is saved holds no image;
  - Delete gives back proportions of 1 and the previous hairstyle, and clears the kept fields.

Looked at in frames (SwiftShader): the drawn head before, and after it was made from its own photo.
That face came out as: skin `#e7bf9e`, hair colour exact, eyes 1.2×, curl 1, length 0.48. The
spiky top read as curls, and the short sides read as jaw length (a funny face, as Phú allowed).

**Not verified**

- A photo of a real person.
- The camera itself: getUserMedia is not exercised in e2e.
- The average-face constants (`AVERAGE`) are estimates from common adult measures, not fitted to
  photos.
- The parting's side relies on the drawn head facing −z (checked in code, not in a frame).
- Nothing was looked at on the 300 Hz display.

## F-8b — the photo laid on the face

Phú (2026-11-12, after F-8): the face should be the photo's own, as it is, or the photo put on the
character's face. A drawn head cannot be made into a likeness by its measures, so the photo's face
is laid on the head. This replaces F-8's "the photo is never kept": a small picture of the face is
now kept with the character.

**The picture**

- `photoFace.ts` cuts a 128 × 128 JPEG of the face from the photo.
- It is turned and scaled so that the irises and the mouth land on fixed places in the picture
  (`FACE_PICTURE`; the placement is `picturePlacement`, a three-point fit).
- Its quality steps down until it fits 10 000 characters, so a LAN room's message (16 000) carries
  it.

**The character**

- `appearance.facePhoto` holds the picture, as a JPEG data URL. It is checked by its schema.
- It is kept wherever the character is: in the browser, in the save, and with the others in a LAN
  room. Delete removes it.
- No save version change: the field is optional and old saves parse as they were.

**Drawing it** (`body/facePhoto.ts`, `BodyModel`)

- The picture is laid over the face as a fine grid on the head's surface (`head.grid`).
- Its eyes sit on the drawn eyes' places and its mouth on the mouth's, so every head shape takes it.
- It fades into the skin round an oval.
- It is lit as the skin is, and hidden until it has loaded.
- Under it, the drawn eyes, brows, lashes, mouth and blush are left out. The nose and the head's
  shape stay.
- The skin, hair and proportions still come from the photo (F-8), so the edge of the picture meets
  a skin of its own colour.

Results (F-8b):

| Command                                                                                                                                                      | Result                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `npx tsc --noEmit -p .`                                                                                                                                      | PASS                                                                     |
| `npx eslint .`                                                                                                                                               | PASS                                                                     |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                                                   | PASS                                                                     |
| `npx vitest run --maxWorkers=4`                                                                                                                              | PASS — 311 files, 4026 tests (before the RoomHub test below)             |
| `npx vitest run src/multiplayer/RoomHub.test.ts`                                                                                                             | PASS — 8 tests: a character with the largest picture goes through a room |
| `SIMLAB_DEV_ONLY=1 npx playwright test e2e/face-photo.spec.ts e2e/character-page.spec.ts e2e/menu.spec.ts e2e/multiplayer.spec.ts --project=dev --workers=1` | PASS — 7 tests (+ warm-up)                                               |

**What the tests cover**

- New unit test: the picture's placement puts the eyes and the mouth on their places, the head
  rolled or not.
- The e2e checks:
  - the saved character has its JPEG picture and fits a room's message;
  - what is kept of the face before the photo holds no picture;
  - Delete removes the picture.

Looked at in a frame (SwiftShader): the drawn head made from its own photo, with the photo's eyes
and brows on the face. The source face was a little turned, so a dark edge of it shows at one side.

**Not verified:** a photo of a real person, the camera, and how the picture looks in the lab's
lights on the real GPU.

## F-9 — one Play button, kept games and rooms, the opening into the menu

Phú (2026-11-12) asked for four changes:

- The opening's logo, instead of fading, slides from the centre to the left into the menu's own.
- One **Play** button in place of New game, Continue and Multiplayer. It opens Single player or
  Multiplayer.
- Multiplayer shows the rooms, makes a room, and joins one by ID. Choosing a room shows **Play**,
  which goes straight into it with a proper entering effect. Single player has New game and
  Continue.
- The games and rooms played before are kept, to play on or delete.

Asked and answered:

- Keep both kinds: several single-player games, and the LAN rooms played.
- Each room has its own progress.

**Kept games** (`persistence/saveSlots.ts`)

- The list is new; the saves are not. Each game is still a save slot (`simlab.save.<id>`, the
  format unchanged, no `SAVE_VERSION` change).
- The list lives in its own key (`simlab.saves`). Each entry has its kind (`solo` or `room`), its
  number, the room's name and last ID, and when it was made and last played.
- The save from before the list (`slot-1`) becomes "Game 1".
- A place made but never saved is dropped. Delete removes the save, its backup and the entry.
- A room's game is found by the room's ID, else by its name. A server restart gives the room a new
  ID, so the name finds it.
- `Game.useSlot` picks the save to play. Saving marks it played.
- The game starts on the last played save, so the catalog reads that game's progress.

**The menu**

- One Play button. It opens `PlayPage`: two cards, Single player and Multiplayer.
- Single player (`SoloPage`):
  - New game makes a new game.
  - Continue plays the last one.
  - The kept games are listed, the last played first, each with Play and Delete.
  - Delete asks first and says it cannot be undone.
- Multiplayer (`MultiplayerPage`, rebuilt):
  - Make a room or type an ID: either goes in at once.
  - The open rooms, and the rooms played before (with Delete), are listed. Choosing one shows it
    large beside the list with Play.
  - A played room that is no longer open is made again under its name.
  - Back in the menu while still in a room: Play and Leave.
- Going in: the room is joined, then its own game is played on, or a new one started. Single
  player leaves any room first.
- Esc goes back one page.

**The opening into the menu** (`AppIntro.ts`, written by the builder agent)

- The intro's emblem and word fly and scale onto the menu's own emblem and title (900 ms) while the
  dark backdrop fades. The menu's own logo is hidden during the flight and shown when it lands.
- It falls back to a fade if the menu's logo is not laid out, or the panel is stacked (narrow).
- Reduced motion: a short cross-fade.

**Entering** (`EnterTransition.ts`, written by the builder agent)

- A full-screen portal: the emblem's rings spinning up, light streaks rushing past, the room's or
  game's name, and a status line ("Joining the room…", "Loading the lab…").
- The world loads under it. When ready, an iris opens onto it.
- Cyan for a room, warm for a single-player game.
- A failure (a refused ID) fades it out and the reason shows on the page.

**Tests**

- `saveSlots.test.ts`: the list made from the old save, games listed with a save only, numbering,
  rooms by ID then name, delete with backup, an unreadable list rebuilt.
- `RoomHub.test.ts`: unchanged.
- `appIntro.test.ts`: the slide's measures.
- e2e:
  - The specs go through Play → Single player now (`menuNewGame`, `menuContinue`, `openSolo`,
    `openMultiplayer` in `support.ts`).
  - The multiplayer specs make a room and go straight in; the second player picks it and presses
    Play.
  - The two-player world spec seeds each browser's own game of the room (`seedRoomSave`).
  - New `play-menu.spec.ts` covers:
    - two games kept, the last first;
    - a Delete cancelled, then done, and gone after a reload;
    - Play on a kept game;
    - the opening's logo hidden in flight and the menu's own in the same place after.

Looked at in frames (SwiftShader):

- the entering portal for "Game 1";
- the Multiplayer page with a room chosen;
- the opening's logo mid-flight and landed (the menu's own in place).

Results (F-9), SwiftShader (software WebGL, 9–17 FPS in the runs):

| Command                                                                                                                    | Result                                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`                                                                                                    | PASS                                                                                |
| `npx eslint .`                                                                                                             | PASS                                                                                |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                 | PASS                                                                                |
| `npx vitest run --maxWorkers=4`                                                                                            | PASS — 313 files, 4034 tests                                                        |
| `SIMLAB_DEV_ONLY=1 npx playwright test --project=dev --workers=1` (all, 2.8 h)                                             | 157 PASS, 16 FAIL                                                                   |
| the same command on the 16 after the spec fixes below (30.7 min)                                                           | 13 PASS, 4 FAIL: experiment (projectile), pause (paused 20 Hz), pendulum, resources |
| the same command on `experiment.spec.ts`, `resources.spec.ts` and the pendulum test, in a worktree of 934e493 (before F-9) | the same 3 FAIL, at the same steps                                                  |

The 16 first failures:

- 7 were specs F-9's script had not moved to the new menu (a Vietnamese "Tiếp tục" / "Trò chơi mới"
  on the Home, the save read from `slot-1`). The menu helpers (`openSolo`, `menuNewGame`,
  `menuContinue`) now accept the English or the Vietnamese labels.
- `world.spec` expected 41 bodies in the hub. There have been 42 since the hub's board and laptop
  (2026-11-10), before F-9. The spec is updated.
- osmosis, teacher, titration-physical and results-view timed out once, then passed unchanged in
  the rerun. They are **flaky** under this load, not a clean PASS.
- Still failing, the same before F-9:
  - experiment and pendulum: the 300 s test timeout runs out at the lab–hub door walk.
  - resources: the lab's GL buffers and vertex arrays grow by one per trip.
  - pause: SwiftShader offers about 15 frames a second, under the 20 Hz paused cap, so "fewer
    drawn than offered" cannot show. This is the environment.
    Not fixed here.

## F-10 — chat, voice, and games that find each other on the LAN (2026-11-12)

Phú asked for chat and voice in a room, as in Minecraft but with voice. The game will become a
desktop app, so he also asked whether games connect to each other on the LAN by themselves when
started.

**Chat** (`ui/ChatView.ts`, `chat.css`)

- In a room, Enter opens a line at the bottom left. The game goes on, and the freed mouse does not
  pause it.
- Enter sends the line, Esc closes it unsent, and a click on the scene closes it.
- The server relays a line to the whole room, the sender included, in the room's order
  (`RoomHub`: `chat`, at most 200 characters, control characters taken out).
- Lines fade after 10 s. All of them show again while typing. The last 50 are kept, and the sender's
  name is shown as `<name>`.
- Lines are shown as text, never markup, and never translated.
- Rebindable as `chat` (Enter). Listed in Controls under "In a LAN room".

**Voice** (`net/VoiceChat.ts`, `multiplayer/voiceMix.ts`)

- Push to talk: hold V (`talk`). The HUD shows "Hold V to talk", "🎙 Talking…", and who is heard
  ("🔊 An", from the level of their audio).
- Proximity, as in Minecraft's voice mods:
  - full volume up to 3 m, fading to nothing at 24 m;
  - nothing from another scene;
  - heard from the side the speaker is on;
  - scaled by the Voice and Master volumes and the mute.
- The audio goes directly between browsers (WebRTC, no STUN or TURN on a LAN). The room server only
  relays the set-up to the one player it is for (`signal`).
- Who joined first makes the call. One call per pair, up to 7 per player in a room of 8.
- The microphone is asked for once, when entering a room. A browser shows a page its real LAN
  addresses only after the microphone is allowed. Refused or missing, the player still hears the
  others.
- A page over `http://<LAN IP>` gets no microphone (not a secure page), and the player is told so.

**Games that find each other** (`multiplayer/lanDiscovery.ts`, written by the builder agent)

- Before this, nothing connected by itself. Every player had to open the address of the one computer
  running `npm run dev:lan`, and the desktop app served localhost only, so two desktop apps could
  never meet.
- Now each game server says on the LAN that it is there, with its rooms: a UDP broadcast on port
  5188 every 2 s, only when served to the LAN.
- Each server keeps the servers it hears (checked with Zod, keyed by the sender's address, forgotten
  after 7 s).
- The page lists their rooms beside its own, with the computer's name ("on LAPTOP-…"). The page
  asks `GET /simlab-rooms/lan` every 2 s while on the menu.
- Joining one goes through the page's own server (`/simlab-rooms/via/<at>/hello|events|send`, only
  for a server heard). The page stays on localhost, a secure page, so the microphone works. Leaving
  returns to the page's own server.
- `scripts/desktop-app.ps1` now serves with `--host`, so the other computers can reach it.
  **Windows Firewall asks once** to let Node on private networks; refused, nothing is heard.

**Tests**

- Unit tests:
  - chat to the room, cleaned and refused outside it;
  - a signal only to the one named (`RoomHub.test.ts`);
  - proximity gain and side (`voiceMix.test.ts`);
  - discovery over real UDP on loopback: heard, own beacon ignored, bad ones dropped, expiry;
  - the proxy between two real HTTP servers (`lanDiscovery.test.ts`, `roomHttp.test.ts`).
- `e2e/room-chat-voice.spec.ts`: two browsers with the browser's fake microphone.
  - A chat line is sent and seen, and markup typed in shows as text.
  - Esc closes the line without the pause menu.
  - Held V on one, the other shows "🔊 An", then silence; and the other way.
- Tried on this computer with two dev servers (`vite --host` on 5191 and 5194):
  - Each listed the other (`192.168.1.33`): Windows delivered the broadcast to both sockets on one
    computer.
  - A room made on 5191 showed on 5194's page "on LAPTOP-19CQ4C68".
  - Joined through `/via/`, and a chat line arrived.
  - A Playwright script with fake microphones (scratchpad, not kept): voice both ways across the two
    servers.

Results:

| Command                                                                                                                                                                                                             | Result                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `npx tsc --noEmit -p .`                                                                                                                                                                                             | PASS                          |
| `npx eslint .`                                                                                                                                                                                                      | PASS                          |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                                                                                                          | PASS                          |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                     | PASS — 315 files, 4045 tests  |
| `SIMLAB_DEV_ONLY=1 npx playwright test e2e/room-chat-voice.spec.ts --project=dev --workers=1`                                                                                                                       | PASS — 1 test (+ warm-up)     |
| `SIMLAB_DEV_ONLY=1 npx playwright test e2e/multiplayer.spec.ts e2e/multiplayer-world.spec.ts e2e/play-menu.spec.ts e2e/room-chat-voice.spec.ts e2e/pause.spec.ts:40 e2e/controls.spec.ts --project=dev --workers=1` | PASS — 9 tests (with warm-up) |

**Limits**

- **Not tried on two real computers.** On one computer the WebRTC audio takes the shortest path.
  Between computers it relies on the LAN letting UDP through and on the microphone being allowed
  (else the browsers hide their addresses behind mDNS names).
- A call that fails is not tried again until the room is left and joined.
- No chat on phones and tablets (no Enter key; a button would be needed).
- No rate limit on chat beyond the 80 messages a second for everything.
- Over the internet (not one LAN) none of this reaches: that needs a server everyone can reach, and
  STUN/TURN for voice.

**For the SimLab app (Phú's own application)**

- The room server is plain Node HTTP with no dependency (`roomRoutes`), and discovery is plain
  `node:dgram`. Any Node host can mount both: Electron's main process, an Express or Fastify server,
  a packaged server.
- The page must stay on a secure origin for the microphone:
  - localhost (as now), or
  - an app scheme Electron or Tauri treats as secure.
- Each copy of the app runs its own server, as the desktop app does now.
- What a new host needs:
  - the `/simlab-rooms` routes;
  - discovery on UDP 5188;
  - listening on the LAN (and a firewall rule);
  - the same messages (`protocol.ts`), so different builds meet only if their protocol matches.

## F-11 — Play, Single player and Multiplayer redesigned (2026-11-12)

Phú asked for the pages after Play to be redone "professional, complete, attractive, impressive".
They are now a stage over the menu's sky (`playPages.css`, replacing `menuPages.css` and the old
Multiplayer styles in `styles.css`), warm for playing alone and cool for together, as the entering
transition is. The art is drawn in code, as the emblem is (`playArt.ts`): no image files.

- **Play** (`PlayPage`): two mode cards.
  - Each card has its own animated scene:
    - Single player: a flask bubbling on a bench, a pendulum swinging, a tracer in orbit.
    - Multiplayer: players linked to the room, a chat bubble, a voice's waves.
  - Each card also has its name and line, three things it offers (true of the game now), and how it
    stands: games kept, or rooms open / searching / no room server, with a live dot.
  - A call to action ends each card.
  - Pointed at, a card lifts and glows in its colour, and a sheen crosses it.
- **Single player** (`SoloPage`):
  - The last game, large, with **Continue**. It shows where it was left, how many experiments are
    completed, as whom, and how long ago. All of this is read from its save (`Game.slotSummary`,
    read only), never guessed.
  - Beside it, a new game card.
  - Under them, the kept games as cards: number badge, "Latest" tag, facts, Play and Delete (Delete
    still asks first).
- **Multiplayer** (`MultiplayerPage`):
  - A network pill, "Network · n rooms open".
  - The player's name with their initial as an avatar.
  - Three columns:
    - Create a room, Join by ID, and the rooms played (with "Open now" when they are);
    - the open rooms as cards, each with "This computer" or "on <computer>" and a pip per place,
      or a radar sweeping while none is open;
    - the chosen room large, with its first letter in a pulsing ring, and Play.
  - Two columns under 1100 px, one under 760 px. No sideways scroll at 390 px (checked).
- Reduced motion turns every animation off.
- The e2e hooks are kept: the same button names, labels and classes.

Results:

- `npx tsc --noEmit -p .`: PASS.
- `npx eslint .`: PASS.
- `npx prettier --check src e2e docs CLAUDE.md package.json`: PASS.
- `npx vitest run src/content src/game/Game.test.ts src/platform/ui`: PASS, 303 tests.
- `SIMLAB_DEV_ONLY=1 npx playwright test e2e/play-menu.spec.ts e2e/multiplayer.spec.ts e2e/menu.spec.ts e2e/character-page.spec.ts e2e/settings.spec.ts e2e/room-chat-voice.spec.ts e2e/game.spec.ts --project=dev --workers=1`:
  14 PASS, 2 FAIL.
  - multiplayer: B walked 0.48 m in 1.2 s, short of the 0.5 m the test needs.
  - settings: the hub over the city; the pause menu's Settings button never showed.
- The same command on `e2e/settings.spec.ts:375 e2e/multiplayer.spec.ts`: PASS, 3 tests.
  The two first failures are **flaky** under load, not a clean PASS.
  The likely cause: the circuit builder wrote project files between 20:32 and 20:35, during that
  run, and Vite reloads the open pages when files change (see `docs/phase-e-report.md`).

Not yet checked on Phú's 300 Hz display.

## Settings redesigned (2026-11-12)

Phú asked for the settings to look better.

**In the main menu** (`SettingsPage.ts`): Settings is a page of its own on the stage, as Play's pages
are, opened by a button in place of the fold that ran down the narrow panel. The page has the
stage's title, a Back button (Esc too), and a sticky row of chips that scrolls to each card and
flashes it. The chips are built from the cards, again when the sound's card arrives with its
engine.

**The settings themselves** (one shared `SettingsPanel`, `settingsPage.css`):

- Each group is a glass card, with a lit line along its top. The cards sit in columns, kept whole.
- The frame cap, the graphics preset and the rooms out of sight are one "Graphics" card (all three
  are the load).
- Choices are pills, the chosen one lit. Switches are toggles. Sliders are in the accent colour
  with their value in a pill.
- The pause menu shows the same cards: its dialog widens to two columns while it shows them.

**E2E:** the specs that opened the fold (`.menu-settings > summary`) use `openSettings` and
`closeSettings` (`support.ts`); `openSolo` and `openMultiplayer`, and the catalog's opener,
close the page first.

Results:

- `npx tsc --noEmit -p .`: PASS.
- `npx eslint .`: PASS.
- `npx prettier --check src e2e docs CLAUDE.md package.json`: PASS.
- `npx vitest run --maxWorkers=4`: PASS, 317 files, 4049 tests.
- `SIMLAB_DEV_ONLY=1 npx playwright test e2e/menu.spec.ts e2e/pause.spec.ts e2e/settings.spec.ts e2e/topics.spec.ts e2e/touch.spec.ts e2e/vietnamese.spec.ts --project=dev --workers=1`:
  19 PASS, 4 FAIL.
  - Three were specs still treating Settings as the fold, opened over a visible panel: menu:35,
    pause "Esc stops the simulation", topics:102. Fixed in the specs.
  - The fourth is pause's 20 Hz test, which failed the same way before F-9.
- The three fixed, run again: PASS (`e2e/menu.spec.ts:35 e2e/topics.spec.ts:102`, then
  `e2e/pause.spec.ts -g "Esc stops the simulation"`).
- Looked at in frames (SwiftShader, 1280 × 720): the Settings page with all four cards and chips,
  and the pause menu's Settings.
- Not yet looked at: phone width, and Phú's 300 Hz display.

### Settings made plainer, and the FPS limit as a row (2026-11-12)

Phú, from a shot of the pause menu's settings, asked for them to stay good-looking without the
look of AI-made design, and for a better FPS limit (its list opened as the system's grey drop-down).

- **The FPS limit** is now a row of five choices (30, 60, 90, 120 FPS, No limit), like the
  graphics preset's, the current one filled. It replaces the `<select>`; `.menu-select` is gone.
- **Plainer** (`settingsPage.css`):
  - flat cards with a thin line, no glow, gradient or lit top edge;
  - card titles and labels in sentence case, not spaced capitals;
  - choices as tiles, the chosen one filled with the accent, no radio dot (the radio covers its
    tile, so it is still what is clicked, focused and read);
  - plain toggles, and slider values as plain figures;
  - the chips' row is plain text tabs, with no flash on the card.
- The stage head shared with Play's pages lost its gradient title and the small capitals with a line.

Results:

- `npx tsc --noEmit -p .`: PASS.
- `npx eslint .`: PASS.
- `npx prettier --check`: PASS.
- `npx vitest run src/content src/platform/ui`: PASS, 261 tests.
- `SIMLAB_DEV_ONLY=1 npx playwright test e2e/settings.spec.ts e2e/pointer-lock.spec.ts e2e/pause.spec.ts e2e/menu.spec.ts --project=dev --workers=1`:
  14 PASS, 1 FAIL. The failure is pause's 20 Hz test, which fails the same way before F-9.
- Looked at in the browser pane: the Settings page at 1280 × 720. Choosing 60 FPS stored 60.

### Settings in the Play pages' style, in one colour (2026-11-12)

Phú then asked for Settings to look like the pages after Play, all of it. He also asked for one
colour across the components, with no mixing of colours.

- `settingsPage.css`: the same parts as Play's pages, all in the accent colour at a few strengths
  over one dark surface. No gradients, no second hue, no glows.
  - rounded cards (18 px);
  - a mark in a small tile on each card's title (`data-icon`, set by the card's owner: Aa ◐ ⌖ ♪);
  - small capitals for labels;
  - choices as pills, the chosen one in the accent;
  - values in pills, and chips to each card.
- The FPS limit stays a row of choices.
- The shared stage head again has the short label in small capitals with its line, now a solid
  line and a solid title.
- `SIMLAB_DEV_ONLY=1 npx playwright test e2e/settings.spec.ts e2e/pause.spec.ts -g "FPS limit|language|Esc stops the simulation" --project=dev --workers=1`:
  PASS, 3 tests (with warm-up).
- `npx tsc`, `npx eslint`, `npx prettier --check`: PASS.

### Settings as a game's settings, with motion (2026-11-12)

Phú found the card layouts ugly and asked for a full redesign. He was asked with three ASCII
previews and chose "game style, sections on the left".

- `settings.ts` + `settingsPage.css`:
  - **Layout:** the sections listed on the left (General, Graphics, Controls, Sound; the sound's
    arrives with its engine); the chosen one on the right as rows, its name then its control.
  - **Choices:** ‹ value › selectors. The radios are kept inside, one in view, so the keyboard,
    screen readers and the e2e still choose them directly.
  - **Description:** the row pointed at or focused is described under the rows. The help lines and
    each graphics preset's own line are no longer in the rows.
  - **Colours:** one solid colour per section (Phú: "a colour for each part"): general cyan,
    graphics violet, controls amber, sound green. No gradients, no colours mixed.
  - **Size:** the frame is 600 px high for every section (no jump on a switch).
  - **The chips row is gone:** Phú called it meaningless.
- **Motion:** transforms and opacity only, none under reduced motion.
  - A highlight slides between the tabs and takes the new colour; the chosen tab's mark pops.
  - The tabs come in in turn when the settings open; a section's rows rise in turn when shown.
  - The heading and the description slide in their new words.
  - A new choice slides in its selector with a small beat; the switch knob springs.
- **The selectors follow events, never a frame:** a choice, a value set for them, a new size
  (ResizeObserver). A first version read `clientWidth` every frame.
- **The pause menu:** its Settings focus the first control of the section shown.
- **E2E:** `openSettings(page, section)` and `settingsSection(page, section)` (`support.ts`); the
  specs choose the section they use.

Results (SwiftShader):

- `npx tsc --noEmit -p .`: PASS.
- `npx eslint .`: PASS.
- `npx prettier --check src e2e docs CLAUDE.md package.json`: PASS.
- `npx vitest run src/content src/platform/ui`: PASS, 261 tests.
- `SIMLAB_DEV_ONLY=1 npx playwright test e2e/settings.spec.ts e2e/pause.spec.ts e2e/menu.spec.ts e2e/pointer-lock.spec.ts e2e/room-sleep.spec.ts e2e/sound.spec.ts e2e/touch.spec.ts e2e/vietnamese.spec.ts e2e/topics.spec.ts --project=dev --workers=1`:
  27 PASS, 2 FAIL.
  - pause 20 Hz: the same as before F-9.
  - room-sleep "the bay wakes … without a long frame": its longest wake frame was over 150 ms.
- After the per-frame read was removed, `e2e/room-sleep.spec.ts e2e/settings.spec.ts`: 11 PASS, 1 FAIL
  (room-sleep, 150 ms).
- room-sleep's wake test alone, measured by its longest wake frame:
  - three runs on this work: 100, 147, 163 ms (2 PASS, 1 FAIL);
  - two runs on 934e493 (a worktree): 107, 127 ms (PASS);
  - one run here with chat and voice off: 143 ms.
- So room-sleep is **flaky** at its 150 ms bound. It may be somewhat slower with this work, but runs
  this few cannot tell what.
- An earlier run of these specs was invalid: files were edited while it ran. It was not counted.
- Not yet seen at phone width or on Phú's 300 Hz display.

### A white light on entering (2026-11-12)

Phú asked for a white light drawn up over the screen before entering the game, and over the game
once in, after the entering effect that was there. It runs after `EnterTransition`'s portal.

- When the world is ready, the portal flies out while a white light with a soft top edge rises from
  the bottom and covers the screen (0.65 s).
- Then everything else goes and the light clears off the world, easing up a little as it fades
  (0.9 s).
- Each step starts when the one before has really played (`transitionend`), with a timer behind
  it.
  - A first version timed both steps from the start. Under SwiftShader the game's first frames
    held the page, so the light was cleared half up, showing the world under it (seen in a frame).
- Reduced motion: a short fade, as before.
- Seen in frames (SwiftShader, a Playwright script against the dev server):
  - the screen white;
  - then the preparation room;
  - the overlay's states in order: whiteout at 3.35 s, clearing at 5.04 s, gone at 6.12 s.
- `SIMLAB_DEV_ONLY=1 npx playwright test e2e/play-menu.spec.ts e2e/multiplayer.spec.ts e2e/room-chat-voice.spec.ts e2e/menu.spec.ts e2e/game.spec.ts --project=dev --workers=1`:
  PASS, 8 tests (with warm-up).
- Not yet seen on Phú's 300 Hz display.

## The F3 panel starts hidden (2026-11-12)

Phú asked for the information panel (F3) to be off when the game starts.

- `DebugPanel` now starts hidden. F3 shows it, and `?debug=1` opens the game with it shown;
  `?debug=0` keeps it hidden.
- A test browser on a computer (`navigator.webdriver`, as the opening's skip) still starts with
  it shown, because the e2e tests read the game's state from it.
- Checked in the browser pane: hidden at start, F3 shows it, F3 again hides it.
- `SIMLAB_DEV_ONLY=1 npx playwright test e2e/game.spec.ts e2e/touch.spec.ts e2e/menu.spec.ts e2e/play-menu.spec.ts --project=dev --workers=1`:
  PASS, 8 tests (with warm-up).

## LAN rooms: another player's goggles, and what is not shared yet (2026-11-12)

**Fixed:** another player's face shield and goggles were drawn opaque (`body/actor.ts`): the
shield a white panel over the face, the goggles a pale band. They are clear now, as the player's
own (shield 22 %, goggles 50 %, no depth write) — the face is seen through them. Seen in a shot of
a second player (joined over the real room protocol) in the lab coat, goggles and face shield.

**Full PPE seen by the others** (a second player in the lab coat, goggles, face shield and gloves, shot from the front, the side and the back, looking at their hands and dialling): all four drawn. One flaw found and fixed: over a dress, the dress came through the coat's back at the hem (two black points) — the dress is made deeper (front to back) than the coat was; the coat is now as roomy over a dress (`BodyModel.ts`, `coatDeep`), for every view of the body (the player's own, the others, the character page).

Results: `npx tsc --noEmit -p .` PASS; `npx eslint .` PASS; `npx prettier --check src e2e docs CLAUDE.md package.json` PASS; `npx vitest run --maxWorkers=4` PASS — 310 files, 4016 tests; `SIMLAB_DEV_ONLY=1 npx playwright test e2e/character-page.spec.ts e2e/multiplayer-world.spec.ts --project=dev --workers=1` PASS — 3 tests (+ warm-up).

**Shared** (checked in `protocol.ts`, `LanRooms.ts`): poses with what is worn, held, resting, done
and the head's pitch; the character; station commands (`run`, `stop`, `reset`, `adjust`, `set`,
`setup`, `clear`) with one player per station; hits and throws (the thrown object as a ghost); the
states in `SHARED_STATE_KEYS` (doors and cabinets open, taps, lights, `active`, the circuit boards,
fire lit and out, soot, broken parts); the teacher while one player has him (where, what he does,
his line, his board), the overheard line.

**Not shared yet:**

1. Objects moved by hand: picking up, carrying, setting down, dropping — the others see the object
   in the player's hand (a box of its size and colour), but in their world it stays where it was.
   Each game's objects are its own (Phase M's rule).
2. The wet labs' physical work (`ContainerRequested`: filling and emptying pipettes, drops,
   stoppers, clamps, a burette's tap, recording a reading) and what is in each vessel.
3. Putting apparatus into a station or taking it out (`load` / `unload`: the hands are each
   game's own).
4. The time of day: each game keeps its own clock, so two players can see different light.
5. The teacher when nobody has him: each game walks his day on its own, so he may stand in
   different places for each player.
6. Sounds of the others: their footsteps, their phone call, what they knock or drop.
7. Talking between players: no chat and no voice.
8. Using the laptop: the others see the player standing (not "at the laptop").
9. A room lives in the server's memory: restarted, it is gone (progress stays in each browser).

## UX review (2026-11-12)

Phú asked for the whole game looked over, the player's experience first. Played in Vietnamese
from a cleared browser: the menu, Settings, a new game (the preparation room's first step), the
hub (the teacher's greeting, choices and test form; the laptop, its desktop and a lesson), the
Biology Lab's enzyme bench, the bag, the phone — on a computer (1280 × 720) and at a phone's
landscape size (844 × 390, `?device=phone`), screenshots through Playwright (Edge, SwiftShader;
the browser pane was hidden, so the game ran there at 1 FPS and could not be played).

Fixed:

- **Phone, main menu**: the name and emblem filled the short screen; New game was below the fold.
  A short, wide screen now lays them side by side, smaller (`styles.css`, height ≤ 520 px).
- **Phone, talking to the teacher**: the answers lay under the line said (two of four hidden). On
  a short screen they go to the top right, smaller and scrolling if need be; the hotbar steps aside
  while talking.
- **Phone, pause menu and Controls**: they listed keyboard keys. On a phone or tablet they now
  explain the touch controls (stick, drag, tilt, each button; `controlGroups` → `touchGroups`), and
  a short screen keeps the pause menu in two columns so the guide is in view.
- **Phone, a station's bench**: the header took two lines; on a short screen it is one line (the
  trail to the station hidden, its name kept) with less padding, so the bench has the height.

- **The main menu's emblem** (a regression from F-2, found by `e2e/menu.spec.ts`): the laptop's
  start-up styled `.emblem-orbit` for the whole page, so the menu's orbit lost its slow turn (drawn
  once instead). The laptop's emblem rules are now under `.laptop`.

Seen and fine: the menu and Settings in Vietnamese; the guided first step (the notice board
outlined in gold, the step list, the rules shown and the step ticked); the teacher's greeting,
choices (the one not built marked "Sắp có") and test form; the laptop's library and a lesson; the
enzyme bench; the bag; the phone in the hand.

Not changed (proposed):

- The game starts in English in a Vietnamese browser (English is the rule's default; following the
  browser's language would change it — Phú to decide).
- The test form lists only about four simulations per subject at 720 p before scrolling.
- With the phone out, the prompt's last words lie over the phone's top edge at 1280 × 720.
- Opening Settings on the main menu in a small window moves the emblem down (the page scrolls).
- The cleanroom rules come as a long notice that fades; a panel to read at leisure would be kinder.
- The dev build shows its debug panel at first (a production build does not).

Results (UX review):

| Command                                                                                                                     | Result                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                          | PASS                                                    |
| `npx eslint .`                                                                                                              | PASS                                                    |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                  | PASS                                                    |
| `npm run test`                                                                                                              | PASS — 308 files, 4012 tests                            |
| `npx playwright test e2e/touch.spec.ts e2e/controls.spec.ts e2e/menu.spec.ts e2e/teacher.spec.ts --project=dev --workers=1` | 7 PASS, 2 FAIL (menu.spec: the emblem regression above) |
| `npx playwright test e2e/menu.spec.ts --project=dev --workers=1` (after the fix)                                            | PASS — 4 tests                                          |

The screenshots (a temporary Playwright walk, deleted after) are SwiftShader renders, at 1280 × 720
and 844 × 390. Not looked at on a real phone or the 300 Hz display.

## The city under the hub

Not reproduced in the current code: in the dev and production builds on the real GPU (NVIDIA
GeForce RTX 5070, ANGLE Direct3D 11) the city is drawn at Ultra, by day and night, with goggles on;
and `e2e/hub-city-walk.spec.ts` (SwiftShader) walks from a lab into the hub at High (in a 640 × 360 window) and sees the
city's files requested and drawn. Most likely cause on Phú's machine: the desktop app's build
(`dist-app/`, built 2026-11-08) is older than the city work, and `scripts/desktop-app.ps1` could
not be read here (locked), so it may not have rebuilt. Hardening done: a failed city load no longer
leaves the hub without a city for the session — it is tried again after 5 s
(`WorldRenderer.syncCity`). To check: close the desktop app, delete `dist-app/`, start it again.

## Can it be an APK, and play together on one network?

- The game is a web page; the LAN rooms live in the **server that serves the page** (Phase M:
  `npm run dev:lan` or `npm run preview:lan` on one computer). Others on the same network open
  `http://<that computer's IP>:<port>/` in a browser and play together in one room; this is the
  supported way, and it is what the e2e tests do (two browsers on one server).
- An **APK is an Android package**, not something a Windows PC runs. Wrapping the game in one (a
  WebView, e.g. Capacitor) is possible, but the APK's own copy of the page has no room server:
  Multiplayer would say it needs one. It works only if the APK opens the host computer's address
  (then it is the same as a browser). The same holds for the desktop app (`scripts/desktop-app.ps1`
  serves a production build without rooms unless it runs `preview:lan`).
- Seen together: yes, with what F-3 adds above. **Not tried on two real computers yet** (only two
  browsers on one machine); a firewall must let the port through on the host.
- A phone or tablet that opens the host's address plays with touch controls (F-4) and gets the
  same game: labs, experiments, the teacher, the laptop's books, the room. What differs over
  `http://<LAN IP>`: the gyroscope is not given to a non-secure page (tilt to look is off, F-5);
  progress is saved in that phone's own browser; WebGL 2 is needed, and the frame rate depends on
  the phone (unmeasured; the graphics level is fitted to it as on a computer).

## Results

All runs on 2026-11-11; e2e on SwiftShader (software WebGL, ~2–6 FPS): no performance number here
is a GPU result.

| Command                                                                                                                                                                                                                                                                                    | Result                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                                                                                                                                                                                         | PASS                                                                                                                                                      |
| `npx eslint .`                                                                                                                                                                                                                                                                             | PASS                                                                                                                                                      |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                                                                                                                                                                                 | PASS                                                                                                                                                      |
| `npm run test`                                                                                                                                                                                                                                                                             | PASS — 305 files, 3997 tests                                                                                                                              |
| `npx playwright test e2e/multiplayer-world.spec.ts e2e/multiplayer.spec.ts e2e/teacher.spec.ts e2e/test-paper.spec.ts e2e/inventory.spec.ts e2e/circuit-fire.spec.ts e2e/circuit-bench.spec.ts e2e/controls.spec.ts e2e/pause.spec.ts e2e/hub-city-walk.spec.ts --project=dev --workers=1` | 12 PASS (both multiplayer-world tests, multiplayer, teacher, test-paper, circuit-bench, controls…); 4 FAIL: inventory, hub-city-walk, circuit-fire, pause |
| `npx playwright test e2e/inventory.spec.ts e2e/circuit-fire.spec.ts e2e/hub-city-walk.spec.ts e2e/pause.spec.ts --project=dev --workers=1` (inventory spec updated: slot 9 is now the phone)                                                                                               | inventory, circuit-fire, pause PASS; hub-city-walk FAIL (High at ~2 FPS: the doors outlast the waits)                                                     |
| `npx playwright test e2e/hub-city-walk.spec.ts --project=dev --workers=1` (spec now in a 640 × 360 window)                                                                                                                                                                                 | PASS                                                                                                                                                      |

circuit-fire and pause failed once and passed in the rerun: timing-sensitive under load (three
preview tabs of the game were running on the machine during the first batch) — flaky, not a clean
PASS. The multiplayer-world spec took several rounds to test what it means to: Chromium gives the
mouse lock to one page at a time (the other pauses), and capturing it can turn the view, so each
page captures and aims again before it acts; the teacher stays at the counter only ~55 s, so he is
asked first.

Unit tests of F-3 (`multiplayer/shared.test.ts`, the real game and Rapier): another player's
capsule stops this player, and the way is free once they leave; a ball thrown at another player
hits them (`PeerHit`), also at 8 frames a second (physics' own impacts); their hit flashes this
player; a throw by another flies here and rests on the floor; the teacher another player has is
drawn from their snapshot, talking is refused with who has him, and he walks back after; the
teacher this player talks with is this game's to send; a fire lit and put out elsewhere follows
here; a part plugged into a board elsewhere leaves this world and comes back when taken off.
`RoomHub.test`: events relayed, the teacher's lock claimed, refused to the other, freed only by its
holder. F-1: `RestSystem.test` (sitting, sleeping and the jolt, a ball hitting a player). F-2:
`books.test` (the nine books' shape). Updated: the hub's counts (+1 body and collider: the laptop).

Looked at on the real GPU (NVIDIA GeForce RTX 5070, the browser pane, dev server): in a room with a
second player simulated over the real room protocol (SSE and POSTs), the other player drawn in the
lab coat, goggles and gloves, holding a ball in front of the chest; asleep, the "Z"s rising over
them. Earlier this session: the phone in the hand dialling 114, the fire tiers, the laptop on the
counter, its start-up (reduced motion), the desktop and a Physics lesson. In e2e screenshots: the
coat seen from the other browser, the teacher busy, the hit, the city under the glass after walking
in. Not looked at: the full 5.6 s intro at normal motion, the red hit flash and the sleep overlay in
the player's own view, the sink and cabinet in use, a remote player seated or lying in full view.

## Known limits

- Remote players (their head pitch is drawn since F-6); a held object is a
  box of its size and colour, not its own model; their exact hand motions are not sent — an
  action shows as hands at work (the gesture), not its own animation; the phone is the actor's.
- Each game keeps its own objects (Phase M rule): what another player carries away still lies here
  until it is plugged into a shared board or thrown (a ghost); only the listed states are shared.
  A door opened by another player opens here too, even one a procedure gates (the cleanroom).
- A fire grows and spreads in each game on its own; lit and put out are shared, so they converge.
- The teacher: if two players ask him in the same instant, the server gives him to the first; the
  second game's own conversation is not cut (rare; noted). His day (where he walks when no one has
  him) is each game's own.
- Being hit hurts no one (no health): a flash and waking up.
- The laptop's books are Vietnamese only; their content is checked for shape, not proof-read by a
  teacher; some titles/numbering follow one textbook series and may differ from another.
- A face from a photo: tried only on the game's own drawn face, never on a real photo or a real camera; its average-face constants are estimates. Its picture (F-8b) is kept with the character and seen by the others in a LAN room.
- Not looked at on the 300 Hz display; multiplayer not tried on two real computers.

## Next

Phú's checks on the real display (fire tiers, phone, laptop intro, books, sleeping, a LAN game on
two computers); translate the books; draw remote players' head pitch and held objects' models.
