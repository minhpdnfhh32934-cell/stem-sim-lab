# Phase C report — choosing a character in a room full of people

Contract: `docs/phase-c-character-contract.md` (2026-11-07; D1–D7 taken by thầy while Phú was
away, each the recommended option). Not committed: awaiting Phú's look on his display.

## 1. C-1 to C-3 (2026-11-07 — not committed)

### Built

- **The cast** (`content/characters.json`, D1): eight playable characters, four men and four
  women, in this order: Khoa (physicist, calm and methodical), Lan (chemist, warm), Minh (physics
  intern, energetic), Vy (biology intern, quiet and careful), Huy (lab technician, practical), Mai
  (senior biologist, leads the project), Tuấn (computational scientist, thoughtful), Linh
  (chemistry intern, playful). The first two keep their ids (`researcher-male`,
  `researcher-female`): old saves still name them. Each has a role and a line of personality
  (English and Vietnamese), and a `profile` (D3): a signature pose, how sociable and how restless
  (0–1), the room tasks they like, the coat or not. Presentation only.
- **More detail** (`render/body/BodyModel.ts`, D4): four new hair styles (long, bun, curly,
  side-parted), round or square glasses, a short beard, and two new necklines: a sweater's ribbed
  crew neck (with a ribbed hem and a small badge) and a hoodie (the hood down behind the neck, its
  strings, the front pocket). `bodyShapeOf` gives a character's shape (BodyView uses it too).
- **The menu's row**: "Choose your character", the chosen one's name and a round picture; it opens
  the page. The menu still loads without three.js (the production guard): the picture is a flat
  SVG in the character's colours until the page has run, then their 3D portrait, drawn by the
  stage's chunk and kept in the browser (`simlab.portrait.<id>.<hash>`, a cache, never the save).
- **The page** (`ui/characterPage/CharacterPage.ts`): slides up over the menu; the common room
  fills it; Back, the title; "‹" and "›" on either side (and ← →), a card with the name, role,
  personality and "n of 8"; Choose in the middle below; Esc goes back without changing the
  choice. English and Vietnamese.
- **The stage** (`CharacterStage.ts`, D5): its own WebGL canvas, made when the page opens, freed
  when it closes (a lazy chunk); shadows and pixel ratio from the graphics preset.
- **The room** (`room.ts`, D2): the institute's common room — a café counter with a coffee
  machine and cups, the project's whiteboard (graphs, a wave, formulas only), a sofa corner with a
  rug and a low table, a long table with chairs and laptops, windows with daylight, plants,
  pendant lamps; bright.
- **The people** (`actor.ts`): the player's own body model, animated by hand: a walk with arm
  swing and bob, sitting, talking (hands moving, nods), listening (a nod now and then), typing,
  writing at the board, drinking coffee, reading, on the phone at the window, waiting (hands
  behind the back), the head turned to whom they listen to or to the camera; the eight signature
  poses (arms crossed, a wave, thumbs up, notes held to the chest, hands on hips, presenting,
  thinking with a hand to the chin, a V sign), fingers curled to fit.
- **The room's life** (`life.ts`, C-3, D6): pure code, seeded. Everyone has an activity — a task
  at a spot, a talk in a group, a walk over to someone — and thinks again every few seconds, by
  personality: the sociable ones join a group or go over to a person (who talks with them if they
  are sociable enough, seated or standing); the others go to a task they like. In a talk the
  speaker changes every 2–5 s. Called up (D7: the cast's order, wrapping), a person leaves what
  they did, walks briskly into the frame from the side asked ("›": from the left) and strikes
  their pose; the one there walks off the other side and goes back to what they did. A partner
  left alone waits (patient ones) or goes elsewhere (restless ones); they talk again when the
  other comes back.

### Measured

- The page on the GPU: ANGLE / NVIDIA GeForce RTX 5070 Laptop GPU, D3D11, dev build, the in-app
  browser pane (800 × 600): 150 fps, the slowest of 240 frames 6.9 ms. Not the production bench.

### Tests

- `npm run check`: **PASS** — 249 files, 3575 tests (`life.test.ts`: the first at the front, the
  rest at liked tasks; the one called up enters from the left within 5 s while the other leaves
  right; sent back to the task they left; never two on one spot; everyone walks and changes what
  they do in two minutes, the sociable ones talk; same seed, same room. Content: four men and four
  women, the first two ids kept).
- `npx playwright test --workers=1 e2e/character-page.spec.ts e2e/game.spec.ts e2e/menu.spec.ts
e2e/vietnamese.spec.ts` (SwiftShader) ran the whole dev project (dev-timed depends on it): 117
  passed, 5 failed, 3 did not run. The five were the old menu's: `canvas.spec` (the portrait's own
  WebGL context), `history.spec` at 430 px (its radios), `settings.spec` (its group), and
  `menu.spec` / `pause.spec` overflowing — the new row's class `.menu-choice` was already the
  settings fieldsets' own and widened them; renamed `.menu-character`. Re-run of those five with
  `character-page.spec`: **PASS**, 6.
- `--project=dev-timed --no-deps`: `game.spec` **PASS**, 3 (the Physics Lab now counts 120 bodies
  and 154 colliders: the ripple tank and the field display); `grab.spec`'s throw **FAIL**, 3 of 3:
  the ball reaches the wall and bounces (recorded x −4.467, then back), but the test samples the
  4 Hz debug panel and asks for x < −4.5. Not fixed.
- `--project=production`: first **FAIL** (the menu loaded three.js for the portrait: 1,182,924
  bytes against the 600,000 guard); fixed by the flat picture: **PASS**, 3.

### Not done, limitations

- Not seen on Phú's display.
- No props in hands (cup, book, phone, tablet): the gestures are mimed. People can pass through
  each other while walking (no avoidance). No voices or speech bubbles (contract §4).
- The hair, glasses and beard are new shapes on the stylised head; close up (a mirror) they may
  need tuning.

## 2. C-4: builds and more detail (2026-11-08 — not committed)

Phú (2026-11-08): the people are not detailed enough; some short, some tall; men broad or thin;
women curvy or of an ordinary figure.

### Built

- **Builds in the data** (`gameplay/character.ts`, presentation only): `build` (girth of limbs,
  neck and torso, 0.75–1.4), `muscle` (0–1), `watch`, `earrings`; the existing `heightM`,
  `shoulderM`, `hipM`, `waistM`, `bustM` carry the figure. The cast: Vy 1.52 m (petite), Linh
  1.60 and Mai 1.70 (curvy: hips 0.15–0.16 m over the waist, fuller bust), Lan 1.65 (ordinary),
  Minh 1.66 (short), Khoa 1.75 (fit), Huy 1.83 (broad, muscled), Tuấn 1.86 (tall, slim). Khoa and
  Lan keep their heights (the eye height the tests and saves use).
- **Bodies** (`render/body/BodyModel.ts`): limbs shaped along their length (`limb`: the biceps,
  forearm full below the elbow, slim wrist, the thigh to the knee, the calf, the ankle; trousers
  hang straighter than tights); the shoulder's round; the neck by build; a muscled chest, the
  muscles from neck to shoulder; a curvy figure wide at the bust from the front too, the waist in,
  the hips and seat fuller (`Rise` now front or back); the head a little less than proportional
  to height (heads vary less than heights). The thigh meets the pelvis however slim the leg.
- **Faces**: a nose with its bridge and wings, lips (a fuller lower lip), the chin; ears with a
  rim and a lobe; small earrings. Round glasses were 10 cm deep (a goggle from the side): now a
  few mm.
- **Hair**: the short crop now has a brushed-up front and sideburns (it was a bare cap); the
  ponytail has a band, a fuller tail in locks, a fringe and strands before the ears.
- **Clothes**: shirt collar points and a breast pocket; buttons down a blouse; the belt on every
  shirt worn with trousers; knit cuffs; the hoodie's string tips; a dress's waistband; shoes with a
  rounded sole, the heel's round, laces (a bow on flats); a wristwatch.
- **The lab coat**: one depth for its chest and skirt (the seam at the waist was ragged), a
  collar, lapels, side pockets and a breast pocket lying on the cloth (they stood off it like
  cards), buttons, a pen, an ID badge, turned-back cuffs; fuller over a broad body. Its small
  parts are a new surface, `coatTrim`, shown with the coat (+1 draw while the coat is worn).
- On the character page broad, muscled or full figures hold their arms a little away from the
  body.

### Measured

- Vertices per body (non-indexed, the cast): 118k–184k drawn, 85k–156k in the shadow meshes.
- Frame times: **NOT RUN** — the in-app browser pane was hidden (its frames are throttled).

### Tests

- `npm run check`: **PASS** — 249 files, 3576 tests (new: the build test in `body.test.ts`:
  heavier and muscled arms and legs wider, a curvy figure wider at the hips, watch and earrings
  only when given; `content.test.ts`: someone under 1.55 m and over 1.82 m, a broad muscled man and
  a slim one, two curvy women).
- `npx playwright test --project=dev --no-deps --workers=1 e2e/character-page.spec.ts
e2e/mirror.spec.ts e2e/draw-calls.spec.ts e2e/canvas.spec.ts e2e/preparation.spec.ts`
  (SwiftShader): **PASS**, 20.
- `npx playwright test --project=production --no-deps --workers=1`: **PASS**, 3.

### Not done, limitations

- Not seen on Phú's display. The look is still the stylised one of Phú's references (large head
  and eyes); more realism in the face would be a change of style, not of detail.
- Rigid parts: where two sleeve pieces meet (elbow, cuff) a ragged ring can show up close.
- The player's own body has the new shapes too (first-person arms, the mirror): seen in the mirror
  e2e, not looked at by Phú.

## 3. C-5: a smooth face, bending joints, moving cloth (2026-11-08 — not committed)

Phú (2026-11-08): the faces are stiff — smooth them, give them all the face's forms, no crude
round blobs; the same for the clothes; the clothes' physics in more detail; many parts still go
through the body.

### Built

- **The face** (`render/body/head.ts`, `sculptHead`): one sculpted surface instead of a cranium, a
  jaw and blobs for the nose, lips and chin. The cranium and the jaw melt into each other (a smooth
  maximum); on the face, smooth raises and hollows: the brow ridge, the eye sockets, the
  cheekbones and the hollow under them, the bridge, tip and wings of the nose, both lips and the
  line between them, the chin, the jaw's angle (softer for characters drawn with lashes). The mesh
  is denser over the face than behind the hair. Brows, lash lines, the mouth's line, the lips'
  colour and the blush are ribbons and patches lying on that surface (they were boxes and discs
  standing off it). Ears: a thin shell with a rim, not three balls. The eyes keep the stylised look.
- **Smooth cloth**: every lathe and limb profile goes through a centripetal Catmull-Rom curve
  (a uniform spline sagged a dress below the hips — the thighs showed through it); finer segments.
  The hoodie's pocket is a curved panel, not a box.
- **Joints that bend** (`BLEND`, weighted skin): near each joint the skin and the cloth follow
  both bones half way (elbows, knees, shoulders, wrists, ankles, the neck, the torso's chain); the
  trousers' seat follows each thigh. Texture coordinates are dropped (no body texture).
- **Cloth** (`render/body/cloth.ts`, `Cloth`): eight skirt bones round the waist carry the lab
  coat's skirt and a dress. Each panel is a damped pendulum: it lags when the body starts or stops,
  trails in a walk, flares in a turn, and never goes through a leg (a thigh or shin in its way
  lifts it: a stride kicks the coat, sitting lays it on the lap); the panels behind lie on a chair's
  seat; neighbours pull on each other. Runs on the character page and on the player's own body.
  No allocation per step.
- **Arms clear of the body**: the body measures how far out the arms must hang to clear the thighs,
  the waist and the bust, and the coat's skirt when worn (`BodyFit.spread`); the page and the
  player's body use it. The thigh's top is small (it showed through a dress at the hip); a dress is
  roomy over the seat under it.

### Measured

- Character page, ANGLE / NVIDIA GeForce RTX 5070 Laptop GPU, D3D11, dev build, the in-app browser
  pane (846 × 833): 150 fps, p99 and the slowest of 299 frames 6.8 ms. Not the production bench.

### Tests

- `npm run check`: **PASS** — 250 files, 3582 tests. New `cloth.test.ts`: the face's most forward
  point is the nose's tip, facing out; skin weights add up to 1 and an elbow is shared by two bones;
  the cloth hangs still on a still body, seated lies over the lap and on the seat, trails behind a
  body walking off and settles when it stops; a dress covers the thighs at the hips for a curvy and
  an ordinary figure.
- `npx playwright test --project=dev --no-deps --workers=1 e2e/character-page.spec.ts
e2e/mirror.spec.ts e2e/draw-calls.spec.ts e2e/canvas.spec.ts e2e/preparation.spec.ts`
  (SwiftShader): **PASS**, 20. `--project=production --no-deps`: **PASS**, 3.

### Not done, limitations

- Not seen on Phú's display.
- The cloth is eight rigid panels with blended edges, not a cloth simulation: seated, the sides
  hang in straight sheets; a chair's backrest is not known to it. Hair does not swing.
- Where the coat's sleeve meets the coat's body at the shoulder, white cloth crosses white cloth.
- The poses were checked by eye for the cast (each character's own pose), not by a test.

## 4. C-6: natural, harmonious faces; a natural bust (2026-11-08 — not committed)

Phú (2026-11-08): make the faces natural (a redesign is fine) and harmonious; make the women's
bust natural and real.

### Built

- **Natural proportions** (`BodyModel`, `head.ts`): the head about 15 cm wide and 23 cm chin to
  crown for an average height (it was 18 × 27 cm, a stylised big head), the eyes half way down,
  slightly smaller for taller people. The camera's eye height is unchanged (0.93 h).
- **Real eyes**: an eyeball (white, iris in the character's colour, pupil, a caught light) set
  behind lids: round each almond-shaped opening (outer corner a little higher) the sculpted skin
  wraps the eyeball, inside it the skin falls away. A lash line along the upper lid (fuller and
  flicked out with lashes), natural brows fuller at their inner end.
- **Face forms at natural sizes**: brow ridge, cheekbones, temples, a nose from its root to a
  rounded tip with wings (smaller and finer on a softer face), the mouth's mound, lips with the
  upper lip's bow and the philtrum, the chin; a softer face's jaw a little narrower and its chin
  shorter. Lip and blush colours come from the skin tone (`lipColour`, `blushColour`), not a fixed
  red and pink.
- **Hair redesigned on the new head**: the scalp's hair above a natural hairline (high at the
  forehead, receding at the temples, round the ears, down to the nape; sideburns for the men),
  thinning into the skin at its edge, which follows the line exactly (no cap's brim, no steps).
  Spiky: short tufts and a pushed-up fringe. Crew cut. Side part with a swept top and a soft
  quiff. Curly: a full head of small curls. Bob: an A-line mass of hair from the crown, back over
  the ears and forward to the jaw, its ends turned under, a soft fringe. Long: hanging behind to
  below the shoulder blades, parted in the middle, the front locks framing the face. Bun: sleek,
  a wrapped bun and band, loose temple strands. Ponytail: high, with a band, a side-swept fringe.
  Hanging hair is a mass with rounded edges, not a sheet.
- **Beard**: a short, neat beard along the jaw and chin and a moustache, thinning at every edge;
  its edges follow their lines (it was a black shell over the jaw).
- **Glasses** sized for the new face (about 5 cm lenses); goggles and the moustache refitted.
- **The bust** (`bustShape`): the upper part a gentle slope from under the collarbones to the
  fullest point (about 0.716 h), the lower part fuller and round, back to the fold beneath; two
  lobes a little apart, wider on their outer side. A loose top (blouse, shirt) falls from the
  fullest point and bridges between; a knit follows more closely. The lab coat's fronts are carried
  out over the bust (the bust never through the coat); lapels and pockets follow.
- Thin tubes (fingers, cords) use fewer segments; finer rows only where a bust rises.

### Measured

- Vertices per body (the cast): 171k–236k drawn (head 44k).
- Frame times: **NOT RUN** — the in-app browser pane was hidden.

### Tests

- `npm run check`: **PASS** — 250 files, 3583 tests (new: the bust is fullest at 0.69–0.74 h and
  the coat is over it; the face test now finds the nose's tip at its new height; the dress test
  bins the dress by angle, it timed out at 5 s under a full run).
- `npx playwright test --project=dev --no-deps --workers=1 e2e/character-page.spec.ts
e2e/mirror.spec.ts e2e/draw-calls.spec.ts e2e/canvas.spec.ts e2e/preparation.spec.ts`
  (SwiftShader): **PASS**, 20. `--project=production --no-deps`: **PASS**, 3.

### Not done, limitations

- Not seen on Phú's display. Faces were judged by eye in a plain light, close up.
- The eyes look straight ahead (no gaze), no expressions; hair does not move.
- The hair's edges and the beard's are geometry, not strands: close up they read as smooth masses.

## 5. C-7: the anime style (2026-11-08 — not committed)

Phú (2026-11-08): design the characters like an anime; men clearly men, women clearly women; take
from famous anime (One Punch Man, Conan…). Done as the general style of such series — clean
lines, big drawn eyes, hair in pointed locks, cel shading, a dark outline — not as any of their
characters (they are protected designs; the cast stays our own eight).

### Built

- **The anime head** (`head.ts` `anime`, `BodyModel`): a head a little large for the body (about
  6.5 heads tall), a smooth face with few forms — a small nose, a firm chin, jaw angle and brow
  ridge for a man; round cheeks and a small pointed chin for a woman (`lashes`: the data's soft
  face). Eyes drawn on the face (`head.drawn`): an almond white, a big iris up under the lid, the
  pupil, two lights, a heavy upper lash line (flicked out with lashes) and a fine lower one. A
  man's eyes narrower and longer under straight heavy brows; a woman's large and round under fine
  arched brows. A small mouth line (rosy for a woman, dark for a man, smiling with `blush`),
  small blush. The natural eyeballs-behind-lids remain for `anime: false` (not used).
- **Anime hair**: the scalp's hair, then flattened, curving locks tapering to points
  (`strand`): fringes over the forehead, locks framing the face, a shōnen's spikes leaning back,
  a short pushed-up front, a swept side part, curls, a bob and long hair as masses with a locked
  fringe, a bun, a ponytail in four locks.
- **Cel shading and outline**: the body's materials are MeshToonMaterial with light in three flat
  steps (two soft ones for skin); the drawn eyes are unlit; a dark outline (the body's shadow
  shapes drawn again from inside, 2.2 mm out: `outlineMaterial`) — on the character page; on
  the player's body only in mirrors (SELF_LAYER). One extra draw per body (two in a coat).
- The render audit (`quality.test.ts`) now allows MeshToonMaterial (cheaper than standard).

### Measured

- Character page, ANGLE / NVIDIA GeForce RTX 5070 Laptop GPU, D3D11, dev build, the in-app browser
  pane (846 × 833): 114 fps on average, median frame 6.7 ms, but 41 of 600 frames over 20 ms
  (p99 33.5 ms), with no long JS task. The cause was not found (the pane was hidden before the
  outline and shadows could be switched off to compare). C-5 measured 150 fps, worst 6.8 ms.

### Tests

- `npm run check`: **PASS** — 250 files, 3583 tests.
- `npx playwright test --project=dev --no-deps --workers=1 e2e/character-page.spec.ts
e2e/mirror.spec.ts e2e/draw-calls.spec.ts e2e/canvas.spec.ts e2e/preparation.spec.ts`
  (SwiftShader): **PASS**, 20. `--project=production --no-deps`: **PASS**, 3.

### Not done, limitations

- Not seen on Phú's display. The frame-time spikes above need a look on the production build.
- The room and the labs stay in their own look; only the people are drawn as anime.
- No expressions or blinking; the hair does not move.

## 6. C-8: running to the front, a lit outline, a sharp mirror (2026-11-08 — not committed, paused)

Phú (2026-11-08): the one switched to should glow and run to the middle, not walk; the mirror is
blurry. Then: stop this part, go on with the experiments.

### Built

- **Running** (`life.ts` `RUN` 4 m/s, `PersonView.called`): the one called up runs to the front;
  the actor runs with a longer stride, high knees, bent pumping arms, leaning in and bouncing.
- **Lit outline** (`actor.ts`): while called and not yet at the front, the outline swells and glows
  gold, pulsing; plain again once there (`setOutlineWidth`: the outline width is a uniform now).
- **Sharp mirror** (`mirrors.ts` `screenRect`): the reflection is drawn for the glass's own
  rectangle of the view (the camera's view offset), so the whole render target goes on the glass
  — it was a half-size, blurred full view at Medium; same cost.

### Tests

- `npm run check`: **PASS** — 250 files, 3585 tests (new: the called one runs at RUN, lit, and not
  once at the front; the mirror's screen rectangle, null behind the eye or filling the view; the
  sent-back test now checks once they have settled — they arrive sooner and, restless, may leave).
- `npx playwright test --project=dev --no-deps --workers=1 e2e/mirror.spec.ts`: **PASS** (High;
  the shot shows a sharp reflection). A temporary Medium copy did not reach Medium (its save sets
  High): Medium **NOT RUN**.
- The full related e2e (character page, draw calls, canvas, preparation, production): **NOT RUN**
  — stopped by Phú to move on.

## 7. C-9: everyone in one room; the player's own character (2026-11-08 — not committed)

Phú (2026-11-08): everyone sitting or standing in one room, all in view; switching leaves each
person in their place, turning to look at the screen with their outline lit; the order is left to
right; nobody walks about, they read, use the phone or talk; the last is a black silhouette that
opens a page to customise everything (eyes, face, clothes, height, build…). Style each person after
his reference picture of anime lab characters (weapons and armour left out: not a lab's).

### Built

- **The room as a group** (`seating.ts`, replaces C-2's `life.ts` and C-8's running): nine places
  left to right (`SEATS`) — an armchair (reading), a coffee standing, the sofa for two, a café
  table for two, a phone standing, a desk with a laptop, the player's place. A pair takes turns
  talking and looks at each other. The one chosen stays put, looks at the camera and is lit gold
  (seated: they put down what they hold; standing: their pose). A fixed wide camera has everyone in
  view; a narrower window widens the view to keep a 16:9 width. The room's furniture is set by the
  places (`room.ts`).
- **Choosing**: ‹ › and ← → left to right, wrapping; a click on a person chooses them
  (`CharacterStage.pick`: an upright box per person on screen, the nearest wins). The arrows sit
  beside Choose, below the room, never over anyone.
- **Places are data**: `profile.seat` in `characters.json` (the walking fields `sociable`,
  `restless`, `tasks` and `ROOM_TASKS` removed). Vy (in a dress) stands with her coffee; Huy reads
  in the armchair.
- **Hand props** (`actor.ts`): a coffee cup, a phone and an open book in the right hand, shown only
  for their gesture.
- **Seated cloth** (`cloth.ts`): seated, the front half of a dress or coat swings forward along the
  lap instead of outward, and the neighbours' pull is off — before, the front corners stood out
  sideways like a tutu to clear the thighs.
- **The style of the reference**: every person's hair colour and clothes changed (black hair and
  sunglasses in a dark hoodie, pink ponytail in red, blue hair in a green dress under the coat,
  blond spiky in an orange hoodie, long black hair all in black, red hair in a black top, a purple
  bob with a tie under the coat, purple hair in a bright hoodie). New: `glasses: 'shades'`
  (sunglasses: the square frame with a dark lens). Builds, faces, names and personalities kept.
- **The player's own character** (`Customiser.ts`, `CustomPreview.ts`): the silhouette's Create
  opens the customiser — a picture of the whole person, turned by dragging, redrawn 90 ms after a
  change — with tabs: Body (height 1.50–1.95 m, build, muscle, shoulders, waist, hips, bust), Face
  (soft or strong face, skin, eyes, blush, beard, glasses), Hair (8 styles, colour), Clothes (top,
  neck, trousers or a dress over tights, colours of each, the lab coat), Extras (watch, earrings,
  pose when chosen) and the name. Colours: swatches or any colour. Save checks the whole against
  `CharacterDefinitionSchema`, keeps it in the browser (`simlab.character.custom`), gives it to the
  game (`Game.setCustomCharacter`, id `CUSTOM_ID`, `Registry.put`) and rebuilds the room with it in
  the last place, chosen; Edit opens it again.
- **Save v10** (`saveData.ts`): `player.custom` holds the player's own character when the game is
  played as it; Continue brings it back as it was then. Migration 9 → 10 changes nothing else.

### Tests

- `npm run check`: **PASS** — 253 files, 3606 tests. New: `seating.test.ts` (places left to right,
  partners mutual; choosing wraps both ways; everyone stays in place and only the chosen one looks
  at the camera, lit; a pair takes turns; the cast has one place each, the last left for the
  player); `persistence.test.ts` (the own character round-trips with the save and `applySave`; a
  v9 save upgrades unchanged but for its version; the earlier migrations now end at v10).
- `npx playwright test e2e/character-page.spec.ts` (dev, SwiftShader): **PASS** — the order 7 of
  9 → Linh → Tuấn → the silhouette (Create) → wraps to Huy; Esc keeps the choice; Create → the
  customiser with its canvas, name, hair Ponytail, height slider 1.9 m, Save → back in the room as
  "Phú", Edit shown, kept in the browser; Choose; New game plays as `custom`; no console errors.
- Seen in the dev app (built-in browser, not Phú's display): the whole group in view, the click
  choosing the silhouette, close-ups of the cup, the book and the seated coats, the customiser and
  its Save.

### Not done, limitations

- Not seen on Phú's display. Frame-time spikes (C-7) not investigated: **NOT RUN** (the browser
  pane was hidden, 1–2 fps).
- No new garment shapes from the reference: no jackets, shorts, boots, braids, tablet, flask or
  wrench — the styles use the existing parts in new colours, plus sunglasses.
- The click choice has no unit test (its box test is checked in the app only).
- The rest of the e2e suite (draw calls, canvas, preparation, production) **NOT RUN** after this
  change.

## 8. C-10: the clothes of the reference picture (2026-11-08 — not committed)

Phú (2026-11-08): make the clothes like the picture — every gap of skin, the folds and the design
of the clothes. Each person is dressed after one of its characters (weapons and armour left out).

### Built

- **Clothes as data** (`ClothesSchema`, all with defaults so older data draws as before):
  `sleeves` (long, short, none), `crop` (bare midriff), `jacket` (open zip jacket, short jacket,
  tactical vest, knit vest; its colour and trim), `legs` (trousers, joggers, cargo, shorts, pleated
  skirt), `legwear` (bare, tights, stockings; its colour), `footwear` (trainers, loafers, heels,
  boots, knee boots, thigh boots), `gloves` (fingerless, long), `choker`, `bandage`, `ripped`,
  `logo`, `blocks`, and a shirt with a bow (`neck: 'bow'`). Four new surfaces: `outer`,
  `outerTrim`, `legwear`, `bandage`.
- **Skin where the clothes leave it**: bare arms, a bare midriff below a crop top, thighs between
  shorts and boots, a torn knee with threads across it, fingers out of fingerless gloves.
- **Garments** (`BodyModel.ts`): an open zip jacket with a stand-up collar, a striped zip and two
  stripes down each sleeve; a short leather jacket with lapels and cuff zips; a tactical vest with a
  zip, straps and pouches; a knit V-neck vest; a pleated skirt (16 pleats, swinging on the skirt's
  cloth bones); shorts with a turned hem and a belt; joggers baggy and cuffed above the ankle; cargo
  pockets; boots with laces and a thick sole, knee boots laced up the front, heeled thigh boots;
  heels; a school bow; a round emblem on a hoodie; colour-blocked sleeves; a choker with a ring; a
  wound bandage. The hoodie's front pocket, lost in an earlier edit (its code had ended up inside a
  comment), is drawn again.
- **Folds, the anime way**: thin strips on the cloth drawn by vertex colour (`FOLD`) — inside the
  elbows, across the knees, bunched at the ankles (more on joggers), from under the arms, over the
  waist, down a dress, the pleats, a boot's ankle. `clothMaterial` draws them darker on a light
  cloth and lighter on a dark one (a darker line does not show on black). Folds are left out of
  the shadow and the outline.
- **The cast** (`characters.json`): Khoa — black zip jacket with yellow stripes, white T-shirt,
  jeans, sunglasses; Linh — short red leather jacket, black crop top, bare midriff, black shorts
  and belt, thigh boots, choker, fingerless gloves; Lan — green dress under the coat, dark tights,
  green heels; Minh — orange hoodie with a white emblem, black joggers, orange trainers, fingerless
  gloves; Vy — black sleeveless dress, long gloves, knee boots laced up, choker; Huy — tactical
  vest over a dark red tank, bare arms, bandaged forearm, cargo trousers torn at the knee, boots;
  Mai — white shirt, red bow, maroon knit vest, navy pleated skirt, black tights, loafers, coat;
  Tuấn — purple hoodie with green blocks, baggy purple joggers.
- **Customiser**: tabs Top, Bottom, Shoes and Extras with every new choice (Vietnamese in
  `strings.json`).

### Tests

- `npm run check`: **PASS** — 253 files, 3609 tests. New in `body.test.ts`: nothing extra worn
  draws as before; skin shows with no sleeves, a crop top, shorts (and boots, tights cover it); a
  jacket goes over the top and under the coat, its folds darker vertices that are never in the
  shadow.
- `npx playwright test e2e/character-page.spec.ts e2e/draw-calls.spec.ts e2e/mirror.spec.ts
--workers=1` (dev, SwiftShader): 16 PASS, mirror **FAIL** — it expected Khoa's old blue shirt.
  Its check now expects his white T-shirt in the jacket's opening (light and grey):
  `npx playwright test e2e/mirror.spec.ts`: **PASS** (the shot shows the jacket, T-shirt and jeans).
- Seen in the dev app (built-in browser, close-ups with a temporary camera hook, removed): Khoa,
  Vy, Huy, Mai, Minh, Tuấn in the room; shorts, thigh boots and the bare midriff on a standing
  figure in the customiser.

### Not done, limitations

- Not seen on Phú's display. No braid (Lan's), no hand props of the picture (tablet, flask,
  wrenches, clipboard, laptop in hand); no thigh strap; Tuấn's hoodie is colour-blocked, not a
  painted gradient. The jacket's zip lines lie on the plain shell, so on a bust they can sink
  under it (no one in the cast wears one so).
- Seated, dark streaks show at the sides of a lab coat's skirt (Lan, Mai) — seen once, cause not
  found yet.
- Frame times not measured after this change: **NOT RUN**.

## 9. C-11: the mirror's edges, Linh's legs and face, a woman's figure (2026-11-08 — not committed)

Phú (2026-11-08, with a screenshot): the mirror is pulled into streaks at its sides when the view
turns a little; Linh's shorts still look like long trousers; make Linh's face alluring without
making it ugly. Then: a woman's waist and bust beautiful, in proportion, truly feminine.

### Built

- **Mirror** (`mirrors.ts` `reflectedOffset`): the reflected camera is a turn, not a mirror, so a
  point of the glass at x across the view is at −x across the reflection's. C-8 cropped the
  reflection where the glass is in the player's view: right only for a glass in the middle of the
  view; off the middle it sampled past the rendered part (the streaks). The crop is now mirrored
  left to right.
- **Linh's legs**: shorts to the thigh's top fifth, thigh boots from below mid-thigh — a clear
  band of bare thigh — and, on the left thigh, a garter strap from the hem to the boot with a band
  and a buckle (worn with thigh boots and shorts or a skirt).
- **An alluring face** (`appearance.allure`, Linh's): a longer eye under a lower, flatter lid
  (half-lidded), the outer corner lifted, a dark liner with a long wing and two flicked lashes (in
  place of lash lines in the hair's colour), a fuller mouth in a deeper colour with a side smile
  and a lower lip, a beauty mark under the left eye, the brows a little higher. In the
  customiser's Face tab.
- **A woman's figure** (`curve`, from how much wider the hips are than the waist — data, not
  gender): the waist narrowest at the navel, the ribs under the bust curving in to it, the hips
  flaring out gradually through a high hip (it was a straight waist and a bell-like flare), the
  small of the back curving in above the seat; the hem of a knit top and the trousers' waistband
  follow the waist instead of standing out from it; a fold under each side of the bust on a close
  top. The jacket's sleeves now start at the arm's own top (bare shoulders showed through).

### Tests

- `npm run check`: **PASS** — 253 files, 3611 tests (new: the mirror's crop holds every corner of
  an off-middle glass in the reflected view, and the old crop does not; a curvy figure narrowest
  at the waist, wider at the ribs and the hips, flaring gradually). Two earlier full runs with the
  dev server and the browser busy failed timing tests (`frameCap.test.ts` 5.9 s, once
  `quality.test.ts`); both pass alone, and the whole run passes with the server stopped.
- `npx playwright test e2e/mirror.spec.ts e2e/character-page.spec.ts e2e/draw-calls.spec.ts
--workers=1` (dev, SwiftShader): **PASS** 17. The mirror's aside shot shows the room, no streaks.
- Seen in the dev app (built-in browser; temporary close-up cameras, removed): Linh's face from
  the front; a curvy figure front and side in the customiser; shorts, thigh boots and garter
  standing.

### Not done, limitations

- Not seen on Phú's display. Frame times not measured: **NOT RUN**.

## 10. C-12: Linh in the mirror — a fitted jacket, relaxed arms, shorter shorts (2026-11-08 — not committed)

Phú (2026-11-08, playing as Linh in the preparation room's mirror): the red jacket must lie
smoothly on the top at the chest (it was stiff); the arms should hang relaxed, not held out; the
shorts a little more open; with the lab coat on, what is under it shows through; Linh's width and
waist a little smaller, to look quick.

### Built

- **A fitted short jacket**: its shell is the chest's own profile a few millimetres out, over the
  bust as the top is (it was a roomy box from the hips' width); the opening's edges are piping
  lying on it; a small collar inside the lab coat's. (The zip jacket and the vests stay as they
  were.)
- **The lab coat over a jacket or a vest**: a layer roomier — its chest, depth, collar, the
  carrying out over a bust, and over sleeved jackets its sleeves (from the arm's own top). The red
  of the jacket no longer shows through at the shoulders and the chest.
- **Relaxed arms** (`fit.spread`): the upper arm was held clear of the chest's full width at the
  bust's height (and of the old roomy jacket): Linh's arms hung 0.62 rad out, the others' 0.24 to
  0.49. It now rests a quarter of its round against the ribs under the bust, and the bust no longer
  widens the chest sideways (it rises forward): the cast hangs 0.11 to 0.26 rad.
- **Shorter shorts**: cut high at the sides (their seat to 0.49 h) with a short, fitted leg; the
  garter strap from the new hem.
- **Linh slimmer**: shoulders 0.36 → 0.345 m, waist 0.245 → 0.224 m, hips 0.40 → 0.378 m, build
  0.94 (still one of the two curvy women the content test asks for). The customiser's sliders reach
  down to such figures (shoulders from 0.32 m, waist from 0.22 m).

### Tests

- `npm run check`: **PASS** — 253 files, 3612 tests (new: every character's arms hang under 0.3
  rad, bare and in the coat).
- `npx playwright test e2e/mirror.spec.ts e2e/character-page.spec.ts e2e/draw-calls.spec.ts
--workers=1` (dev, SwiftShader): **PASS** 17; the mirror shot shows Khoa's arms hanging close.
- Seen in the dev app (built-in browser): Linh's exact data as the player's own character in the
  customiser, with a temporary close camera (removed): the jacket on the chest, the arms, the
  shorts, and with the lab coat on.

### Not done, limitations

- Not seen on Phú's display; Linh as the player in the mirror not looked at here (her data in
  the customiser instead). Frame times: **NOT RUN**.
