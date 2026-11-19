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

## F-12 — Space jumps; the photo face in rooms; LAN lag and the teacher's day (2026-11-13)

**Jump** (Phú: "Space to jump").

- `jump` binding (Space); `player.jumpSpeed` 3 m/s, so v²/2g = 0.46 m at 9.81 m/s².
- `PlayerSystem` asks (`player.jump`, not while seated or lying). `PhysicsSystem` takes the ask at its
  next step, so a press at 300 frames a second is not lost between 60 Hz steps. It jumps only from
  the ground; asked in the air, the ask is dropped.
- The first step uses the mid-step speed (v + g h/2), so every step lies on y = v t − g t²/2 and the
  top is v²/2g. Plain Euler gave 0.484 m, the v h/2 error.
- While rising, the capsule is not "grounded". Else the controller, still within reach of the
  floor, snapped it back after one step (seen: 0.05 m high).
- Rising into a ceiling ends the rise.
- Space or Enter on a focused control stays the control's (`BrowserInput`). This also fixed Enter
  on the menu's buttons, which the chat binding (F-10) had been taking (seen in
  `history.spec` at 430 px).
- Controls lists Jump. The others see it through the pose's height.

**The photo face in a LAN room.** It already travelled with the character (F-8b). It is now checked
by two players: A plays their own character with a face picture, and B's Players line shows
`face-photo` and B's view of A shows the picture on A's head (`mpw-6-face-photo`).

- Over `http://<LAN IP>` the camera is blocked, but choosing a photo works; the desktop app on each
  computer (localhost) has the camera.

**LAN lag.** Each POST waited for the one before it to come back. At 15 poses and 8 teacher states a
second, a round trip over ~40 ms (Wi-Fi, or the `/via/` proxy) made the queue, and so the lag,
grow.

- Now while one POST is on its way, the next messages gather and go together (`BATCH_MAX` 64, within
  `MESSAGE_MAX_CHARS`; the server takes an array).
- An unsent pose, or an unsent person's state, is replaced by the newer one (a board it carried is
  kept), so the lag stays within about one round trip.
- The event stream's socket has no Nagle delay.

**The teacher on his own day** (Phú: players did not see him in the same place or doing the same
thing).

- Only a game that had him (a talk, a lesson) sent him. Otherwise each game ran his day on its own
  clock.
- Now the room's day driver, the game in the room longest (lowest player number,
  `Peers.dayDriver`), sends his day (`npcDay`, no lock: anyone may still talk to him). The others
  draw him from it (`NpcSystem.dayFromRoom`).
- When a player goes to talk to him, he is theirs as before (the lock), then back to the driver.
- A mirrored person eases to each new place and facing (12/s; snapped past 3 m, a door) instead of
  jumping 8 times a second.

Results (SwiftShader):

- `npx tsc --noEmit -p .`: PASS.
- `npx eslint .`: PASS.
- `npx prettier --check src e2e docs CLAUDE.md package.json`: PASS.
- `npx vitest run --maxWorkers=4`: PASS, 317 files, 4052 tests. New tests:
  - the jump's height, landing, and an ask in the air dropped (real Rapier);
  - several messages in one POST;
  - the day driver, the teacher eased, and talk still allowed.
- `SIMLAB_DEV_ONLY=1 npx playwright test e2e/controls.spec.ts e2e/history.spec.ts e2e/touch.spec.ts e2e/multiplayer-world.spec.ts e2e/menu.spec.ts e2e/world.spec.ts --project=dev --workers=1`:
  14 PASS, 3 FAIL, then fixed:
  - controls: it asserted "no jump";
  - history: Enter on the menu's buttons;
  - world: pixels read while the entering effect still showed. `menuNewGame` and `menuContinue`
    now wait for it to go.
- Again with play-menu, game and preparation: PASS, 13 tests.
- `SIMLAB_DEV_ONLY=1 npx playwright test e2e/multiplayer-world.spec.ts e2e/multiplayer.spec.ts --project=dev --workers=1`:
  PASS, 6 tests. These include:
  - the face photo and jump seen by the other;
  - the teacher's day: B's game draws him from A's (`mirrored`), A's does not, and both put him in
    the same place over 70 s.
- multiplayer.spec failed once in an earlier batch (B walked 0.48 m against 0.5) and passed alone:
  **flaky**.
- Limits:
  - Not tried on two real computers. The lag fix is reasoned and tested on one computer, not
    measured on Wi-Fi.
  - In 70 s the teacher stayed at his counter, so his walking is checked only by the unit test.

## F-13 — chat shown in rooms, players drawn closer to now, and 113/114 answered (2026-11-13)

**How to chat** (Phú: does the guide say how to chat?). The controls panel listed the keys, but
nothing in a room said so. Now each room's first entry adds a line to the chat: "In this room:
Enter to chat, hold V to talk (players near you hear you)" (`chat.howTo`, keys as bound, with its
Vietnamese), once per room.

**Other players drawn closer to now** (Phú: a character is sometimes far behind).

- A player was drawn easing to their last pose: about 0.1 s behind it, plus the network's delay.
- Now, between poses, they are led along their walk's velocity (from the last two poses) for up
  to 0.25 s (`Peers`, `LEAD_S`), so a moving player is seen nearer to where they are now. Nothing
  is guessed past that, and a jump faster than 8 m/s (a door, a load) is not led.
- The room measures its round trip: a ping every 2 s (`ping`/`pong`, server and client checked
  with Zod). The F3 panel and the frame meter show it (`LAN: N ms (max M ms)`), so a slow link can
  be told from a slow game.

**Emergency calls** (Phú: 114 the fire brigade, 113 or 911 the police, by helicopter through the
hub's ceiling). A game, not a protocol: real services never come through a ceiling. Phú's choices:

- a call from a lab still comes to the hub; they walk to the lab from there;
- the whole LAN room sees it;
- four responders and one helicopter.

How it runs (`gameplay/emergency/EmergencySystem.ts`, content `responders.json`, Zod-checked):

1. **Inbound, 8 s.** The helicopter flies in over the roof and slows to a hover 5 m over the hub's
   ceiling at the hall's middle (0, −3). The phone counts down; the siren comes in the last 10 s.
2. **Breach, 3.4 s.** Three beeps, then the blast at 1.8 s: the ceiling is blown open (radius
   3.6 m) and the camera shakes (less the farther the player is).
3. **Rappel.** The ropes drop, then the four come down one after another (0.35 s apart), braking
   for the last metres, crouching as they land.
4. **The job.**
   - Fire brigade: each runs to a fire (the nearest still burning), sprays it with a lance until
     it is out (`FireSystem.douse`: 0.45 a second each, a little over the extinguisher), and steam
     rises. With nothing burning, they find the caller, tell them off and slap them (`PlayerHit`:
     the red flash, a shake, the view knocked aside).
   - Police: they look round, puzzled (one scratches his head), ask the nearest person of the world
     (`NpcSystem.aside`: the teacher stops, turns to them and answers "No, nothing at all. We are
     just doing experiments."), then find the caller and warn them. No slap.
5. **Back.** Each walks to their rope and is winched up; the ropes come in; the helicopter flies
   off; the ceiling mends itself over 24 s.

Leaving the world ends a call at once, the ceiling whole. The old 114 timer, which put every fire
out when it ran out (E-2), is gone; 114 is never a "false alarm" now (they come and tell you off).

LAN: the caller's game drives the call and sends it 8 times a second (`RoomEvent 'emergency'`:
phase, helicopter, ceiling, ropes, the four, the line said). The others draw it from that. A
snapshot replaces an unsent older one, as poses do. With no snapshot for 3 s (the caller left),
the call ends there.

Drawn (`platform/render/emergency/`):

- **The helicopter** (`helicopter.ts`), a generic light twin-engine type made from simple solids:
  - a lathed fuselage painted on one canvas in the squad's livery: stripes, canopy and chin
    windows, the open sliding doors, the number on the rear cabin, the lettering along the belly;
  - a glass canopy, the tail boom with the squad's name, the fin and stabiliser, the engine
    cowling with intakes and exhausts;
  - skids, and rappelling arms over both doors;
  - a four-bladed rotor with yellow tips and a blur disc, the tail rotor;
  - navigation lights, flashing beacons in the squad's colour, strobes, and a searchlight with its
    beam.
- **The breach** (`breach.ts`):
  - the hub's ceiling slab is swapped for the same slab with a jagged hole: its own material and
    tiles, the broken concrete edge, bent rebar and hanging cables that sway in the rotor's wash;
  - soot and short cracks round the hole;
  - the oculus and its coffer hidden (`DecorBatches.hide`);
  - the flash, a fireball, sparks, and debris that falls, bounces and settles (one instanced draw);
  - dust falling from the edge and blown about under the rotor;
  - the sky over the hole, and a shaft of daylight by day;
  - mending: the hole closes from its edge inwards behind a glowing rim with sparkles, the soot
    fades and the rubble shrinks away.
- **The responders** (`EmergencyView.ts`): each squad member's own body (their outfit from the
  content), plus:
  - a helmet fitted to the drawn head: the fire brigade's red with a lime band, brim and comb; the
    police's dark tactical one;
  - an air tank and harness (fire) or a radio (police);
  - the squad's name on the back;
  - new gestures: on a rope, landing, the lance held out, scratching the head;
  - the slap: the hand drawn back, then across.

Captions (`EmergencyCaptions`): who says what, under the screen, in the squad's colour, read aloud
by distance (heard within 30 m). The screen flashes white at the blast when near.

Sounds (synth recipes in `sounds.json`):

- the rotor's beat (11 a second, played where the helicopter is);
- the charge's beeps, the blast, the debris coming down;
- a rope's run as each one slides;
- a radio's squelch before each of the squad's lines;
- the slap.

Results (SwiftShader):

- `npx tsc --noEmit -p .`: PASS.
- `npx eslint .`: PASS.
- `npx prettier --check src e2e docs CLAUDE.md package.json`: PASS.
- `npx vitest run --maxWorkers=4`: PASS, 320 files, 4062 tests. New tests:
  - the 113 flow (the teacher asked and answering, the warning, the ceiling mended);
  - the 114 prank (the slap within 1.4 m of the caller);
  - leaving the world ends a call;
  - the fire brigade puts a lab fire out with hoses within 150 s;
  - the hole cut, the debris lying on the floor, the patch closing, the slab back;
  - both helicopters built, turned and freed;
  - a decor copy hidden and shown again, still hidden after a rebuild.
- `SIMLAB_DEV_ONLY=1 SIMLAB_DEV_PORT=5197 npx playwright test e2e/emergency.spec.ts --project=dev --workers=1`:
  PASS, 2 tests (113 police, 114 firefighters).
  - Port 5197 because the builder's preview servers held 5199 and 5198.
  - Screenshots `test-results/emergency-*.png` and `emergency-fire-*.png`: the blast, the ropes,
    the landing, the teacher's answer, the warning, the climb, the mending, the ceiling whole, and
    the firefighters' slap.
- A third run of the emergency spec added close shots of the slide down (`emergency-2b-sliding`,
  `emergency-fire-1b-sliding`): PASS, 2 tests.
- `SIMLAB_DEV_ONLY=1 SIMLAB_DEV_PORT=5197 npx playwright test e2e/room-chat-voice.spec.ts e2e/multiplayer.spec.ts e2e/multiplayer-world.spec.ts --project=dev --workers=1`:
  - 6 PASS: chat and voice; the coat, the teacher shared and overheard; the ball and the hit; the
    face photo and the jump; the teacher's own day.
  - 1 FAIL, `multiplayer.spec`: B walked 0.40 m against 0.5 m. This is B's own walk, not how A
    draws B. It is the same check that was **flaky** before (0.48 m).
- `e2e/circuit-fire.spec.ts` (114 now says `dispatched`): FAIL once in a batch with the emergency
  spec, PASS alone. In the failed run the inventory panel took the click while walking back with the
  extinguisher, before the phone part. Counted as **flaky**, not PASS.

Limits:

- The fire brigade's spraying is checked by the unit test only. No e2e sets a fire and watches the
  lance, the water and the steam.
- The helicopter is seen only through the hole: before the blast it is heard, not seen (the hub's
  windows are painted panes).
- A lab caller's squad walks the doors like the teacher does. Only the hub caller was tried in the
  app.
- Not tried in a LAN room with two players. The snapshot is relayed like the teacher's day, and its
  schema is unit-tested.
- Voice lines use the browser's speech, so they are silent without a voice for the language.

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
   different places for each player. (Shared since F-12: the room's day driver sends his day.)
6. Sounds of the others: their footsteps, their phone call, what they knock or drop.
7. Talking between players: no chat and no voice. (Since F-10: room chat and voice.)
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

## Low and Medium: free optimizations (2026-11-13)

Phú: at Low and Medium, is there still work to cut that does not lower the quality? Only what
changes nothing on screen was in scope. `WorldRenderer.ts` was left alone (another session works
in it), so what needs it is listed under "Found, not done" with its measured size.

### Measured first

Production build, **ANGLE D3D11 on the NVIDIA GeForce RTX 5070 Laptop GPU**, headless Edge,
1280 × 720 at pixel ratio 1, standing still after Continue (a scratch probe reading three's
`renderer.info` and the scene through `__THREE_DEVTOOLS__`, plus CPU profiles; not committed):

| Preset / view         | Draws | Triangles | Programs | Textures | Objects | Materials drawn (changes) | render() CPU | of it: matrices · shadow cache |
| --------------------- | ----: | --------: | -------: | -------: | ------: | ------------------------- | -----------: | ------------------------------ |
| Low, Physics Lab lane |   561 |      145k |       47 |       50 |    2605 | 386 (392)                 |      2.97 ms | 0.67 · 0.22 ms                 |
| Low, Chemistry bench  |   146 |      144k |       44 |       23 |    1485 | 87 (97)                   |      1.48 ms | 0.41 · 0.14 ms                 |
| Low, Biology door     |   547 |      237k |       38 |       28 |    1241 | 357 (358)                 |      2.28 ms | 0.36 · 0.10 ms                 |
| Low, hub spawn        |   157 |      180k |       24 |       13 |     459 | 89 (89)                   |      0.85 ms | 0.09 · 0.04 ms                 |
| Medium, Physics lane  |   561 |      145k |       51 |       58 |    2605 | 386 (392)                 |      4.34 ms | 0.83 · 0.32 ms                 |
| Medium, Biology door  |   547 |      237k |       42 |       36 |    1241 | 357 (358)                 |      3.02 ms | 0.29 · 0.10 ms                 |

Render targets: Low has none sized to the screen and no shadow map (three framebuffers, none
large); Medium has the four 1024² key maps it uses, drawn 0 times in 3 s standing still in every
view (the cache works). Medium's 25 Physics Lab screens are 1728 × 1190 with mipmaps (≈ 260 MB of
GPU memory; Low: ≈ 42 MB at 640 px/m) — their sharpness, so not cut. No per-frame allocation of
the game's own showed up (heap sampling); the one texture upload a frame is the player's bone
texture. Where a Low frame's main-thread time goes (CPU profile, Physics Lab): three's `render`
≈ 90 % — changing material between draws ≈ 35 % (≈ 46 % at Medium, whose light uniforms are sent
again at each program change), every object's world-matrix update ≈ 20 %, culling ≈ 12 %, and
**the shadow cache's walk over the scene ≈ 6 % — at Low, where no light casts a shadow**.

### Changed (each leaves the picture as it was)

- **Empty particle pools no longer drawn** (`render/particles.ts`). The fire's six pools (flames,
  smoke, sparks, the extinguisher's jet: 6 500 points) were drawn every frame in every scene at
  every preset, all points zero-sized, until a first fire. Now a pool is drawn once (its program
  compiled with the scene's, as before: no compile at the first fire), then hidden until a
  particle lives, as it already was after a fire burned out. −6 draw calls a frame everywhere;
  in-page A/B GPU time −0.04 ms (Physics Lab) to −0.09 ms (Biology Lab) a frame. Unit test added.
- **No shadow-cache walk while no light casts** (`render/shadowCache.ts`). At Low (and in a room
  whose lights are off) no map can show a caster, yet every caster's matrix was compared each
  frame. Now the walk is skipped and the caster list emptied; a light that casts again draws its
  whole map at once (`lightChanged`, as before) and its casters are compared from that frame.
  At Low 0.02–0.20 ms → 0.003–0.006 ms a frame (A/B below). Unit test added.
- **One material for every results monitor's slot** (`render/reveal.ts`): the Physics Lab's 18
  slots had 18 identical materials, a material change between each draw; now one (freed with the
  reveals; a dark room's twin is the renderer's, as for every shared material).

### Same picture

Canvas-only screenshots (HUD hidden), five views × Low and Medium, compared pixel by pixel (0–255
per channel). "After" against "before": two production builds made seconds apart from the same
tree, one with these three files as they were (their bundles differ only in that code); the noise
column is one earlier build shot twice:

| View (Low / Medium) | Same build twice (noise)   | Before vs after          |
| ------------------- | -------------------------- | ------------------------ |
| Physics lane        | identical / identical      | identical / identical    |
| Pendulum bay        | identical / 4 px, max 1    | identical / identical    |
| Chemistry bench     | identical / identical      | 12 px, max 1 / identical |
| Biology door        | 6 px, max 12 / 11, max 9   | 8 px, max 12 / 1, max 7  |
| Hub (teacher)       | 15 px, max 51 / 20, max 51 | 12 px, max 4 / 20, max 4 |

Mean difference 0.0000 everywhere (of 921 600 pixels, at most 20 differ); the pixels that differ
are things that move by themselves (the teacher's idle, the Biology Lab's animated specimens), as
between two shots of one build.

### Bench

`npm run bench`'s two lab specs on prebuilt production builds of the same tree with and without
the three files (a scratch config serving them, `--project=gpu-headless`, `BENCH_UNCAPPED=1`,
`--grep-invert "same flight"` after the first round), **ANGLE D3D11, RTX 5070 Laptop GPU**,
1280 × 720, vsync off. On this machine, shared with another session, whole runs swing by up to 2×
(Medium's "before" ran just after that session's e2e and was half as fast in every view, the
changed code included), so these single runs do not show the change; the draw calls do, exactly:

| Scenario (uncapped fps, before → after) | Low, run 1  | Low, run 2  | Medium     | Draws     |
| --------------------------------------- | ----------- | ----------- | ---------- | --------- |
| Physics Lab idle (lane)                 | 245 → 257   | 400 → 370   | 186 → 270  | 561 → 555 |
| Ball in flight                          | 237 → 226   | 351 → 241   | 149 → 234  | 562 → 555 |
| Pendulum idle                           | 430 → 562   | 470 → 752   | 197 → 361  | 195 → 189 |
| Chemistry bench, idle                   | 684 → 772   | 823 → 561   | 294 → 547  | 146 → 140 |
| Biology from the door                   | 378 → 372   | 341 → 428   | 145 → 297  | 547 → 541 |
| Hub idle                                | 1330 → 1346 | 1455 → 1543 | 418 → 1154 | 157 → 151 |

A controlled A/B instead, on the same two builds (headless, vsync off): the same views, before and
after alternated, three rounds (the order swapped each round), `render()`'s own CPU time a frame
(the shadow cache runs inside it), median of the three:

| View             | Low: render() CPU (shadow cache)      | Medium: render() CPU   |
| ---------------- | ------------------------------------- | ---------------------- |
| Physics Lab lane | 2.74 → 2.44 ms (−11 %; 0.204 → 0.005) | 3.88 → 3.81 ms (−2 %)  |
| Chemistry bench  | 1.03 → 0.89 ms (−14 %; 0.070 → 0.003) | 1.37 → 1.32 ms (−4 %)  |
| Biology door     | 2.02 → 1.80 ms (−11 %; 0.074 → 0.006) | 2.86 → 2.58 ms (−10 %) |
| Hub spawn        | 0.52 → 0.48 ms (−8 %; 0.017 → 0.003)  | 0.70 → 0.66 ms (−6 %)  |

Rounds: Low Physics lane before 2.97 / 2.66 / 2.74 ms, after 2.28 / 2.67 / 2.44; Medium Physics
lane before 3.88 / 6.87 / 3.63, after 3.82 / 3.68 / 3.81. So Low's render CPU drops by about a
tenth in every view (the shadow walk most of it); Medium gains 6 draws a frame and fewer material
changes, a few per cent, at the edge of this machine's noise.

### Found, not done

Measured by trying them in the page (the probe swaps them in at run time; not code changes),
Low and Medium, render() CPU and GPU time a frame, each against a fresh baseline:

- **Entity materials shared until one changes** (`WorldRenderer.addEntity` makes a material per
  entity: 175 materials for 21 different ones in the Physics Lab's view; bench builders add 211 for
  118). Shared, the frame's material changes fall from 392 to ~140. In the page: Low Physics lane
  CPU 3.00 → 2.37 ms, GPU 0.81 → 0.63 ms; Medium 4.40 → 3.22 ms, GPU 1.34 → 0.76 ms; Biology
  Medium 3.40 → 2.59 ms. The largest free gain left, but it needs `WorldRenderer.ts`: the entity's
  material is changed in place for focus, `active`, charred and a dark fixture (`refresh`), so it
  must become copy-on-write (a private clone while it differs), and the reveals and rigs that
  take the body material must follow. The bench builders' own duplicates (`own(new
MeshStandardMaterial(...))` per rig, ~100 files) are the other part, one builder at a time.
  (Both done since: "Shared entity paints" and "Shared bench materials" below.)
- **Static matrices**: three recomputes every object's world matrix every frame (2605 objects in
  the Physics Lab, all `matrixAutoUpdate`). With none updated (the ceiling, idle): −0.26 ms (Low
  Physics lane) to −0.41 ms (Low Biology). Needs `scene.matrixAutoUpdate = false` in
  `WorldRenderer` and every builder to mark what never moves; a large change for that ceiling.
- **Empty instanced draws** (15 in the Biology Lab: bench counts at 0): three skips their GL draw
  already; hiding them saved nothing measurable. Not done.
- **Opaque draws sorted by program first** (`renderer.setOpaqueSort`): inconclusive (±0.2 ms both
  ways). Not done.
- Medium's dark key slots stay in the shaders (by design: no recompile when rooms change); its
  shadow maps carry an unused colour attachment (three's PCF target): three's internals, not ours.

### Checks

| Check                                                                                                                                                                                                                                                                         | Result                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`                                                                                                                                                                                                                                                       | PASS                                                                                                                                                                                                                              |
| `npx eslint .`                                                                                                                                                                                                                                                                | PASS                                                                                                                                                                                                                              |
| `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                                                                                                                                                                    | PASS (also with this section)                                                                                                                                                                                                     |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                                                                               | PASS — 320 files, 4062 tests (new: `particles.test.ts`; `shadowCache.test.ts` + 1)                                                                                                                                                |
| `SIMLAB_DEV_ONLY=1 SIMLAB_DEV_PORT=5211 npx playwright test e2e/shadows.spec.ts e2e/draw-calls.spec.ts e2e/resources.spec.ts e2e/circuit-fire.spec.ts e2e/settings.spec.ts e2e/canvas.spec.ts e2e/room-sleep.spec.ts --project=dev --workers=1 --reporter=line` (SwiftShader) | 30 PASS (shadows, 14 draw-calls, circuit-fire, 7 settings, 2 canvas, 4 room-sleep, warm-up); 1 FAIL: `resources.spec.ts`, lab trip 3 has +1 Buffer and +1 VertexArray against trip 2                                              |
| the same `resources.spec.ts`, `--repeat-each=2`                                                                                                                                                                                                                               | FAIL ×2, the same +1/+1                                                                                                                                                                                                           |
| the same `resources.spec.ts` with these three files reverted (then restored)                                                                                                                                                                                                  | FAIL, the same +1 Buffer/+1 VertexArray: **not caused by this work** (in the shared working tree of 2026-11-13; with this work the lab has 8 vertex arrays fewer, 873 against 881)                                                |
| the bench specs, before/after builds (above)                                                                                                                                                                                                                                  | 7 PASS each run; `physics-lab.bench.ts` "the same flight at every frame rate" FAIL in both the before and the after build when uncapped (the "Flight time" notice not shown in 60 s); left out of the later runs, not looked into |

Not seen on Phú's 300 Hz display; no change there is visible by design (the pixel comparison).

## Shared entity paints, and unused code out (2026-11-13)

Phú: do the largest free gain left ("Làm luôn"), then look through the game's files for unused
modules and code and take them out.

### Shared entity paints

`WorldRenderer.addEntity` made one material per entity (175 in the Physics Lab's view, 21 looks).
Now entities of one look and colour share one (`render/sharedMaterials.ts`, freed with its last
owner). Glass (finishes filter it), a light (dark with its room) and a reveal (its body made
see-through) keep their own as before. An entity that differs from its look — focused, `active`,
charred or broken — draws with a copy of its own meanwhile (`WorldRenderer.repaint`): the copy is
made as the shared one was (so the same program, no compile), every part painted with the body's
material swaps (a rig's frame shares it), Ultra's surfaces and the finishes are laid on it, a dark
room's twin is redone; back to its look, the shared one returns and the copy is freed. Unit test
in `WorldRenderer.test.ts` (sharing, focus on the copy only, all painted parts swapped, charred,
freed with the last owner).

Same picture: production builds of the same tree with sharing on and off (one line), canvas-only
screenshots, five views × Low and Medium (**ANGLE D3D11, RTX 5070 Laptop GPU**, headless Edge,
1280 × 720): Physics lane identical at both presets, pendulum identical / 4 px (max 1); elsewhere
at most 22 of 921 600 pixels differ, mean 0.0000 — the teacher's idle and the Biology Lab's
specimens, as between two shots of one build. Draws and programs unchanged in every view (e.g.
Low Physics lane 555 draws, 47 programs); materials drawn a frame: Physics lane 588 → 324,
Chemistry 457 → 283, Biology 381 → 219, hub 101 → 86.

`render()` CPU a frame, the same two builds alternated, six rounds (two sets of three; the first
set's first round was slow for both builds — the machine was busy), median and best:

| View             | Low median          | Low best            | Medium median       | Medium best         |
| ---------------- | ------------------- | ------------------- | ------------------- | ------------------- |
| Physics Lab lane | 2.89 → 2.34 ms −19% | 2.51 → 1.94 ms −23% | 4.05 → 3.49 ms −14% | 3.93 → 2.58 ms −34% |
| Biology door     | 2.15 → 1.77 ms −18% | 1.86 → 1.35 ms −28% | 2.76 → 2.36 ms −15% | 2.53 → 1.99 ms −21% |
| Chemistry bench  | 0.90 → 1.03 ms +15% | 0.86 → 0.80 ms −7%  | 1.42 → 1.39 ms −2%  | 1.10 → 1.04 ms −5%  |
| Hub spawn        | 0.49 → 0.49 ms −1%  | 0.48 → 0.45 ms −6%  | 0.68 → 0.68 ms +1%  | 0.66 → 0.61 ms −9%  |

The labs with many entities gain about a sixth; Chemistry and the hub, with few entity materials,
are within this machine's noise. The bench builders' own duplicate materials (about 100 files)
are not touched.

### Unused code

No tool installed for it (none added): a scratch script on TypeScript's own API followed every
import (static, dynamic, `?url`, CSS, `import.meta.glob`) from `src/main.ts`, the dev/preview
server (`vite.config.ts`) and the tests, and counted every reference of every export (shorthand
properties and dynamic `import()` checked by hand). Found and removed:

- `render/bench/dilution-station.ts` (697 lines) and its test (425 lines, 10 tests): the old
  dilution bench, never registered since the physical lab draws dilution with
  `dilution-colorimeter` (the architecture note left keep-or-delete to the lead).
- Functions and constants no code reads: `targetPoint` (action.ts), `putNumber` (chem-kit.ts),
  `FADE_MS` (LaptopView.ts); seven type aliases nothing names (`SquadLines`, `NpcChoiceText`,
  `NpcLesson`, `TaskDone`, `SharedCommand`, `WorkspaceBinding`, `LabType`); a stale doc comment
  in `MainMenu.ts`.
- `public/hub-city/Street_Asphalt_9x9.gltf` and its `.bin` (4 KB): a city piece no code loads (its
  textures are the other pieces' too, kept).

Kept on purpose: test helpers and fixtures (`game/testing.ts`, `benchFixture.ts`…, never in the
build), the room server (`multiplayer/roomsPlugin.ts`…, dev/preview server only), exports read by
tests or by a glob (`pieces`, the models' checks). Dependencies: the four the game ships with
(three, Rapier, Zod, MediaPipe) and the eleven tools are all used; `npm ls` lists nothing
extraneous.

What it changes in the game's weight: almost nothing — Vite already left unreached code out of the
build. Production build 147.251 → 147.249 MB (assets 26.06 MB both). Of the build, 121 MB is
`public/`: Ultra's surfaces (≈ 105 MB, fetched only on Ultra), the hub city (9.8 MB, fetched in the
hub), MediaPipe's models (4.3 MB, only for a face from a photo); the start page loads `index` (746
KB) and three small chunks — the question banks (2.4 MB) and the lab pack (1.9 MB) are fetched
when needed.

### Checks

| Check                                                                                                                                                                                                                              | Result                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                                                                                | PASS                                                                                                                                          |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                                    | PASS — 319 files, 4053 tests (+1 paints test, −10 with the old dilution bench)                                                                |
| `SIMLAB_DEV_ONLY=1 SIMLAB_DEV_PORT=5197 npx playwright test e2e/draw-calls.spec.ts e2e/shadows.spec.ts e2e/circuit-fire.spec.ts e2e/grab.spec.ts e2e/settings.spec.ts e2e/guided-task.spec.ts e2e/resources.spec.ts --project=dev` | 25 PASS; 1 FAIL `resources.spec.ts` (lab trip 3 +1 Buffer, +1 VertexArray: the same failure as without this work, above)                      |
| `... npx playwright test e2e/hub-city-walk.spec.ts --project=dev --repeat-each=2` (SwiftShader, ~8 fps)                                                                                                                            | FAIL 2 of 2 with sharing and 2 of 2 with it off: the physics-lab → hub door stays `preparing` past 15 s. Not this work; cause not looked into |

Not seen on Phú's 300 Hz display; nothing here is meant to be visible (the pixel comparison).

## The lab–hub door's long `preparing` (2026-11-13)

Phú: look into the city spec's failure ("Điều tra luôn"). `hub-city-walk.spec.ts` waited 15 s
for the Physics Lab → hub door to open and it stayed `preparing`, with or without the shared
paints. A temporary probe (pressed E at the door, logged the door's states and the renderer's
timings; deleted after) on SwiftShader at High, 640 × 360:

| Build                        | Hub's shaders ready | Door fully open after E |
| ---------------------------- | ------------------- | ----------------------- |
| 934e493 (a scratch worktree) | 14 279 ms           | 18.5 s                  |
| working tree, before the fix | 13 950 ms           | 17.8 s                  |
| working tree, with the fix   | 4 128 ms            | 8.2 s                   |

So it was not today's work: the commit already took as long. Split with temporary logs: the
compile of the hub's 170 objects took 618 ms (one new program); the rest was the warm-up drawing
the 121 objects whose first draw does driver work (`warmDraw`) — **one a frame for 13 s**. Its
batch halves after a frame over 1.5 × the usual interval (`frameDt`, frozen while it warms). With
the hub attached SwiftShader's frames were ~100 ms against the 60 ms before, whatever the batch,
so the batch fell to 1 and stayed there: 121 frames at ~9 FPS. A slow machine would do the same
(fewer seconds), the door shut meanwhile.

Fix (`WorldRenderer.warmBatch`, unit test): slow frames shrink the batch only during the
warm-up's first second (`WARM_MAX_S`); past it the batch doubles each frame up to `WARM_BATCH`
(40), so the rest is drawn in a few frames while the door is still shut. On the real GPU the
warm-up ends before that second, so nothing changes there — measured on the dev server, headless
Edge, **ANGLE D3D11, RTX 5070 Laptop GPU**, 1280 × 720, vsync off, with the cap and with it off:

| Preset | Hub's shaders ready (cap / no cap) | Frames E → open: p99, max, over 33 ms (cap / no cap) |
| ------ | ---------------------------------- | ---------------------------------------------------- |
| Low    | 481 / 480 ms                       | 4.8, 193.6 ms, 3 / 5.8, 191.9 ms, 2                  |
| High   | 550 / 550 ms                       | 12.6, 193.7 ms, 2 / 11.0, 191.6 ms, 2                |
| Ultra  | 855 / 800 ms                       | 17.2, 211.8 ms, 2 / 14.9, 177.5 ms, 2                |

(single runs; the ~190 ms frame is the hub's spawn on attach, in both, not the warm-up.)

### Checks

| Check                                                                                                                                                              | Result                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                | PASS                                                                                                                                                                                                       |
| `npx vitest run --maxWorkers=4`                                                                                                                                    | PASS — 319 files, 4054 tests (+1 `warmBatch`)                                                                                                                                                              |
| `SIMLAB_DEV_ONLY=1 SIMLAB_DEV_PORT=5197 npx playwright test e2e/hub-city-walk.spec.ts e2e/doors.spec.ts e2e/experiment.spec.ts e2e/pendulum.spec.ts --project=dev` | 6 PASS (the city walk and the doors); 2 FAIL: `experiment.spec.ts` and `pendulum.spec.ts` exceed their 300 s on SwiftShader (at Low), as at 934e493 — the fix does not reach them; not looked into further |

Not seen on Phú's 300 Hz display. Left: the hub's spawn frame (~190 ms on the RTX 5070, every
preset) when the door is asked to open — a stutter there, not addressed here. (Since: it was the
teacher being built, "The hub door's long frame" below; the two specs over 300 s, "e2e walks"
below.)

## Shared bench materials (2026-11-13)

After the shared entity paints, the bench builders' own materials were most of what a lab draws:
each builder (`render/bench/*.ts`, `launcherModel`, `pendulumModel`, `towerModel`, `hookeModel`)
made its own through its `Assembly` kit, so two benches with the same steel, the same white plastic
or the same glass drew with two materials (a material switch each, three sorting opaque draws by
material).

Now `Assembly.own` gives back one material for every assembly that makes the same
(`render/assembly.ts`): its key (`lookKey`) is every value of the material as text (colours exact,
not as hex; its id, uuid and version left out), kept in one module-level `SharedMaterials`
(`render/sharedMaterials.ts`), given back by each kit's `dispose()` (once, if disposed twice) and
freed with the last. Never shared (`lookKey` null, the kit's own as before): a material drawn on a
texture (a label, a readout's canvas), one with a function of its own (a shader hook), clipping
planes, or a `ShaderMaterial`. Finishes (glassware filter, metal reflection), Ultra's surfaces and
the dark-room shading already work per material, so a shared one takes them once.

A material the rig changes later takes `kit.mine(...)`, its own, freed with the assembly: 28 in 20
builders — glows (AC generator bulb, decay counter, pondweed lamp, potometer bulb, hot-plate and
solubility heaters), liquids and tints (buoyancy cube and liquid, colorimeter mix, microscope tint,
food-test tube, galvanic electrodes and electrolytes, enzyme mixture, halogen layers, NO₂ gas and
bath, precipitation liquid/cloud/solid, titration flask, pH-meter drop, plant-cell protoplast,
rusting iron and zinc), fades (ray-optics block and rays). Found by type, not by name: a scratch
script on TypeScript's own API listed every write to a material or a colour, every read of one and
every material passed to a function in the 73 builder files; the two `own(x);` that kept their own
reference (`x`, not what `own` gives back), the AC generator's bulb and the plant cell's protoplast,
were both changed later. The hot plate's beaker glass set `depthWrite = false` after `own`: now in
its parameters (still shared, the same picture).

Tests: `assembly.test.ts` (one material across two kits for the same values, another colour or look
apart, freed with the last kit and given back once if disposed twice; a `mine`, textured or hooked
material never shared and freed with its kit; colours keyed exactly — two of one hex apart — and
names and `depthWrite` apart). `bench/registry.test.ts`: every bench model, built for each bundled
item that uses it and posed in every state with its reads at 0, half, full scale and NaN and its
experiment's parameters at their minimum, default and maximum, changes no material it shares (77
tests); turning the 28 `mine` back into `own` fails the test of all 20 builders. The 20 bench tests
that check "frees everything it made" now free the rigs each test builds (`afterEach`): a shared
material is freed with its last owner, and rigs left over from earlier tests held it.

Same picture: production builds of the same tree with sharing on and off (one line), canvas-only
screenshots, five views × Low and Medium (**ANGLE D3D11, RTX 5070 Laptop GPU**, headless Edge, 1280
× 720): identical in 5 of the 10; in the others at most 25 of 921 600 pixels differ (largest channel
difference 12, mean 0.0000) — less than two shots of the sharing-off build differ in the same views
(up to 43 pixels, largest 41, in the hub and Biology views). Draws, programs and triangles unchanged
in every view (e.g. Low Physics lane 555 draws, 47 programs, 144 818 triangles). Materials drawn a
frame:

| View             | Before | After |
| ---------------- | -----: | ----: |
| Physics Lab lane |    324 |   217 |
| Physics pendulum |    365 |   242 |
| Chemistry bench  |    283 |   237 |
| Biology door     |    219 |   196 |
| Hub spawn        |     86 |    86 |

(Physics lane: 205 distinct looks drawn by the probe's signature, so 12 duplicates left — textured
and `mine` materials.)

`render()` CPU a frame, the same two builds alternated (headless Edge, uncapped, **ANGLE D3D11, RTX
5070 Laptop GPU**). The machine was shared with other projects' builds and tests this evening: each
pair started only with the CPU otherwise quiet, and a pair with the CPU over 55 % during either run
was dropped (2 of 6; two earlier ungated attempts were dropped whole for the same reason). Four
pairs, median and best:

| View             | Low median          | Low best            | Medium median       | Medium best        |
| ---------------- | ------------------- | ------------------- | ------------------- | ------------------ |
| Physics Lab lane | 3.26 → 2.70 ms −17% | 2.51 → 2.19 ms −13% | 4.34 → 4.49 ms +3%  | 3.53 → 3.34 ms −5% |
| Biology door     | 2.02 → 1.73 ms −14% | 1.87 → 1.66 ms −11% | 3.35 → 2.67 ms −20% | 2.56 → 2.48 ms −3% |
| Chemistry bench  | 1.06 → 1.21 ms +15% | 0.92 → 0.96 ms +3%  | 1.52 → 1.64 ms +8%  | 1.46 → 1.36 ms −7% |
| Hub spawn        | 0.52 → 0.52 ms 0%   | 0.51 → 0.52 ms +1%  | 0.77 → 0.76 ms −2%  | 0.69 → 0.70 ms +1% |

Low's Physics Lab and Biology Lab gain about an eighth to a sixth; Medium and Chemistry are within
this machine's noise (the hub, with no bench, is the control). Counted instead of timed (the same
builds, every WebGL call over 2 s, per frame): Physics lane Low 2 231 → 2 103 calls (`useProgram`
132 → 108, `uniform*` 1 076 → 974), Medium 2 945 → 2 763 (`uniform*` 1 770 → 1 614); pendulum 822 →
812; Biology 2 071 → 2 056; Chemistry 708 → 704; hub 613 → 613; draws the same in each.

Left as it is: materials drawn on a texture (in ten builders: scales, labels, screens) and the
optical bench's image `ShaderMaterial` — each is the rig's own drawing; the 28 changing materials
(they must stay apart). A shared material used both by an instanced part and a plain one makes three
pick its program again between them (materials drawn so: Physics lane 17 → 14, Chemistry 5 → 6,
Biology 6 → 8); not split: `useProgram` calls fell, none rose.

### Checks

| Check                                                                                                                                                                     | Result                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                       | PASS                         |
| `npx vitest run --maxWorkers=4`                                                                                                                                           | PASS — 320 files, 4134 tests |
| `SIMLAB_DEV_ONLY=1 SIMLAB_DEV_PORT=5213 npx playwright test e2e/draw-calls.spec.ts e2e/shadows.spec.ts e2e/settings.spec.ts e2e/canvas.spec.ts --project=dev --workers=1` | 25 PASS, none flaky          |

Reviewed (the assembly change, the `mine` list, the tests): every material changed after `own` is `mine`; the two `own(x)` that kept `x` are among them.

## The hub door's long frame: the teacher built in it (2026-11-13)

Left by the warm-up fix above: a ~190 ms frame on the RTX 5070, every preset, when the Physics
Lab → hub door was asked to open. A temporary probe (the dev server, headless Edge, **ANGLE
D3D11, RTX 5070 Laptop GPU**, 1280 × 720, vsync off; frames from E to the door open, a CPU
profile at 0.1 ms; deleted after) found it was not the hub's spawn but the teacher's: the first
frame the hub was resident, `NpcActors` built his body (`buildBody`, ~130 ms in the profile, which slows it) and
three, sorting it, skinned every vertex of each of his meshes to find their bounding spheres
(`SkinnedMesh.computeBoundingSphere` → `applyBoneTransform`, ~90 ms) — once per mesh, at its
first draw, culled or not. A program first used there waited for its link (~34 ms).

Fix:

- `BodyModel.buildBody`: each skinned mesh's bounding sphere is taken at rest from its geometry
  (`rested`). Bodies are never culled (`frustumCulled` false), so only the draw order reads it;
  nothing raycasts them. Every body gains: the player's own, other players', the character page's.
- `NpcActors.prepare`: the people of a loaded scene and of the scenes next door are built during
  the load (`SceneLoaded`, behind the loading screen), hidden, so their programs compile with the
  scene's hidden parts (`compileHidden`); a person whose scene leaves is hidden and kept (built
  again it would cost a door's frame), its geometry's buffers freed (uploaded again when next
  drawn), freed whole with the renderer. `WorldRenderer.neighbours` is the one list of a scene's
  neighbours (`prewarmNeighbours` uses it too).

Freeing the buffers of the one kept: without it `resources.spec.ts` read the lab growing with the
teacher's hand props first drawn in a later hub visit (lab[3] +9 buffers and +3 vertex arrays
against lab[2], the hub the same +9); with it the lab reads as before this work (873 vertex arrays
at trip 2) and only the pre-existing +1 buffer and +1 vertex array a trip remain (below).

Tests: `body/actor.test.ts` (every skinned mesh of a person has its sphere at build, around the
body); `npcActors.test.ts` (built hidden for the scenes asked and none other; shown when the
scene comes; hidden, kept, its buffers freed and its contact shadow gone when it leaves; the same
body when it comes back; freed on dispose).

Measured with the fix in and out (the two lines toggled in place, alternated, three rounds, one
run of each preset a round; the same probe and GPU as above). The machine was busy with other
sessions this evening — frames are 2–4 × the quiet run above, so compare in and out, not with it:

| Preset | Largest frame 0.85–1.0 s after E (the teacher's build): out → in | Largest frame after E: out → in  |
| ------ | ---------------------------------------------------------------- | -------------------------------- |
| Low    | 401, 382, 770 → 34, 31, 46 ms                                    | 401, 382, 770 → 55, 127, 168 ms  |
| High   | 285, 687, 818 → 29, 99, 71 ms                                    | 285, 687, 818 → 178, 329, 429 ms |
| Ultra  | 303, 385, 373 → 56, < 68, 64 ms                                  | 531, 533, 530 → 411, 998, 64 ms  |

The teacher's frame is gone in every run. **Found, not done:** a later long frame, in and out alike
(1.3–3.2 s after E), is the page waiting on the GPU process while it compiles the hub's programs
(`precompile`'s batches): the profiles show it inside `uniformMatrix4fv` (122–561 ms) or a
program's first `getProgramParameter` (219 ms), not in our code. Its size follows the machine's
load (one Ultra run 998 ms, another 64 ms); not looked into further. Measured on a first visit
only (the buffers freed on leaving are uploaded again on the next one: not timed).

## e2e walks: `approach` measured, not tapped (2026-11-13)

`experiment.spec.ts` and `pendulum.spec.ts` ran past their 300 s on SwiftShader (above; with the
limit raised to 600 s they took 454 s and 519 s). A scratch copy of each spec logging every step
(deleted after) put the time in the walks: `approach` (e2e/support.ts) tapped W for 120 ms, then
waited 300 ms for the debug text; at SwiftShader's few frames a second a tap moved a few
centimetres — `approach(1, -8.4)` in pendulum.spec took 55.8 s for 5 m. Now each hold is half the
way left at the rate the last hold moved (coasting included; walking speed the first time),
0.12–3 s, aimed again before each as before, so it stops short of the point and never past it.
The timed copy of experiment.spec then took 213 s for its whole body.

Also out (no code reaches them since F-13): the fire notice `brigade-arrived`, the phone outcome
`false-alarm`, their two strings; `npcDay`'s doc comment back on its member (`protocol.ts`).

### Checks (2026-11-13/14)

e2e on SwiftShader (software WebGL): counts and PASS/FAIL only, no timing is a GPU result.

| Check                                                                                                                                                                                                                                                                                                | Result                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                                                                                                                                                  | PASS                                                                                                                                                                                                                                                                                              |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                                                                                                      | PASS — 321 files, 4137 tests (after every change here)                                                                                                                                                                                                                                            |
| `SIMLAB_DEV_ONLY=1 SIMLAB_DEV_PORT=5197 npx playwright test` the 29 specs that call `approach`, and `hub-city-walk`, `doors`, `world`, `teacher`, `test-paper`, `multiplayer-world`, `resources`, `draw-calls`, `transitions` (`.spec.ts`) `--project=dev --workers=1` (before the buffers' freeing) | 100 PASS (`experiment.spec.ts` in 4.4 min), 6 FAIL in 1.8 h while another project's Playwright run kept the CPU at 80–100 % (0–6 FPS): `doors.spec.ts` ×2 and `hub-city-walk.spec.ts` (a door still `preparing` after 15 s), `free-fall.spec.ts`, `pendulum.spec.ts` (300 s), `resources.spec.ts` |
| the same command on `doors`, `free-fall`, `hub-city-walk`, `pendulum`, `resources` (CPU 26 %)                                                                                                                                                                                                        | 8 PASS (`pendulum.spec.ts` in 4.0 min); `resources.spec.ts` FAIL: lab[3] +9 buffers, +3 vertex arrays (the kept teacher's props: fixed, "The hub door's long frame")                                                                                                                              |
| after the fix: `resources`, `teacher`, `test-paper`                                                                                                                                                                                                                                                  | `test-paper` PASS, `teacher.spec.ts:13` PASS; `resources.spec.ts` FAIL: lab +1 buffer and +1 vertex array a trip — the pre-existing failure (also at 934e493, above); `teacher.spec.ts:80` FAIL (the next lecture line not ready within 5 s)                                                      |
| `teacher.spec.ts` again (CPU 73 %, the other project's run back); `teacher.spec.ts:80` with the buffers' freeing out, then in (CPU 52 %); `teacher.spec.ts:80 --repeat-each=2` (CPU 57 %)                                                                                                            | `:13` PASS, `:80` FAIL at the same step; then PASS, PASS; then PASS ×2 — **flaky** under load (PASS in the batch; flaky once in F-9 too), not a clean PASS                                                                                                                                        |
| after the fix: `doors`, `hub-city-walk`, `multiplayer-world` (CPU 14–36 %)                                                                                                                                                                                                                           | 10 PASS                                                                                                                                                                                                                                                                                           |

Not seen on Phú's 300 Hz display.

## Smoother doors between the labs and the hub (2026-11-14)

Phú: moving between a lab and the hub stutters a lot ("bị khựng khá nhiều"). Measured first, with a
temporary probe (deleted after): Continue into the Physics Lab at its hub door, walk through into
the hub, wait for the door to close, walk back — every frame's time (requestAnimationFrame) with
the steps' times, on the dev server, headless Edge, **ANGLE D3D11, RTX 5070 Laptop GPU**,
1280 × 720, vsync off; then CPU profiles, a Chrome trace of the GPU process, and WebGL calls
counted and timed in the page (bytes uploaded a frame, programs first used, calls over 15 ms).

### What stalled

1. **Walking into the hub (High, Ultra): the city under the glass.** Its textures were uploaded in
   one frame (`CityView.upload`: texSubImage2D 183 ms at High, 234 ms at Ultra) — and they were
   ~70 textures of 20 pictures: each of the six models' loaders made its own of the pictures they
   share (a picture in up to five models), each uploaded (4.2 MB a 1024² one).
2. **A door's warm-up (every preset).** It drew up to 40 objects a frame into one pixel, and each
   object's first draw uploads its textures: one frame uploaded the hub's boards and signs (61 MB
   of canvases), the Physics Lab's station screens (1728 × 1190, 8.2 MB each, ~25 of them) went
   5–7 a frame. The page then waited on the GPU process — the trace shows the renderer's main
   thread in `CommandBufferHelper::WaitForAvailableEntries` for 113 ms while the GPU process ran a
   133 ms flush of our commands; in the page it showed as 100–125 ms inside `uniformMatrix4fv`.
3. **Ultra: a room's reflections.** Each capture made and freed a `PMREMGenerator`, so its
   `CubemapToCubeUV` program was compiled and linked again each time, in the frame a room was
   walked into (its first use waited 23 ms; the frame ~130 ms).
4. **The Physics Lab's dressing** (Phase U, `dress/starship.ts`) was built again in the attach
   frame each time the lab came in (~24 ms of a profiled frame).
5. **The hub's air and reverb** were made in the frame the hub was walked into (`renderSynth`,
   `impulseResponse`: ~44 ms of a profiled frame), once a session.

### Changed

- `city/CityView.ts`: `shareTextures` — one texture per picture for the whole city (the same
  picture in the same setting: URI, colour space, channel, wraps, filters, transform); `textures`
  instead of `upload`. `WorldRenderer.loadCity` uploads them one a frame before the city is shown.
- `WorldRenderer.warmStep`: a batch also stops at 8 MB of new texture data (`WARM_BYTES`,
  `warmEnd`, `newTextureBytes` from three's own record of what it uploaded), always at least one
  object.
- `WorldRenderer.pmremOf`: one prefilter for the renderer's life, its cubemap program compiled
  with the room light (`compileCubemapShader`); freed with the renderer.
- `WorldRenderer.dressOf`: a room's dressing kept by room and place (`dresses`; forgotten on a
  load), built in idle time when its scene starts attaching (`SceneAttaching`), its geometry freed
  with the shells and uploaded again.
- `audio`: `SoundOut.prepare` — when a scene starts attaching, its rooms' reverb and air are made
  in idle time (`AudioView.prepare`, one room a callback; `reverbOf` shared with `room`).

Tests: `city/CityView.test.ts` (a picture the models share is one texture, one in another setting
or not from a model's picture is kept); `WorldRenderer.test.ts` (`warmEnd`: 8 MB, at least one,
the count still holds); `audio/cues.test.ts` (a scene attached has its rooms prepared).

### Measured

The longest frame of each step, before (aa766b8) and after; one run of
each preset before, two round trips after (first / second visit). Frame times vary ±20 ms between
runs on this machine; vsync off, so a frame is the renderer's own.

| Preset | Lab door opening | Walking into the hub | Hub door opening  |
| ------ | ---------------- | -------------------- | ----------------- |
| Low    | 55 → 35 ms       | 37 → under 25 ms     | 152 → 83 / 52 ms  |
| High   | 131 → 42 ms      | 187 → 80 / 53 ms     | 128 → 109 / 59 ms |
| Ultra  | 131 → 46 ms      | 368 → 87 / 101 ms    | 363 → 107 / 95 ms |

Same picture: the city looked down at through the glass, with the shared textures and without
(the one line toggled), High: identical but for 1/255 in 0.5 % of pixels; Ultra: within what two
shots of one build differ by (its traffic moves), and looked at.

### Left

- The first hub → lab door still has one frame of 73–109 ms: the GPU process doing the lab's first
  draws (draw calls and uniforms waiting 30–45 ms in the page; ANGLE builds D3D shaders per vertex
  layout at a first draw). A second visit: 52–95 ms.
- Ultra runs at ~30 FPS (33–35 ms frames) while both scenes are resident — the five seconds of a
  crossing: both are drawn, with GTAO and the shadow maps the moving door redraws.
- Ultra's first visit to a room still takes its six capture faces, a face a frame.
- Not seen on Phú's 300 Hz display.

### Checks

| Check                                                                                                                                                                                                                                                                                                                                                                       | Result                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check src e2e docs CLAUDE.md package.json`                                                                                                                                                                                                                                                                         | PASS                                                                                                                                                               |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                                                                                                                                                                             | PASS — 322 files, 4140 tests                                                                                                                                       |
| `SIMLAB_DEV_ONLY=1 SIMLAB_DEV_PORT=5197 npx playwright test e2e/doors.spec.ts e2e/hub-city-walk.spec.ts e2e/transitions.spec.ts e2e/world.spec.ts e2e/resources.spec.ts e2e/sound.spec.ts e2e/room-sleep.spec.ts e2e/draw-calls.spec.ts e2e/settings.spec.ts e2e/teacher.spec.ts e2e/multiplayer-world.spec.ts e2e/shadows.spec.ts --project=dev --workers=1` (SwiftShader) | 41 PASS; 1 FAIL `resources.spec.ts`: the pre-existing +1 buffer and +1 vertex array a lab trip, the same counts as before (lab[2] 3535 buffers, 873 vertex arrays) |

## Results

The latest runs are in each section's Checks above (the last: "Smoother doors", 2026-11-14). This
table is 2026-11-11's; e2e on SwiftShader (software WebGL, ~2–6 FPS): no performance number here
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
  him) is the room's day driver's since F-12, drawn the same by the others.
- `resources.spec.ts`: the lab holds one more buffer and vertex array each lab–hub round trip
  (pre-existing, also at 934e493; not found yet). `teacher.spec.ts:80` is flaky on a loaded
  machine (its next lecture line not ready within 5 s).
- A door to the hub: a long frame remains while the GPU process compiles the hub's programs
  (`precompile`; 64–998 ms on a loaded RTX 5070 machine, "The hub door's long frame").
- Being hit hurts no one (no health): a flash and waking up.
- The laptop's books are Vietnamese only; their content is checked for shape, not proof-read by a
  teacher; some titles/numbering follow one textbook series and may differ from another.
- A face from a photo: tried only on the game's own drawn face, never on a real photo or a real camera; its average-face constants are estimates. Its picture (F-8b) is kept with the character and seen by the others in a LAN room.
- Not looked at on the 300 Hz display; multiplayer not tried on two real computers.

## Next

Phú's checks on the real display (fire tiers, phone, laptop intro, books, sleeping, a LAN game on
two computers, the doors to the hub and the labs' frame rate after the shared materials);
translate the books; draw held objects' models for remote players; the hub door's remaining long
frame (the GPU process compiling while frames are drawn); the lab's +1 buffer a trip.

## The hub's periodic table, interactive (2026-11-14)

Phú: the periodic table on the hub's wall can be used — a tile looked at lights and the element's
information shows beside it, on a transparent pane that goes when the player walks away; the tiles
carry an element's full information, "like a real periodic table". Before, the display was coloured
tiles by block, no text, no interaction. First made with a key (E or a click); then Phú: no key —
the centre of the screen on a tile shows it at once — and the lit tile "kept blinking" (its glow
breathed): now steady.

**Data** (`content/periodic-table.json`, `content/periodicTable.ts`, Zod; downloaded with Phú's
permission, both public): PubChem's periodic table (NIH; `pubchem.ncbi.nlm.nih.gov/rest/pug/
periodictable/JSON`, 44 KB) — names, category, electron configuration, Pauling electronegativity,
oxidation states, standard state, melting and boiling points (K), density (g/cm³), first
ionization energy and electron affinity (eV), van der Waals radius (pm), year of discovery — and
CIAAW's abridged standard atomic weights (2021; `ciaaw.org/abridged-atomic-weights.htm`, 18 KB):
all 118 checked symbol by symbol and name by name between the two. 34 elements have no standard
atomic weight: the mass number of the isotope PubChem gives, in brackets ([97] for technetium). Names
in IUPAC's spelling in both languages (Phú: as the 2018 textbooks; PubChem's Aluminum and Cesium
written Aluminium and Caesium). Values are shown as the sources give them: never computed into
another value but °C from K (to the same decimals) and kJ/mol from eV (CODATA's e·N_A, to the
same significant figures); a value a source does not give is "—"; calculated configurations and
expected states are marked "predicted". The chemistry workspace's own lens (`elements.json`,
weights only where a model uses them) is left as it was; a test checks the two agree (symbols, the
ten weights).

**Layout** (`gameplay/periodic/layout.ts`, pure): each element's cell — groups 1–18, periods 1–7,
lanthanum to lutetium and actinium to lawrencium in two rows under the table — the same cells the
display's tiles stand on (`props/hub.ts`), and `elementAt` reading a point on the board back to
its tile.

**Rules** (`gameplay/periodic/PeriodicTableSystem.ts`): no action, no key — every frame the aim ray
(the centre of the screen) is met with each display (items tagged `periodic-table`; decor, so no
prompt) within 4 m: its card first (`layout.ts` `cardPlace`, `CARD`: the card stands over other
tiles, and the aim on it keeps it, so it can be read), then the board's face — on a tile, that
element is shown; between tiles it stays; off the display for 0.4 s (`AWAY_S`), farther than 4 m,
or another scene, it goes. No allocation a frame (the tile lookup is a typed array). Never saved,
never shared.

**View** (`render/periodicBoard.ts`): the print over the tiles — each tile its atomic number,
electronegativity, symbol, name, standard atomic weight and electron configuration, in its
category's colour (ten, solid); the title, a legend, a key (iron's tile, its fields named), the
groups numbered 1–18 with the A/B names Vietnamese textbooks use (IA … VIIIA) under them, the
periods, where the f block comes from (57–71, 89–103) — drawn in idle time a few tiles at a time
when the hub is there, uploaded in an idle period of its own, freed when the hub goes; backlit a
little (an acrylic display). The element shown: its tile's glow (steady), and its card beside
it towards the board's middle, 12 cm before the board — a pane of tinted glass with a bright rim
and a pointer to the tile: the tile large, the name and category, group (and A/B name) and period,
then the twelve values, the sources at its foot; it fades in and out (0.18 s).

**The display lowered** from 1.5 to 1.15 m above the floor (and the atom display across the hall
with it, to keep the pair): its top rows were at 3.5–3.8 m, past the interaction reach the first
version used (2.2 m from the eye); hydrogen's tile is now at 3.42 m, the f rows at 1.5 m. The aim
now reads it from 4 m.

Measured (RTX 5070, ANGLE D3D11, headless Edge, dev server, vsync off): no frame over 30 ms in the 6 s
after the hub showed, while the print was drawn and uploaded. Print texture: 2604 × 1524 at High
and Ultra (600 px/m), 2083 × 1219 at Medium, 1736 × 1016 at Low.

Tests: `content/periodicTable.test.ts` (the 118, the weights against `elements.json`, CIAAW's 34
without a weight, categories, IUPAC names), `gameplay/periodic/layout.test.ts` (each element in
its group and period, read back at its tile's centre and edge, none in the gaps),
`gameplay/periodic/PeriodicTableSystem.test.ts` (the aim on iron shows it, on chromium and zinc
next; on copper under iron's card, on the card's middle and corner, between tiles: iron stays; off
the board 0.3 s it stays, 0.5 s it goes; from 4.5 m nothing). Seen on the real GPU (RTX 5070, ANGLE
D3D11, headless Edge, High): no key pressed, the aim on iron shows its card; eight shots of the lit
tile and card 150 ms apart differ by no pixel more than 8/255 (no blinking). After the change, `SIMLAB_DEV_PORT=5197 npx playwright test e2e/draw-calls.spec.ts e2e/progress-board.spec.ts e2e/world.spec.ts e2e/hub-city-walk.spec.ts e2e/teacher.spec.ts e2e/canvas.spec.ts e2e/room-sleep.spec.ts e2e/game.spec.ts --project=dev --workers=1` (SwiftShader): 27 PASS; `npx vitest run --maxWorkers=4`: PASS, 327 files, 4160 tests.

Left: the chemistry workspace's lens keeps its old Vietnamese names (Natri, Kali, Lưu huỳnh) while
the display uses IUPAC's — not changed here; not seen on Phú's 300 Hz display.
Checks: as in `docs/phase-u-report.md` ("Chemistry's and Biology's annex doors", the same run).

## The element card's blinking, the hall's directory, a lab's first visit under Ultra (2026-11-14)

Phú, with a screen capture: the element card "chợp chợp" (blinked); take the directory sign out of
the hall; the first walk into a lab came in without its lighting and stalled.

- **The card blinked: a fade bug.** Frames of Phú's capture (decoded in Edge, 60 a second) showed
  the card's glass alternately darker and lighter, frame after frame, its text the same. Logged in
  the page: the system showed thallium every frame, but the card's opacity went 1 → 0.97 → 1: at
  its target the fade took the "towards hidden" branch (`target > opacity` false at 1 = 1), then
  climbed back. A step of dt / 0.18 s: 3 % at Ultra's frame rate, plain to see; under 2 % at
  High's. Now towards the target and held there (`render/periodicBoard.ts`). Measured (RTX 5070,
  ANGLE D3D11, Ultra): the card's middle over 40 frames read 56–64 before, 56 in every frame after.
- **The directory sign** (`hub-directory`, "SIMLAB HUB ↑ Chemistry …") removed: item and placement.
  The hall: 41 bodies, 54 colliders (tests updated).
- **A lab's first visit under Ultra.** Recorded on the real GPU (a DevTools screencast of the walk
  from each hub door, then frames 70 ms apart): through the open door and in the first steps the lab
  showed the hall's generated reflections; a room's own were captured only once the player stood
  in it (six faces, a face a frame), then every material's finish changed — the "light not yet
  there". High showed no change. Now `WorldRenderer.captureAhead`: a room of a neighbour scene
  within 3 m of the player (the lab beyond the door the player stands at) is captured ahead, a face
  a frame (2–5 ms each, measured), and applied the moment it is walked into. Only neighbours'
  rooms: capturing the current scene's other rooms ahead too brought Ultra under software WebGL to
  1 frame a second (`settings.spec.ts`, seen and taken out).
- **Ultra's detail and the benches' vertex colours** (`render/detail.ts`): entering the Chemistry
  Lab under Ultra logged three "mergeGeometries() failed … color" errors — a bench model with vertex
  colours, rebuilt without them. A rebuilt piece now takes its piece's colour when that piece has
  one throughout (else it stays as merged). No error since; `detail.test.ts` covers it.

Left: the wait at a hub door before it opens is still 4–8 s the first time (High–Ultra: the lab
loaded and warmed behind it), with frames of 60–170 ms in it (one of 300–400 ms in one Ultra run
of three, not in the others); not seen on Phú's 300 Hz display.

Checks:

| Check                                                                                                                                                                                                                                                                                    | Result                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check src e2e docs scripts CLAUDE.md package.json`                                                                                                                                                                              | PASS                                                                                                                                                                      |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                                                                                          | PASS — 327 files, 4160 tests                                                                                                                                              |
| `SIMLAB_DEV_PORT=5197 npx playwright test e2e/world.spec.ts e2e/doors.spec.ts e2e/transitions.spec.ts e2e/hub-city-walk.spec.ts e2e/progress-board.spec.ts e2e/game.spec.ts e2e/teacher.spec.ts e2e/practice-rooms.spec.ts e2e/settings.spec.ts --project=dev --workers=1` (SwiftShader) | 46 PASS, 2 FAIL: `world.spec.ts:38` (the hall's count, then updated) and `settings.spec.ts:322` (Ultra at 1 frame a second: the same-scene capture ahead, then taken out) |
| `SIMLAB_DEV_PORT=5197 npx playwright test e2e/settings.spec.ts:322 e2e/world.spec.ts:38 --project=dev --workers=1`                                                                                                                                                                       | PASS (3 with the warm-up)                                                                                                                                                 |

## Emergency calls: the ring, the rotor coming, the teacher startled, real sirens (2026-11-14)

Phú: a call to the police or the fire brigade rings; the helicopter is heard clearly coming, then
the ceiling blows; at the blast the teacher is startled and on his guard, calm once he sees them
come down the ropes; the sirens professional and true to life.

- **The ring** (`phone-ring`, made in code): a call starting to ring plays the ringback heard in
  the ear — Vietnam's, 425 Hz, a 1 s burst (ITU-T E.180: 1 s on, 4 s off); the call is answered at
  2 s as before (`RING_S`). `SoundCues` on `PhoneChanged` (once a call).
- **The rotor coming**: its recipe redone — the blades' thump 7 a second, their swish, the rotor
  wash, the turbine's whine — heard to 220 m (it was 140), and while it comes in its level swells
  with its nearness on top of the distance's own fall-off (×0.35 at 120 m from its hover to ×1.3 at
  it: `APPROACH_M`); full from the hover on.
- **The sirens**: one sawtooth sweep for both squads before (620↔1050 Hz, everywhere alike, in the
  last 10 s). Now each squad's own (`responders.json` `siren`): the fire brigade's a mechanical
  wail (420 → 1180 Hz over 2.25 s, back down over 2.4 s), the police's an electronic yelp (650 ↔
  1500 Hz ten times in 3 s), each a horn's tone (the fundamental, its second and third harmonics),
  sounding from the helicopter for its whole approach (heard to 320 m), stopped at the hover.
- **The teacher startled** (`NpcSystem.startle`, gesture `guard`): at the blast everyone of the world
  in that scene within 30 m turns quickly to it, both arms up by the head, the head ducked, the
  knees giving, until the first of the squad is on a rope (`EmergencySystem`: 2.8 s after the
  blast), then stands calm looking at them for 2 s, then their day goes on. Only the game that
  drives a person startles them (in a LAN room the others draw it).
- Seen on the real GPU (RTX 5070, ANGLE D3D11, headless Edge, High): 113 dialled with the phone
  before the hub's desk; at the blast the teacher's arms come up, by 15 s he stands again.

Levels (renderSynth): ring 0.45, wail 0.387, yelp 0.225, rotor 0.643 peaks; none clips (the bank's
test).

Checks:

| Check                                                                                                                                                                   | Result                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check src e2e docs scripts CLAUDE.md package.json`                                                             | PASS                                                                                                                                                                                                                                                                         |
| `npx vitest run --maxWorkers=4`                                                                                                                                         | PASS — 327 files, 4163 tests (new: the teacher guarded at the blast, still as the first comes down, calm 1 s on; the ring once a call; the wail for 114 and the yelp for 113 from the helicopter, the rotor's level at the end over 2.5× its start, no siren once it hovers) |
| `SIMLAB_DEV_PORT=5197 npx playwright test e2e/emergency.spec.ts e2e/circuit-fire.spec.ts e2e/sound.spec.ts e2e/teacher.spec.ts --project=dev --workers=1` (SwiftShader) | 7 PASS (with the warm-up)                                                                                                                                                                                                                                                    |

Left: the sirens are made in code, not recorded; whether they sound right is Phú's ear. The
rotor is not muffled by the roof before the blast (one level change only); not seen on Phú's
300 Hz display.

## Emergency calls: the teacher keeps watching, who the squad can see, in a LAN room (2026-11-14)

Phú: after the blast the teacher, startled, went back to reading his book while they slid down —
make him act as a person would; the fire brigade asks the nearest player; with the caller in a
lab or the teacher's room they cannot see them, so they ask the teacher only and ask him to keep an
eye on the students, and when that player comes out the teacher walks over and reminds them; and
check it all in multiplayer.

- **The teacher watches** (`NpcSystem.watch`): while the squad is in the building (rappel to
  ascend) everyone of the world in their scene, on their own day (not in a lesson, a follow, a job
  for the player), stands up, turns to where the squad is (their middle), looks at them — the book
  put down; their day goes on once the squad has gone back up. The order: startled, then
  answering a responder (`aside`), then watching.
- **Who the squad tells off**: the player nearest the leader in the hall they came down into — this
  game's or, in a LAN room, another's (`others`: the room's players and where they are); the slap
  of another player goes to their game (`PeerHit`: their screen flashes). Chosen once; gone from
  the room meanwhile, they leave.
- **Nobody in the hall** (`nobodyThere`): the fire brigade goes to the person of the world there
  (the teacher), asks ("Is there a fire anywhere?"), hears him ("No… the students are working in the
  labs"), asks him to keep an eye on the students; the police (who asked already) only ask that.
  No one told off, no slap. The teacher then has a word for the caller (`NpcSystem.remind`): once
  the player is in his scene and he is on his own day, he gets up, walks to them and says it (a
  conversation). New lines `ask`/`answer` (fire), `remind`, `followUp` (both), with Vietnamese.
- **In a LAN room**: the people react in every game, the one that calls and the ones drawing the
  call from its snapshots (`EmergencySystem.react`, from the state both have): whichever game
  drives the teacher startles him and has him watch; the others draw him from its snapshots
  (the `guard` gesture travels).

Tests: `EmergencySystem.test.ts` — the teacher guarded at the blast, still as the first comes down,
calm 1 s on, then never reading, standing and looking their way until they go, his day after;
a game drawing the call from snapshots startles the teacher too; 114 with the caller in the
Chemistry Lab: the teacher asked, asked to keep an eye on them, no one told off, and once the
player is back in the hall the teacher walks to within 2 m and opens a conversation; 114 with
another player of the room nearer in the hall: they are the one slapped (`PeerHit` to them).

Checks:

| Check                                                                                                                                                                                                       | Result                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check src e2e docs scripts CLAUDE.md package.json`                                                                                                 | PASS                         |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                             | PASS — 327 files, 4166 tests |
| `SIMLAB_DEV_PORT=5197 npx playwright test e2e/emergency.spec.ts e2e/circuit-fire.spec.ts e2e/teacher.spec.ts e2e/multiplayer-world.spec.ts e2e/multiplayer.spec.ts --project=dev --workers=1` (SwiftShader) | 11 PASS (with the warm-up)   |

Left: no end-to-end run of a call with two real browsers in one room (the LAN cases are unit
tests with a mirrored game and a scripted player); in a LAN room the teacher's word to the caller
comes only when the caller's game is the one driving him; not seen on Phú's 300 Hz display.

## The slap only up close; a caller who runs off (2026-11-14)

Phú: a slap only when near — the firefighter runs over to slap, never from afar; if the player runs
too far, he stands, tells them off and goes.

- `EmergencySystem.tellOff`: while telling off and giving the lesson the leader keeps within 1.8 m
  (they step away, he steps after); for the slap he runs in to 1.0 m first and swings only there
  (`SLAP_M` 1.1 m); stepped back out of reach in the swing (past 1.7 m), it misses — no flash.
- Run off past 10 m (`FLED_M`) or out of the hall while he comes (after 12 s of chasing,
  `CHASE_S`) or talks: he stands, turned to them, calls after them (new line `fled`, both squads,
  with Vietnamese), and they go. No slap.

Tests (`EmergencySystem.test.ts`): stepping 2.6 m back as the lesson ends — he runs in, the slap
lands within 1.3 m; running 13 m off once told off — called after ("Running off…"), no hit, they go.

Checks: `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check src e2e docs scripts CLAUDE.md package.json` PASS;
`npx vitest run --maxWorkers=4` PASS (327 files, 4168 tests);
`SIMLAB_DEV_PORT=5197 npx playwright test e2e/emergency.spec.ts e2e/circuit-fire.spec.ts --project=dev --workers=1`
(SwiftShader) — 4 PASS (with the warm-up).

Left: not seen on Phú's 300 Hz display.

## Emergency calls: other words each call, the blast's dust, the player stunned (2026-11-14)

Phú, with a reference picture (a squad roping down through a blown ceiling, dust in shafts of
daylight): more lines — the 1st, 2nd, 3rd, 4th, 5th call each different; the blast's smoke and dust
real and beautiful; at the blast the person is stunned and the picture with them; and Ultra a new
level (that last is a proposal: `docs/phase-g2-ultra-next-contract.md`, waiting for Phú's
decisions).

- **Lines by call**: every squad line in `responders.json` is now a list (`ByCall` in `squad.ts`):
  the 1st call's, the 2nd's, …; past the last, the last again. Up to five arrivals, five scoldings,
  four or five lessons and leavings, three of `ask`/`answer`/`fled`/`remind`/`followUp`, each with
  Vietnamese; the first of each is the old line. The calls made to each squad are counted
  (`progression.calls`) and **saved: `SAVE_VERSION` 12**, migration from 11 (no calls yet) and its
  test.
- **The dust** (`breach.ts`, `particles.ts`): a new particle shape `puff` — a billow with a torn
  edge, curls turning slowly inside, lit from above and shaded below, faded as the eye comes into
  it (a billow is seen, not a grey wall over the view); the dust goes from sooty to light grey as
  it spreads. At the blast: a curtain pouring down through the hole, a ring flung out under the
  ceiling, then for 2.6 s dust rolling out along the floor where the curtain lands; motes drifting
  in the daylight's shaft, which now shows as a solid beam while the dust hangs (opacity
  0.05 + 0.24 × dusty, over 18 s). More of everything at High and Ultra (tiers).
- **Stunned** (`EmergencySystem.stun`, 0…1, this game's player only, never sent to the room): at
  the blast, by the distance from under the hole (1 there, none past 18 m or in another scene); 0.35
  for a slap; it fades over 7 s. The picture (`EmergencyView`): the view sways slowly on three
  axes; a CSS filter on the canvas blurs, drains the colour and lowers the contrast by the stun,
  white for the first 0.4 s (set only when its stepped value changes). The sound: the ears ring
  (a 3.8 kHz tone with a slow beat, `tinnitus`, as loud as the stun) and the world is muffled — a
  low-pass on the music, effects and room buses (600 Hz at the worst, open again with the stun);
  the interface bus, where the ringing is, stays clear.
- **The blast without a stall**: building the holed slab and compiling the breach's and the
  squad's shaders on the frame they first showed stalled it 0.25–0.27 s at the blast and again as
  the first came down a rope (RTX 5070, Ultra; a page-side `linkProgram` log showed the programs
  linked there, for the composer's target). Now the hole is built as soon as the room is drawn and
  held hidden (`CeilingBreach.hold`), and the breach and the squad are compiled while the
  helicopter comes in, for the frame's target, in batches (`EmergencyViewDeps.prepare` →
  `compileOnly`).

Measured (headless Edge, ANGLE D3D11 on the RTX 5070 Laptop, Ultra, 1280×720, vsync off; the 9 s
from just before the blast):

| Worst frames | Before                             | After                            |
| ------------ | ---------------------------------- | -------------------------------- |
| Run 1        | 266.7 ms (blast), 246.0 ms (ropes) | 38.4 ms (blast), 20.3 ms (ropes) |
| Run 2        | 269.9 ms (blast), 265.4 ms (ropes) | 36.4 ms (blast), 20.6 ms (ropes) |

The 37 ms left: two programs still link at the blast (an instanced one with instance colours, the
debris, and one plain one, both without the environment map) — probably for the room's
reflection capture, whose target the warm-up does not compile for; not verified.

Tests: `EmergencySystem.test.ts` — the 2nd call says its 2nd lines and the 8th the last, counted in
the save; a player under the hole stunned past 0.9, 0.3–0.7 three seconds on, 0 eight seconds on;
one in the Chemistry Lab not stunned. `cues.test.ts` — under the hole, the ears ring once, from
everywhere, as loud as the stun. `persistence.test.ts` — a v11 save upgrades with no calls; the
calls are kept. `progress.test.ts`, `physicalLab.test.ts`, `Game.test.ts` follow v12.

Checks:

| Check                                                                                                                                                                                                                      | Result                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check` (typecheck, lint, format, unit tests)                                                                                                                                                                      | tsc, eslint, prettier PASS; its vitest step FAIL — one test timed out at 5 s in each run, a different one each time (`EnzymeActivityStation` twice, the `StationSystem` projectile once), each PASSes alone in under 1 s; flaky under the full run's load, not counted as PASS |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                            | PASS — 327 files, 4173 tests                                                                                                                                                                                                                                                   |
| `SIMLAB_DEV_PORT=5197 npx playwright test e2e/circuit-fire.spec.ts e2e/emergency.spec.ts e2e/sound.spec.ts e2e/progress.spec.ts e2e/teacher.spec.ts e2e/multiplayer-world.spec.ts --project=dev --workers=1` (SwiftShader) | 14 PASS (with the warm-up). A first run without `--workers=1` (3 pages at once) failed 4 on time-outs (a LAN round trip of 7.5 s); not counted                                                                                                                                 |

Left: the look and the stun are not yet seen on Phú's 300 Hz display; the stun does not slow the
player's walk; the 37 ms at the blast (the reflection capture's programs); the dust is still
point sprites (no soft edge against the walls) — G2-4 of the Ultra proposal.

## The desktop app on Electron (2026-11-14)

Phú: make SimLab 3D an app on the computer, as CircuitMind is, so it is tested there each time;
its files and the files being worked on in one folder, never a second copy.

- **Electron 44.7.0** (MIT, npm; the one CircuitMind uses, taken from this machine's cache, with
  Phú's permission) as a dev dependency. `electron/main.mjs` is the app: `npm run app` builds
  `dist-app/` when anything it is built from is newer (a few seconds; twice at most) and serves it
  with `vite preview --host` on port 5190; `npm run app:dev` runs the dev server instead (live
  code, port 5191). Vite runs in Electron's own Node (`ELECTRON_RUN_AS_NODE`): no Node is needed
  on the PATH. The window is the game's: no menu (its Ctrl+W and Ctrl+R would fire during play),
  F11 full screen, F12 developer tools; other sites open in the browser; permissions (the
  microphone for voice) only for the game's own page; one window (a second start focuses it);
  closing it stops the server it started. The discrete GPU is asked for
  (`force_high_performance_gpu`) and the opening's sound may play before a click.
- **The Desktop shortcut** (`scripts/desktop-app.ps1 -Install`) now starts `electron.exe` on this
  folder. The Edge window it started before is gone; its saves and settings (same origin,
  `localhost:5190`) are copied once into the app's profile (`%APPDATA%\SimLab 3D`) the first time
  the app starts; the Edge profile is left as it was. 2026-11-15 (Phú): the shortcut is in the
  Start menu too (Windows search finds it; pinned from there to the taskbar), and its icon is the
  SimLab emblem (`scripts/simlab.ico`, made from `emblemShape.ts` by `node scripts/make-icon.mjs`:
  its dial, tape, flight and ball, bolder, on a white tile — on a dark one with cyan rings it read
  as Electron's default icon, which another app on the Desktop has; Phú chose the white one).
- **Tests in the app**: `npm run test:app` (`playwright.app.config.ts`, specs `e2e/*.app.ts`;
  `e2e/app.ts` `launchApp` gives each a fresh profile and the dev server on port 5195).
  `e2e/desktop.app.ts`: the app's page is the game; WebGL is the hardware's and WebGPU is there
  (not a fallback adapter); the page may use the microphone; a new game is played; the server is
  gone once the window closes.
- **The build failed at first** (`ENOTEMPTY` emptying `dist-app/ultra`): a dev server running
  meanwhile watched `dist-app/`, and Windows keeps a watched folder until its watcher lets go.
  `vite.config.ts` now leaves `dist/` and `dist-app/` out of the dev server's watch; the build's
  whole log is kept in the profile (`build.log`) and the error box names it.

Checks (RTX 5070 Laptop; the app's window, not headless):

| Command                                                              | Result                                                                                                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx playwright test -c playwright.app.config.ts` (`desktop.app.ts`) | PASS, twice (17.6 s) — WebGL `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU … Direct3D11)`, WebGPU `nvidia blackwell`                     |
| `npm run app` mode, sources newer than `dist-app/`                   | the build in the app passed (951 ms), the window opened on the menu (its log)                                                                 |
| The real profile, port 5190                                          | the Edge window's saves, character and settings were there (`simlab.save.slot-1`, its backup, `simlab.character.custom`, `simlab.settings.*`) |

Left: no installer or packaged `.exe` (on purpose: the app is this folder; `npm install` must have
run); the e2e suite itself still runs in headless Edge on SwiftShader (deterministic, as before) —
the app's specs are for the real GPU; Electron's console warns of the page's missing Content
Security Policy (a developer warning of an unpackaged app).

Later the same night (2026-11-15), in the app: Vite now runs inside the app's own process
(`vite.createServer` / `vite.preview`), so it ends with the app even when the app is killed (a
server in a child process outlived a killed test app, and the next start served its old build);
a port in use is an error, never another server reused. A page load the page itself replaces is no
longer taken as the app failing (an error box had blocked a test's app). `SIMLAB_APP_UNCAPPED=1`
turns vsync and the frame-rate limit off for benches; `launchApp` takes `SIMLAB_APP_PROD=1` (the
production build). The game's window is now made before a build: the build's small window was the
only one, and Electron quit the app when it closed (a start that had to build ended there). `vite.config.ts` bundles Ultra's WebGPU dependencies ahead for the
dev server (found late, its import failed with 504 Outdated Optimize Dep).

## The hall's emblem falls and shatters when the ceiling is blown (2026-11-15/16)

Phú: when the police or firefighters blow the ceiling in the middle of the hall, the emblem hung
there falls and breaks, "like glass", with a breaking sound.

- An item may hang (`visual.hanging`, only with `body: none`); the SimLab emblem does
  (`core-items.json`). `gameplay/emergency/hung.ts`: what hangs under the blast (`hungUnder`), when
  it falls (`HOLD_S` after the blast) and where it lands.
- `render/emergency/fall.ts` (`HungFall`): the emblem stays in its decor batch (`copyOf`: a copy
  falls, the batched one is hidden — a view of its own broke the circuit-fire e2e); on landing, 150
  glass shards, an instanced mesh per colour, scatter and settle; mended when the round is over.
- Sound: a synthesized `shatter` (layers in `sounds.json`) on landing, then `impact-glass` shards
  (`cues.ts` `hungOf`, `SHARDS_S`); tested in `cues.test.ts` and `fall.test.ts`.

Not looked at on the real 300 Hz display yet; uncommitted. (Made truer 2026-11-17: below.)

## The emblem breaks into its own pieces (2026-11-17)

Phú: the emblem's break should look real — it touched the floor, vanished, and only shards
appeared. Now (`render/emergency/fall.ts`) the object itself comes apart where it strikes:

- **Its own pieces.** At the strike its triangles are cut by mesh, by the plane they lie in (the
  emblem is two faces crossed), by ring or inside, and by sector round its middle: 14 arcs per ring
  (with their ticks), 5 chunks inside (tape, flight dashes, strobes), the ball whole. Each piece is
  a mesh of its own round its centre, with the object's material (shared). The cables above the
  square and the see-through glow do not survive the break.
- **Motion.** Every piece keeps the fall's speed (what strikes first breaks first), gets a kick
  out from the middle (harder low down) and a spin; it bounces (28 % kept), slides with the floor's
  grip, and once nearly still tips over onto the face it was drawn in, its lowest point kept on the
  floor (16 points per piece tried against it). The strike is found on the object's own box, not
  a fixed bottom.
- **Glass.** 90 thin shards (was 150) burst from where it struck first, lower and further.
- Walked in late: it struck as from its own height and lies still. Mended: pieces and shards
  shrink and go; the emblem is whole where it hung. Pieces are made once at the break; nothing is
  allocated per frame.

Looked at: the 114 call in the desktop app on the RTX 5070 Laptop (WebGL Ultra): the dial's arcs
burst out with their ticks, fly, then lie on the floor among the glass while the squad comes down.
Not looked at: the 113 call (the same code), WebGPU Ultra's look of it.

Checks (2026-11-17):

| Command                                                                                                                               | Result                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check .`                                                                     | PASS (after `promo` was added to the ignores: the promo video's output folder) |
| `npx vitest run --maxWorkers=4`                                                                                                       | PASS — 331 files / 4187 tests                                                  |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/emergency.spec.ts e2e/circuit-fire.spec.ts --project=dev --workers=1` | PASS — 4 (4.9 min)                                                             |

Committed with Phú's OK after the promo video (2026-11-17); not played on the 300 Hz display yet.
