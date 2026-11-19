# Phase W — the live wallpaper (report)

Phú, 2026-11-17: a live wallpaper where Linh and Khoa sit and stand on the roof of a tall
building, with SimLab floating in the distance:

- Linh sits on the ledge, swings her legs and now and then plays with a karambit.
- Khoa stands with his hands in his pockets, flips a black bank card and kicks a pebble.
- Now and then a helicopter blows the lab's roof open and a squad drops in; the two glance over,
  then turn back.
- The wind moves hair and clothes, and the city below keeps living.
- After about three minutes it turns to night: glowing cyberpunk clothes, other actions, the lab
  lit up.
- It should be 2–4K, smooth, studio-grade, and the mouse moves the view a little.

Phú's later turns:

- Make the city small, like the one seen through the hub's glass floor.
- The lab's underside is flat (the player looks down through its glass floor).
- Put the two on the right of the picture, looking deep into its left; set the building a little
  lower so everything is seen.
- Upgrade everything; it need not match the game exactly, but the two should still look like
  themselves.
- At sunset Khoa sits down by Linh; she leans her head on his shoulder and hugs him, his left
  arm round her waist; they sit close.
- Bald hair in the wind; arms through bodies.
- Lighter on the GPU (an RTX 5070 swinging 41–100 %), as the detailed wallpapers are. Settings
  for brightness and for afternoon / night. What is never seen not drawn, or drawn plainly.
- Natural hands, fingers and arms; no limb showing its pieces at a joint ("lộ khối"); no arm
  through skin.
- Khoa tires of standing, climbs onto the ledge and lies with his head on Linh's thigh.
- Her head must touch his shoulder, his hand must hold her waist, her other hand relaxed.
  Sitting down he steps up onto the ledge and then sits, his legs never through it.
- Linh more alluring. Now and then she turns to sit along the ledge, propped on one hand, one
  knee up and the other leg out on the ledge, and talks to Khoa with her free hand.

2026-11-18:

- Sitting sideways, her arm went through her leg and her chest through her leg.
- Pressed against something, her chest must give way ("ôm vào áp ngực vào thì ngực phải bị hóp
  vào").
- Learn from a reference render (a TikTok by chlrenders) Phú likes. Asked which parts, Phú
  chose:
  - bold ink lines;
  - long waved hair drawn in strands;
  - a curvier figure;
  - her own clothes kept.
- The mouse wheel turns the view. Scrolled down, the camera goes round to the left of the two
  little by little and stops side-on to Linh's right, more than 180° round. Scrolled up, it comes
  back to the starting framing.
- The city's houses more detailed, only where seen. What is not drawn must stay unseen from every
  angle the view can now take; if it can be seen, draw it.
- In Lively, at the sunset hug: an arm through a body (Phú's screenshot from the framing).

Phú forgot the Wallpaper Engine (Steam) login, so the wallpaper runs in **Lively Wallpaper**
(free; Phú installs it from the Microsoft Store). The page itself depends on no host.

## What it is

A real-time three.js page (`wallpaper.html`, entry `src/platform/wallpaper/main.ts`), not a
video. The mouse sways the eye for real (a spring, `framing.ts`), and events never repeat
exactly.

- **Where (`site.ts`).** The game's own city (`render/city`, `CityView`, the CC0 Quaternius
  models) is placed with SimLab over its middle, as in the game: the hub's floor is 120 m over
  the street. Our tower stands just past the city's south edge, its roof at 100 m, under the
  lab's floor, so the lab's flat underside shows. The lab is 365 m ahead on the left.
  - `CityView.load` takes an optional `LoadingManager`, and an optional `fullAt` (buildings in
    full detail besides the inner rings'). It now keeps its `models` and `plan`. The game's call
    is unchanged.
  - Buildings within 230 m of our tower are drawn in full detail (their window trims). Past that
    a trim is under a pixel.
  - Every building's roof gets things on it (`cityRoofs.ts`): a stair hut with its door, AC units
    with fans, vent pipes, a skylight; on bigger roofs a wooden water tank on legs; on tall ones
    a red light that burns by night.
    - Where a kind's roof is open is measured once on its model, with rays down on a 2 m grid.
    - The props are instanced: 10 draws for the whole city, under its sun and shadows.
- **The view.** The wheel turns the whole framing (eye and target) round a point between the two
  (`framing.ts`), so they stay where they are in the picture. It turns from the framing (0) to
  side-on to Linh's right: 263.7°, computed from the framing, past her left and her front. It
  stops there. Eased; a notch is about 8°.
  - What is left out stays out from every angle of that turn. Far trees are plain by distance
    from the roof, trims by distance from the tower, culling by the camera's view. The tower is
    a full box, the roof has parapets on all four sides, the land goes all round. Checked with
    stills at 45°, 120°, 150°, 180°, 230° and 264°.
- **Land (`land.ts`, `trees.ts`).** The flat ground of the town, then fields (plots with hedges,
  drawn per pixel), wooded hills (about 17 k instanced trees in 500 m tiles; far tiles use
  plain trees) and mountains out to 16 km. Street trees line the city's kerbs. The game's flat
  6 km ground plane is hidden.
- **The lab (`floatingLab.ts`).** The round hub hall with its glass walls, low dome, the oculus
  that raids blow open, mast and beacon; three two-storey wings (Physics, Chemistry, Biology)
  with their colour stripes and names; flat slabs underneath with the hub's glass floor and lift
  emitters flush in them. By night: lit windows and hall, edge strips, emitters throwing cones of
  light down, navigation lights and strobes. It bobs slowly.
- **The roof (`rooftop.ts`).** The ledge (cast-stone coping), cornice, parapets, cooling units, a
  water tank, a stair hut, vents and a mast with a blinking red light. Concrete has a generated
  normal map (lumps, grit, pits), so it is not a flat plastic sheen. Our tower's glass walls are
  worked out per pixel (`towerFacade.ts`).
- **The raid (`raidPlan.ts`, `raid.ts`).** The game's police helicopter flies in over the city,
  hovers over the oculus. The blast is a flash (a light always present, so no shader is
  rebuilt), a glare, a fireball, a shock ring, thrown bits and loose, light smoke drifting
  downwind. Ropes drop, four slide down, the ropes come up and it leaves; the hole glows, and the
  glass mends 75 s after the blast. Raids come every 2.5–4.5 minutes, the first at 38 s, never
  near the sunset scene.
- **The day (`cycle.ts`, `sky.ts`).** A seven-minute loop: afternoon 3 min (the sun swings to set
  behind the lab, in the picture), sunset 40 s, night (stars, moon, the city's own night),
  dawn 30 s. Light, haze, exposure, grade and bloom follow the hour; reflections come from three
  pre-made sky maps.
- **Picture (`post.ts`).** Two passes (far 1 m – 30 km, then near with depth cleared), a
  half-float target, bloom, tone mapping, a grade and SMAA, at the screen's own resolution
  (pixel ratio up to 2).

## The two

They are the game's own Linh and Khoa (`Actor`), each built twice: day clothes, and black night
clothes. At dusk a scan of light swaps the clothes from the feet up; at dawn it swaps them back.

- **Rig (`rig.ts`, `ik.ts`, `spring.ts`, `keys.ts`).** Every frame each behaviour writes an
  `Intent` (where the body is, the joints it wants, where hands and feet must reach, finger
  curls, pockets, gaze). The rig follows it with second-order springs per joint (a weight that
  overshoots a little and settles, slower in the trunk, quicker in the hands), plus slow noise
  so nobody stands still. Hands and feet reach their targets by two-bone IK with a pole for the
  elbow or knee, and palms and soles are turned flat onto what they rest on. Fingers curl in a
  cascade (each joint after the one before), so a hand closes and opens rather than snapping.
  Khoa's hands go into and come out of his pockets along a path.
- **Bodies as solids (`contact.ts`, 2026-11-18).** Each person is a few capsules refreshed from
  the bones each frame: the trunk (two side by side, below and above the waist), the head, and
  each limb bone. Every reach is kept out of its own body and the other's:
  - A wrist going into a body is put on its surface.
  - The elbow or knee swings round the reach to the nearest angle where both bones pass clear,
    eased so it never jumps. Legs only keep out of the chest and the other's trunk: thighs side
    by side may press.
  - Part way between a pose and a reach, a limb is carried by place (wrist and elbow points),
    not by blending joint turns. A blended turn had swept a forearm through a thigh.
  - Linh's hands move from where they rest to where they go and arc over what lies between
    (`reachOver`); they are never let go on the way.
- **A bust that gives way (`press.ts`).** Where an arm, a knee or the other's body presses on
  Linh's chest, the surface is pushed back out of it in the vertex shader. Every layer moves the
  same way and in order: skin, top, jacket and ink. The push eases in over 2.5 cm, goes no deeper
  than the bust rises (5.2 cm), and the lit surface turns with it.
- **Long hair (`drape.ts`, `look.ts`).** Linh's hair is long past her shoulders, still pink.
  - Waved before skinning, so the waves turn with the head; outward only.
  - Drawn in fine strands that bend with the waves.
  - It hangs: below the scalp the head's tilt is undone, more the lower it falls.
  - It lies on her shoulders and back and on him, pushed out of the capsules there; it has no
    ink where it lies on something.
  - It takes no shadow: its waves stood out of the shadow cast by its unwaved self, as patches.
- **Figure.** Linh in the wallpaper only: waist 0.205, hips 0.405, bust 0.05, build 0.9. The
  game's Linh is unchanged.
- **Ink.** The outline is drawn as ink: near black, about 2.6 px on the picture at any distance
  (its width set from each one's distance every frame), thicker and thinner along the body.
  Being a hull, it lines an arm across the body too.
- **Joints (`caps.ts`).** A ball in each elbow and knee, skinned to the joint, dressed in what
  covers it there (the layer reaching farthest out) and sized over all that lies under it, so a
  deeply bent knee or elbow shows boot or sleeve, never the limb's pieces or the skin below.
- **Look (`look.ts`).** A rim of light (sun-coloured by day, neon by night; less on skin). Hair
  sways in gusts, only away from the scalp; clothes ripple; the outline moves with them. By
  night the clothes glow: the game's trims, and lines drawn on the jacket by their place on the
  body (a Y up the back, a ring at the hem, rings above the cuffs, a stripe down Linh's sleeves,
  a ring round her boots' tops), so the neon reads from behind too. A light runs up the lines
  now and then.
- **Actions.** A director picks each one's next action from the hour's menu, never the same
  twice running.
  - Linh, day: lean back, tuck her hair behind her ear, lean forward, talk to Khoa, karambit,
    stretch. Night: knee drawn up (foot planted on the ledge), hair, talk, karambit, lean back.
    She sits with her ankles crossed, chest up, head tilted.
  - Talking (32 s): she draws her knees up, leaning back a little, and turns to sit along the
    ledge. She props herself on her left hand. Her left knee is up, fallen out over the drop,
    with its foot planted. Her right leg lies long and loose towards Khoa. She talks with her
    right hand, out before her shoulder, or rests it on her thigh; Khoa turns to listen. Then she
    turns back the same way.
    - With the right knee up (before), her chest and her talking hand went through it.
  - Knee drawn up (night): she sits back a little on the ledge, the knee falls a little out, and
    her hands are folded on top of it.
  - Khoa, day: black card flips, kicking the pebble, glance, neck roll, tired. Night: the card's
    hologram, kick, glance, neck roll, tired.
  - Tired (`tired`): he rubs the small of his back; then he walks to the ledge, steps up, sits,
    swings his legs onto it and lies back with his head on Linh's right thigh (8 s), stays 44 s
    while she strokes his hair, and gets up the same way. Not near the sunset scene.
    - His palms stay on the ledge beside his hips as he turns, then go over his front onto his
      belly. Before, they rested "on his chest" with the forearms inside him.
  - The pebble slides where he kicks it and bounces off the ledge. The blast makes both turn to
    the lab.
- **Sunset (`cycle.ts` `TOGETHER`).** Khoa walks over, steps up onto the ledge one foot at a
  time, steps over and sits by Linh, hip by hip. Her head rests on his shoulder (solved on the
  real skeletons, so the temple touches it); her right arm goes round his back, his left hand
  round to her waist; her other hand rests in her lap. Arms going round are carried round
  behind the bodies, not through them. They change clothes sitting there; some time into the
  night he gets up and goes back.
  - Held, she turns and leans in. The search that finds her head on his shoulder now also finds
    how she leans, and where she sits for it: a little ahead of him and over to him, within
    limits. It holds her chest pressed about 2 cm against his side, her shoulder clear of his
    trunk, and his shoulder clear of hers.
  - Her palm is on the middle of his back, on his jacket. His palm is at her waist, on her back's
    surface, towards her far side; his elbow goes round well behind her.
  - What went wrong (Phú's screenshot, 2026-11-18): she had moved over 5 cm, so her shoulder sat in
    his. Her near-straight arm to his belt then crossed his flank. Its line went through his
    shoulder blade.
    - The solids and the test had both taken his trunk too thin: 10.5 cm and 8.7 cm deep,
      where his jacket stands 15 cm behind his chest's axis. Measured on the clothed bodies, they
      are now 13 cm (her) and 15 cm (him). Above the waist, the test's trunk now reaches up
      through the shoulder blades.
    - A knee's swing round its reach is now ±0.5 rad at most. Crouched with his foot under his
      hip, Khoa's knee had swung a full turn in 0.1 s, through her once.
  - Her long hair hangs two thirds of the way to straight down and is pushed only off trunks, not
    arms. Fully hanging, it fell from the raised side of her tilted head onto her shoulder and
    spread there like a cape.

## Settings and performance

The Lively panel (`LivelyProperties.json`, `settings.ts`, read through `livelyPropertyListener`):

- Brightness 50–150 %.
- Time: automatic (afternoon → sunset → night), always afternoon, always sunset, always night.
- Frames per second: 30, 60 (default), 120, or the screen's.
- Quality: High, or Low (70 % resolution).

Lighter on the GPU:

- Frames are capped (60 by default) instead of drawn as fast as possible. The GPU swung between
  41 and 100 % because every vsync drew a full frame.
- Nothing is drawn while the page is hidden (Lively covers or pauses it).
- Every shader is compiled before the first frame (a first sight of the karambit used to stall
  300 ms).
- Bloom runs only by night and in the blast. The city's shadows are redrawn only when the sun
  has moved.
- What is never seen costs little: off-screen tiles and objects are culled, far trees are a few
  triangles, back faces are not shaded.

Frame time, 2560×1600, frame rate unlimited (`fps=0`), headless Edge on ANGLE (NVIDIA GeForce
RTX 5070 Laptop GPU, Direct3D11), the dev server, 6 s after 4 s of warm-up. 2026-11-17 is before
this round's additions (solids, bust, long hair, ink, city roofs and trims); 2026-11-18 is with
them:

| Hour                 | Frames | Mean    | p95     | Slowest | 2026-11-17 mean |
| -------------------- | ------ | ------- | ------- | ------- | --------------- |
| Afternoon            | 1802   | 3.33 ms | 6.10 ms | 14.6 ms | 2.85 ms         |
| Sunset               | 1756   | 3.42 ms | 6.70 ms | 12.9 ms | —               |
| Night                | 1724   | 3.48 ms | 4.40 ms | 17.4 ms | 2.94 ms         |
| Afternoon, 200° turn | 2039   | 2.94 ms | 5.50 ms | 14.0 ms | —               |

Measured with the 60 fps cap on, the same script reads ~10 ms. Those are the page's own frames
spaced at the cap, not the cost of drawing.

At the default 60 fps that leaves the GPU idle most of each frame. GPU load in % was not
measured (Task Manager on Phú's machine will show it).

## Package for Lively

`npm run wallpaper` (`scripts/wallpaper-pack.mjs`, `vite.wallpaper.config.ts`) writes
`dist-wallpaper/`: `index.html`, `wallpaper.js` (14.7 MB, 4.1 MB gzip), `LivelyInfo.json`
(type web), `LivelyProperties.json` and `thumbnail.jpg`, and zips them into
`dist-wallpaper/SimLab3D-HinhNen.zip`.

Lively opens wallpapers from disk (file://), where module scripts and fetches of local files are
refused. So the build is one classic script (IIFE), and the city's models are packed into it
as data URLs (the virtual module `virtual:wallpaper-city`, empty under the dev server).

To install, add the zip in Lively ("Add wallpaper"); its settings are in Lively's customise
panel. Set the wallpaper input to the mouse if the view does not follow it or the wheel does not
turn it.

Dev: `npx vite --config vite.wallpaper.config.ts --port 5198` and open `/wallpaper.html`.
Address settings for stills: `w`/`h`, `t` (a frozen clock; the minutes before it are lived
first), `mx`/`my`, `eye`/`target`/`fov`, `time`, `bright`, `fps`, `hide`, `lapAt`/`chatAt`
(start those scenes at a time), and `yaw` (the view turned, degrees, as by the wheel).

## Checks (2026-11-18)

| Command                                                                               | Result                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`, 2026-11-18 07:58                                                     | PASS: 333 files, 4198 tests (after the solids, bust, hair, ink and wheel; before the city roofs)                                                                |
| `npm run check`, 2026-11-18 08:12 (with the city roofs and `CityView` change)         | FAIL: 1 of 4198. See below.                                                                                                                                     |
| `npx vitest run src/gameplay/experiment/EnzymeActivityStation.test.ts`, twice         | PASS: 5 tests, 3.1 s                                                                                                                                            |
| `npx vitest run src/platform/wallpaper`                                               | PASS: 11 tests                                                                                                                                                  |
| `npx tsc --noEmit -p .`; `npx eslint src/platform/wallpaper src/platform/render/city` | PASS                                                                                                                                                            |
| `npm run wallpaper`                                                                   | PASS: package built (14.8 MB script, 4.2 MB zip)                                                                                                                |
| The package from disk (`file:///…/dist-wallpaper/index.html`) in headless Edge        | PASS: ready in 8.7 s; wheel down turns to her right side and stops, up comes back; every Lively property applied; no page errors (ANGLE D3D11, RTX 5070 Laptop) |

The 08:12 failure: `EnzymeActivityStation.test.ts`, "plots the activity against temperature and
against pH", timed out at 5.5 s against its 5 s limit.

- It is in the game's Biology lab, not touched by this work.
- It also timed out once at 07:58 before a clean full run.
- Alone it passes in 3 s.

It is a flaky timing test under a loaded full run; it is not counted as a pass.

After the hug fix (2026-11-18, later):

| Command                                                                                                | Result                                                                                                           |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `npx vitest run src/platform/wallpaper`                                                                | PASS: 11 tests                                                                                                   |
| `npm run check`, three runs                                                                            | FAIL: 6, then 14 files, then 21 tests timed out (5.0–6.9 s against 5 s), all in game tests outside the wallpaper |
| `npx vitest run src/game/titrationBench.test.ts src/gameplay/experiment/EnzymeActivityStation.test.ts` | PASS: 17 tests                                                                                                   |
| `npx vitest run --maxWorkers=6` (every unit test)                                                      | PASS: 333 files, 4198 tests                                                                                      |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check .`                                      | PASS                                                                                                             |
| `npm run wallpaper`; the package from disk in headless Edge                                            | PASS: ready in 9.3 s, wheel and every Lively property, no page errors                                            |

The full `npm run check` fails only by timeouts under load. It uses as many workers as the machine
has threads. With six workers every test passes, and the failing files pass alone. The machine
was otherwise idle (1–9 % CPU) between runs. So the timeouts are counted as FAIL in the full run,
not as a fault of this work.

`cast.test.ts` (2026-11-18) adds a body through itself: a forearm in its own legs or trunk, a
thigh past the hip or a shin in its own trunk, a pocketed hand left out. It also adds her bust:

- Anything pressing deeper than the bust can give (its depth + 1 cm) is a fault, "into her
  chest".
- Through the settled hug her chest must press his side at least 8 mm.

Before this round's fixes it found, among others:

- her talking forearm 6.9 cm in her own raised thigh;
- the raised thigh 4.2 cm in her trunk;
- Khoa's forearms 7.5 cm inside his own body while lying down and getting up;
- her thigh 4.1 cm in her chest hugging her knee by night.

All of those now pass.

## Checks (2026-11-17)

| Command                                                                                                                 | Result                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run check` (typecheck, lint, format, unit tests)                                                                   | PASS — 333 files / 4197 tests                                                                |
| `npx vitest run src/platform/wallpaper --maxWorkers=4`                                                                  | PASS — 10 tests                                                                              |
| `npm run wallpaper`                                                                                                     | PASS — package built                                                                         |
| The package opened from disk (`file:///…/dist-wallpaper/index.html`) in headless Edge, each Lively property set in turn | PASS — ready in 5.9 s, every property applied, no page errors (ANGLE D3D11, RTX 5070 Laptop) |

`cast.test.ts` measures the two on their real skeletons:

- A whole day at 30 Hz; then the lap scene; then the talk.
- Each limb is sampled along its bones. A sample inside the ledge, the roof's floor, the
  cornice's drip or the tower's face is a fault, beyond its own thickness less 2 cm. So is a
  sample of one person inside the other's trunk.
- Where they rest on each other, the contact is checked after a dwell:
  - her temple within 7 cm of his shoulder;
  - his hand within 7 cm of her waist;
  - his head's back within 5 cm of her thigh.

Stills were taken with headless Microsoft Edge on the real GPU: ANGLE (NVIDIA GeForce RTX 5070
Laptop GPU, Direct3D11). This includes close-ups of knees, elbows and hands by day and night.

## The live background in the game's menu (2026-11-18)

Phú: the wallpaper in the game's own menu. Settings switch the menu background between the
default and the live one. On the live one, the layout of the menu (Play, Settings, …) and its
design change with each view and each hour. After Play, the pages sit on the same background,
see-through. Layouts were approved from mockups ("Vị trí thì đúng rồi"); the style was raised
("nâng cấp kiểu thiết kế và phong cách ấn tượng lên") and approved ("Đẹp rồi, làm đi"). The
animations must be smooth and striking.

- **Setting.** Settings › Graphics › Menu background: Default / Live
  (`simlab.settings.menuBackground`, a browser preference, never in the save; `Game.menuBackground`,
  event `MenuBackgroundChanged`). Default unless chosen: the live one costs the GPU on every frame
  of the menu. Hidden and off at Low quality.
- **Loading.** `MainMenu` loads `ui/liveMenu.ts` only when it is chosen and the menu shows (its own
  chunk, 118 kB + three.js); it is freed when the world is entered or the setting turns off.
  `startWallpaper` now returns `{ view(), dispose() }`, takes the city's packed files as an option
  (the Lively build passes them; the game fetches its own `hub-city/`), and takes a filter for
  the wheel (not over a page or list that scrolls, the character page or a dialog). The game's
  Medium draws the scene at 70 %; the game's frame cap applies.
- **Look (`ui/liveLook.ts`, pure, tested).** The style by the scene's hour:
  - day: white glass, ink black, a sky-blue Play, yellow labels;
  - evening (golden light > 0.35): cream glass, plum ink, an orange Play, amber labels;
  - night (> 0.5 night): black glass, neon cyan ink (Khoa's), a glowing magenta Play (Linh's).

  The layout by the wheel's turn:
  - behind them (> −1.1 rad): the name under the lab, the buttons in a cascade under it;
  - before them (to −3.4 rad): the name high over the sky, a long Play over a row of three;
  - at her right side: the name and the buttons down the bare roof on the left.

  The scene's time and the part of the day (morning, afternoon, evening, night) on a label top
  right; the wheel's hint bottom right ("Scroll up to turn back" at the end of the turn).

- **Design (`ui/liveMenu.css`).** As the wallpaper is drawn:
  - Ink lines, slanted parallelograms, hard offset shadows, solid colours (no gradients), an icon
    on each button (masks), halftone dots behind the name.
  - The character as a face in an inked ring with a slanted name label.
  - The pages after Play (Play, Single player, Multiplayer, Settings, the catalog) are
    see-through glass (blurred) with ink borders and hard shadows. Their heads (eyebrow, title,
    lead) and Back are on ink labels, so they read over a bright sky.
- **Motion.** Transforms and opacity only, with less motion when the player asks for it:
  - Entrance: the name stamped on (overshoot, a small rotation), the subtitle and the dots
    sliding in, the buttons arriving one after another with a little overshoot, the corner
    labels dropping in.
  - Under the pointer: a lift with a deeper shadow and a shine crossing. Pressed: pushed in.
  - A layout change: everything flies out to the left in 0.26 s and comes back in its new place.
  - The hour: colours crossfade over 0.9 s. At night the Play button breathes its neon.
  - The pages come in with their cards rising one after another.
- **Words.** New interface keys with Vietnamese in `content/strings.json`: `menu.menuBackground…`
  and `menu.live…`.
- **Dev only.** `?liveTime=afternoon|sunset|night` holds the scene's hour, to see each style.
- **Every page in the same design (`ui/liveKit.css`, Phú: "tất cả thành phần tương tác ngoài
  trang chủ cũng làm theo thiết kế của nó").** With the live background on, every page and
  control besides the home page is drawn the same way: Play, Single player, Multiplayer, the
  experiment catalog, Settings (all four sections), Controls, the character page, the customiser,
  and Ultra's dialogs. Two layers:
  1. The game's design tokens (text, accents, surfaces, lines, the primary button, corners,
     focus) are pointed at the hour's palette inside the live menu and its dialogs. The palette
     now sits on the page's body (`body.live-ui` and the hour's class, set and removed by
     `liveMenu.ts`), so dialogs opened on the body follow it.
  2. Each kind of control drawn in ink:
     - buttons as slanted parallelograms;
     - fields with hard shadows;
     - sliders as an inked track filled to the value (`--fill`, set when one moves or a page
       opens, never per frame) with a slanted thumb;
     - switches as slanted boxes;
     - Settings' tabs as slanted labels that slide out;
     - selectors framed in ink;
     - cards, lists and panels as glass with ink borders;
     - the catalog's folds as tags, keys as keycaps;
     - the customiser's tabs, options and swatches as labels.

     Their motion: a lift and a deeper shadow under the pointer, a press, the pages' parts rising
     in one after another, dialogs popping in.

  The default background leaves every page as it was; in the world (the pause menu) nothing
  changes. Checked headless on the real GPU at afternoon, sunset and night, with an inventory
  of every interactive element per page; no page errors.

Checked in the real game (dev server, headless Edge, ANGLE D3D11, RTX 5070 Laptop, 1600×1000):

- the live menu comes up about 8 s after load;
- day, evening and night styles;
- the three layouts by the wheel, and the wheel's hint;
- the Play, Single player and Settings pages over the scene;
- Settings › Graphics › Menu background back to Default frees the scene (no live canvas) and the
  default menu returns;
- Single player › New game from the live menu enters the world with the scene freed (one canvas
  left, the game's);
- no page errors.

The game's own frame-time readout on the live menu: 3.4 ms mean, about 299 fps, uncapped,
Medium. That is the dev server in headless Edge, not the 300 Hz display.

### The opening no longer stalls (2026-11-18)

Phú: with the live background, the app's opening animation stuttered.

**Cause.** The live menu was built when the game was ready, during the opening. It ran in one go:
the city, four bodies, three sky maps, a few hundred shaders. That held the page's thread 1.7 s
(6.3 s with no shader cache), and the opening's SVG motion runs on that thread.

**The fix.**

- **The opening's phases.** `AppIntro.phases` gives `leaving` and `gone`; `main.ts` passes them
  to `MainMenu`, then to `LiveMenu`.
- **A still first.** The live menu turns live at once over a still of the scene's first moment,
  `public/menu/live-still.jpg`.
  - 3200×1350, 560 kB, made by `npm run live-still` (`scripts/live-still.mjs`).
  - It is drawn as tall as the window and centred, so it matches the scene from 16:10 to 21:9.
  - The panel is held back (`live-wait`) until the opening leaves. Then the entrance plays as the
    opening fades.
- **The build after.** Only once the opening has gone and the entrance has played (1.5 s) are
  three.js and the scene loaded. The live menu's own chunk is now 7 kB; the scene's is 116 kB.
- **Built a step per frame.** `startWallpaper` takes `yieldTo`, a frame given back between steps:
  - the city, roofs, land, trees, lab, roof;
  - each of the four bodies (`castAsync`: `cast` is now a generator, `castSteps`, run whole by
    `cast` for the tests and Lively, a step at a time by `castAsync`);
  - each sky map;
  - each texture uploaded (`initTexture`);
  - the far pass drawn once, then the near pass a mesh at a time (Direct3D finishes a shader at
    its first draw: one body's first draw had held the page 0.65 s).

  If the menu goes meanwhile, the step throws, the build stops and frees its graphics context.
  `MainMenu` treats that as no error.

- **The scene fades in.** Once it has drawn four frames, it fades in over the still (1.2 s) and
  the still goes.

**Three causes of rebuilt shaders, found on the way:**

1. **The warm-up compiled every program for the screen**, while the picture is drawn into the
   post target. three builds different programs there, so all were built again at the first frame
   (4.4 s cold). `post.compile()` now compiles into the post target, plus the passes' own
   materials, with `compileAsync` so the browser can build them off the page's thread.
2. **The raid's flash light sat inside the raid group, which is hidden between raids.** So the
   far pass gained a light when a raid started and lost it when the raid ended. three rebuilt every
   city program each time: a stall at every raid, in Lively too. The light is now in the scene on
   its own (`RaidView.light`).
3. **The city's sun was hidden at night.** That too changed the light count, with all city
   programs rebuilt at dusk and at dawn (and at the first frame, the warm-up having run at night).
   It is now kept in the scene, dark (intensity 0) under the horizon.

The people are also compiled with a clipping plane, as the outfits' scan draws them.

Measured with `intro.mjs`: headless Edge, ANGLE D3D11, RTX 5070 Laptop, the dev server, the
opening on (`?intro=1`), frames timed with requestAnimationFrame and long tasks (> 50 ms)
observed.

| Live background                | Before: during the opening     | After: during the opening | After: the 12 s after it |
| ------------------------------ | ------------------------------ | ------------------------- | ------------------------ |
| Cold (no shader cache)         | one 6.3 s stall; a 7.4 s frame | no long task              | slowest frame 391 ms     |
| Warm                           | one 1.7 s stall; a 2.0 s frame | no long task              | slowest frame 120 ms     |
| Default background (reference) | no long task                   | —                         | —                        |

- The only long task left in the opening is the page's own load (~370 ms). The default
  background has it too.
- The cold 391 ms is the first sky map's shaders.
- Entering the world while the scene is still being built: the build stops, no scene canvas is
  left, no page errors.
- The Lively package still loads from disk with every property, no page errors.

## The rocket opening (2026-11-18)

Phú's first ask: with the live menu background, the app opens with a rocket flying past. Time
slows in the middle, and the camera goes to each subject's place on it in turn:

- **Chemistry, the tail.** The substances burning in the flame.
- **Physics, the body.** The forces on it, summed.
- **Biology, the nose.** Khoa inside, his vitals, the cabin's air.

A first version did that in a world of its own: a fly-by over a sea of cloud.

Phú then asked for a story instead:

1. The rocket comes down from above, near the building where Linh is.
2. As it nears, the camera goes into the cabin beside Khoa. He presses to the window looking at
   the building and opens the door.
3. Outside, the camera rides with the rocket near him. He swings out and hangs from the door by
   a hand.
4. Over Linh's roof he lets go and lands, the camera below looking up.
5. He walks to Linh and sits down by her.
6. Professional, cinematic shots and moves.

Asked, Phú chose:

- the notes kept, woven into the story;
- a nose-down dive swooping close past the building (the less realistic option, knowingly);
- the rocket then climbing away towards SimLab.

Later the same day Phú added:

- a Skip button in a corner;
- for the door: hold the handle, brace, wrench the door open, then one hand up to the bar
  outside, out, and only then the jump;
- a landing with more force, then a cooler landing pose.

The fly-by world was removed. The opening now plays in the live wallpaper's own world.

### What plays

The opening runs about 31 s; Skip ends it at once.

| Time (s)  | Shot                                     | What happens                                                                                                                                                                                                                                                                                                                                                                       |
| --------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–2.5     | From the roof, low, by Linh              | She looks up; the rocket dives out of the sky, nose down.                                                                                                                                                                                                                                                                                                                          |
| 2.5–4     | Long lens from the roof's corner         | Its nose swings up and the engines light.                                                                                                                                                                                                                                                                                                                                          |
| 4–7       | The tail                                 | Time slows to 0.03×. **Chemistry:** molecules pop in by the flame (CH₄, two O₂, a flare, CO₂, two H₂O), each with a labelled leader line, and the panel.                                                                                                                                                                                                                           |
| 7–10      | Square to the flight's plane             | **Physics:** thrust, weight and drag (drawn ×10) grow from the centre of mass and are added tip to tail into the net force (1 MN = 5 m), with the panel.                                                                                                                                                                                                                           |
| 10–13     | From over the city, side-on              | Real speed: the dive curves out along the building.                                                                                                                                                                                                                                                                                                                                |
| 13–17.8   | In the cabin beside Khoa                 | 0.22×. He presses to the porthole looking at Linh's roof. **Biology:** his vitals (marked "illustrative") and the cabin's air. Then: his right hand on the handle, his left braced on the doorway; he gathers and wrenches the door open, leaning back into it, lets the handle go as the door runs on; steps to the edge holding its front frame, reaches up for the bar outside. |
| 17.8–20.2 | Outside, riding with the rocket          | He swings out and hangs by one hand, the roof and Linh ahead below.                                                                                                                                                                                                                                                                                                                |
| 20.2–23.4 | Low on the roof, ahead of where he stops | He lets go and flies over the ledge at the camera. The impact is held (0.2×) with a camera shake and dust. A three-point landing (right knee down, left foot planted, right fist struck on the roof, left arm swept back) skids to a stop before the camera. Head down at the impact, then up, looking into the lens. The rocket climbs away towards SimLab.                       |
| 23.4–31   | Crane into the wallpaper's framing       | He rises, watches the rocket, walks to his place by Linh, and the wallpaper's own sit begins. The menu comes in as he sits.                                                                                                                                                                                                                                                        |

### The science

All on screen comes from `simulation/rocketSwoop.ts` (new; 6 tests).

- **The dive.** Engines off: weight and drag only, integrated (RK4). The fins keep its nose along
  its velocity until the thrusters swing it round for the engines.
- **The pull-out.** A quintic path matched in position, velocity and acceleration at both ends.
  The thrust is what the path needs (T = m·a − W − D). The rocket points along its thrust, and
  its mass falls at |T| / (Isp·g0).
- **The climb.** Integrated at half thrust towards SimLab.
- **The numbers.** It dives from ~230 m, pulls out at ≤ 3.1 g, passes the roof at 18 m/s and climbs
  away.
- **The physics notes.** They show the forces at the pull-out: T 3.53 MN, P 1.45 MN, Fc 8.2 kN, F
  2.16 MN, a = 14.6 m/s², 148 t, 61 m/s. The net force points up and against the motion: the
  dive bends into a climb and the rocket slows.
- **The chemistry notes.** The burn is at the engines' thrust then (`simulation/rocketBurn.ts`, 2
  tests: mass balance, the 1 : 2 CO₂ : H₂O ratio, nothing unburnt at the stoichiometric mix).
- **The biology notes.** The felt acceleration is the model's. The vitals are illustrative and
  say so.
- **What it simplifies.** Speed only drops while the nose is above the motion, so the swoop
  flares with its nose high. This is physics, not taste.
- **What is fiction.** Khoa's leap: off at the rocket's 17 m/s plus a push towards the roof,
  ballistic to the landing, then a skid. The forces shown are the rocket's own.
- The old ascent model (`rocketAscent.ts`) and its fly-by are gone.

### How it is built

- **`wallpaper/prologue/`:**
  - `plan.ts`: the script, pure, 3 tests. Two clocks: the opening's and the rocket's, with the
    time scale between them, including the hit-stop at the landing. Shots, notes windows and
    Khoa's moments.
  - `rocket.ts`: the rocket.
    - Its door slides round the hull. The doorway is cut out of the hull and out of its ink (from
      inside, the ink had filled it black).
    - A porthole, a handle by the door's front edge (shown only while it is in the doorway), the
      bar over the doorway, the cabin, the engines and the flame.
    - The trail thins away after ~2 s.
  - `notes3d.ts`: the molecules and arrows.
  - `stunt.ts`: what Khoa's part needs each frame, and his ballistic flight.
  - `Prologue.ts`: ties it together: the cameras, Linh's look, the dust, `view()`.
- **The cast (`cast.ts`).** Khoa's stunt branch: cabin, yank, edge, reach, swing out, hang, fall,
  land, rise, watch, walk. Its end is the first key of the existing sunset sit. Linh looks at the
  rocket, then at him.
- **The rig (`rig.ts`).** It stands a body in a turned vehicle (`root.frame`). It takes places and
  reach targets without easing when carried fast (`exact`).
- **`Wallpaper.ts`:**
  - The world runs on the rocket's clock. The wallpaper's clock is set from it, so he reaches his
    place at the loop's sunset sit, 140 s.
  - The camera's far plane is 3 km during the opening.
  - It adds `skip()`, `anchor()`, `prologueView()` and `swoop()`.
- **`liveMenu.ts`.**
  - It builds the scene at once in this mode; there is no still.
  - It holds the panel back, shows the notes (`ui/rocketIntro/rocketOverlay.ts`) and the Skip
    button, plays the roar, and brings the menu in at the end.
  - It plays only at the app's start.
- **`AppIntro.ts`.** It shows a cover until the scene draws: sky, the name, a loading line, all
  compositor animations. A click on the cover is kept as a skip.
- **Dev params.** `?prologueAt=<s>` starts the opening there; `&prologueHold=1` holds it, for
  stills.

### Measured

`pro-run.mjs`, a scratch tool:

- headless Edge, ANGLE D3D11, NVIDIA GeForce RTX 5070 Laptop GPU;
- the dev server;
- a fresh profile, so the live background is on by default;
- about 300 frames a second there.

| Run          | Under the cover                      | While the opening plays                               |
| ------------ | ------------------------------------ | ----------------------------------------------------- |
| First (cold) | 6.4 s; 20 long tasks, biggest 0.41 s | 8 500 frames: no long task; 1 frame > 20 ms (20.1 ms) |
| Second       | 3.7 s; 10 long tasks, biggest 0.14 s | 9 018 frames: no frame > 20 ms                        |
| Skip at 5 s  | —                                    | the menu 0.4 s later; one 70 ms task at the skip      |

- The first frame after the cover lifts takes 67–357 ms. It is under the cover's fade.
- The cover's own motion is compositor-only.
- **Stills.** Every shot, in Vietnamese and English.
- **After Skip.** Khoa sits by Linh with the hug; the menu is in.
- **After the whole opening.** He sits by her as the menu comes in.

## Other changes the same day

- **The live background is now the default** (Phú). At Low the menu keeps the game's own.
- **A first-time hint** (Phú): a pulsing red dot on Settings, then on the Graphics tab, then on
  the Menu background row, leading to the live background.
  - It shows only while the menu is the default one and the graphics are not Low.
  - Once Graphics is opened it counts as seen (`simlab.settings.liveHintSeen`). The row's dot
    goes when a choice is made.
  - Test in `Game.test.ts`.
- **"Experiment catalog" was cut off** in the live menu's front layout (Phú's screenshot). The row
  of three buttons is now as wide as their labels.
- **Play jumped instead of moving** when the view was turned on and on, above all at night
  (Phú).
  - At night, the glow's animation rule replaced the entrance and exit; now they play together.
  - Layout moves are one at a time, to the latest layout, after the entrance has landed.
  - An earlier entrance's timer no longer cuts a later one short.
  - Measured while turning the wheel back and forth at night: no visible jump.
- **Their arms jerked in the hug** (Phú).
  - Her elbow round his back flicked between two near-tied swings as she breathed: 1.3 cm in
    one frame, every few seconds.
  - Arms now also try swings just either side of their own (±0.06 rad), so the elbow eases
    instead.
  - Measured over 100 s of the hug: no jerk. The whole-day contact test still passes.
- **Khoa's sunglasses seemed to slip off in the jump** (Phú, after the commits). They were drawn
  all along. Their flat lenses stood 1.5 cm off a face that curves back, so from the side his eye
  showed beside them and the far lens stuck out past his cheek.
  - Sunglasses now wrap round the face (`BodyModel.ts`, every character wearing shades). Each
    lens's outer half reaches on 3.6 cm towards the temple, turned back as far as it stays 6 mm off
    the face.
  - Seen in zoomed stills at 19.6, 20.6, 21.05 and 21.3 s: the eye is covered and the lenses sit
    on the face. New test in `body.test.ts`.

## The still menu kept the integrated GPU busy (fix, 2026-11-18)

Phú: from the live background to the default one, the integrated GPU still ran hard. Measured
(headless Edge, a trace of the compositor at the menu, default background, Medium):

| Each second                | Before | After | Every animation off |
| -------------------------- | ------ | ----- | ------------------- |
| Frames drawn and presented | 601    | 66    | 8                   |
| GPU flushes                | 601    | 66    | 8                   |
| Commits from the page      | 902    | 98    | 12                  |

The live scene itself was gone (no WebGL draw after the switch); what remained were the default
background's own looping CSS animations — three full-window star layers moving 0.04 px a frame,
the emblem's SVG parts (a paint and a commit each frame), the first-time hint's pulse. While any
of them runs the browser draws and presents the page every frame: 300 times a second on a 300 Hz
screen, and on a laptop with two GPUs the presenting is the integrated one's. Now they are paused
and moved on 30 times a second (`ui/steppedMotion.ts`, from the menu's update): their keyframes,
delays and easing unchanged; entrances and transitions left to the browser; an animation its CSS
takes away (reduced motion, hidden) is never moved again. `steps()` in the stylesheet was tried
first and gave nothing: the browser draws every frame while an animation runs, even unchanged.

Checks: `steppedMotion.test.ts`; `menu.spec.ts` and `intro.spec.ts` PASS (dev server,
SwiftShader) — the stars still drift at 11, 7 and 4 px/s, still under reduced motion. Those two
specs had failed since the live background became the default (it hides the sky, the emblem and
the trail and plays its own opening): they now ask for the default background.

- **The rocket opening.**
  - It was checked headless on the real GPU (stills, frame times), not yet watched on Phú's
    300 Hz display or in the desktop app. Its sound was not heard (headless has no audio out).
  - It is a first pass at the shots and poses, tuned on stills: the landing, the yank and the
    reach are keyed and IK-solved, with no motion capture. Hands meet the handle and the bar as
    reaches, not as fingers wrapped round them.
  - The leap is fiction (off a rocket at 17 m/s); the rocket's forces are the model's.
  - The cover waits 3.7–6.4 s while the world is built; the opening is ~31 s (Skip ends it).
  - The wallpaper's cycle starts at its sunset sit after the opening, so the menu opens in the
    late afternoon rather than at its start. The menu after a game starts the wallpaper at its
    own start, over its still, as before.
  - The landing's dust is a ring of small puffs; it reads as rolls more than as dust.
  - Not checked in a narrow window (phone shape): the shots are framed for a wide screen.
- The live menu was checked headless; not yet on Phú's 300 Hz display or in the desktop app. Its
  motion was seen as stills, not felt.
- While the live menu shows, the game's own renderer still draws its hidden menu scene at its
  20 Hz idle rate behind it.
- The still behind the live menu is a picture of the scene as it is now. When the wallpaper's look
  changes, it must be made again (`npm run live-still`), or the handover shows the difference.
- After the opening, while the scene is built, steps of 70–130 ms remain (each body, the roof):
  the menu's hover answers a little late for about two seconds, once.
- The two are the game's procedural anime bodies with a better look and a new rig. They are not
  new studio-made models. Close up, faces and fingers are the weakest; the framing sees them
  from behind and the side.
- Motion is keyed and solved by code (springs, IK, keys), with no motion capture. The karambit
  spin and card flips read at the wallpaper's distance; they are not finger-accurate.
- The constraint test checks limbs against the roof and the other's trunk, not every finger
  against every surface; contacts are checked as distances, not as skin meeting skin.
- The pebble comes back to Khoa's feet 25 s after it stops away from them, and can be seen
  doing so.
- The raid is seen from 365 m: the squad are simple figures; the blast is particles, not a
  simulation. No sound.
- Dawn is a cross-fade to the afternoon's light, so the loop joins.
- Not tried in Lively itself (not installed here): the package was checked from disk in Edge,
  which Lively's WebView2 is built on. Frame times are from headless Edge, not from Lively on
  the desktop.
- Whether Lively passes the mouse wheel to a web wallpaper on the desktop is not verified. If it
  does not, a slider in the Lively panel can turn the view instead.
- The solids are capsules: a slim waist and a broad chest are the same width to them, and
  fingers are not solids.
- The bust gives way to capsules (arms, legs, his body), not to every surface. In the hug it
  presses his side, which the main framing sees from behind.
- Long hair is pushed out of the capsules near it, not out of every part of every body. Where it
  is squeezed against his shoulder in the hug, its edge is a little ragged up close.
- The ink is the body's outline drawn bolder, not edge detection: folds inside a surface get no
  line.
- The city roofs' props are simple shapes, sized for 100 m away. The water tanks and stair huts
  are plain close up.

## Next

Phú's look on the 300 Hz display, in `npm run app`: the rocket opening (each start of the app;
the live background is now the default), its Skip button, the landing, the first-time red dots,
the live menu turned at night, the hug; and the wallpaper in Lively. Then, by what Phú says,
more detail where Phú points.

Committed on Phú's word (2026-11-18), before the look on the 300 Hz display: 33e2f31 (the
wallpaper, the prologue, the swoop model), a5a81b2 (the live menu, the hint, the opening), and
this report.
