# Phase V contract — the hub over a city (2026-11-07, DRAFT)

Phú (2026-11-07): "đồ họa đó em thấy vẫn chưa ưng ý lắm, em có đề xuất là phần nền ở sảnh cho thành
kiểu kính, phía dưới là một khu phố thành thị". Decisions given with it: a large glass area in the
middle of the hub; then (same day) "phần low và medium không hiện thành phố ở dưới, nó là nền trắng
thôi. Còn khi bật high thì thành phố đơn giản, ultra mới làm chi tiết"; the city follows the game's time
of day, one day lasting 15 minutes — by day as seen from high up (~120 m), by night with lit windows
and street lights, dawn and dusk made to look right; the city from downloaded CC0 models.

## 1. Rules kept

- Presentation only: the hub's floor collider, the doors, the stations, every experiment and its
  readings are unchanged. The glass is walked on like the floor it replaces.
- The rooms stay evenly bright (labs-bright rule): the time of day changes what is seen outside —
  the city under the glass, the sky in the clerestories and the oculus — never the light the hub,
  the labs or the corridors are lit with. The labs show no outside at all, so they never change.
- Low and Medium keep the hub's floor as it is today: no glass, no city, nothing loaded for them.
  High and Ultra only: the city is drawn only while the hub is (room sleep), and its assets load
  with the hub scene under those presets, lazily, never before and never at Low or Medium.
- The time of day is a game clock, not the wall clock: deterministic from play time, so a save
  continues the same hour. No simulation reads it.
- Every download is asked for first (name, source, size).

## 2. What is built

### 2.1 The clock

`game/clock`: the time of day from the session's play time (a day = 900 s of play, starting at
08:00 on a new game). Shown nowhere by default; the debug panel shows it. A save format change if
play time is not already saved (`SAVE_VERSION` bumped, a migration and its test).

### 2.2 The sky

The clerestories and the oculus show a sky that follows the clock: the sun's direction, a blue day
sky, a warm dawn and dusk, a dark night with stars. Generated (no download). Lighting inside stays.

### 2.3 The glass floor

Between the column rows, about x −9 … 9, z −8 … 2 (18 × 10 m): laminated glass panes in a steel
grid (1.2 m module) flush with the stone floor, the stone kept round it by the walls. The floor
emblem stays as a frosted inlay in the glass; the reception and the directory stand on it. Under
the glass: the tower's own structure for a few metres (the slab's edge, beams), then the drop.

### 2.4 The city

From ~120 m up: city blocks of the downloaded modular buildings (Boston/NYC style), assembled
deterministically (fixed seed) on a street grid with sidewalks, crossings and street furniture,
out to a horizon haze. Per preset:

| Preset     | Floor and city                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Low/Medium | the hub's floor as today (white stone): no glass, no city                                                                                        |
| High       | the glass and a simple city: buildings merged per block, streets, windows lit at night as a texture, a few street lights                         |
| Ultra      | the detailed city: every building piece, street furniture, street lights, traffic (cars with lights at night), its reflection in the glass, haze |

By night the windows light in a fixed random pattern that changes slowly; dawn and dusk blend.

## 3. The download (asked for separately)

- **Quaternius, Downtown City MegaKit — Standard** (CC0): https://quaternius.itch.io/downtown-city-megakit,
  `Downtown City MegaKit[Standard].zip`, **223 MB** (FBX, OBJ and glTF together; free, "name your
  own price" at $0). Only the glTF models and textures used are shipped, compressed; the zip and
  the rest stay outside the project. No other download is planned; cars and street lights are
  modelled here if the pack lacks them.

## 4. Steps (each looked at by Phú on the real display and benched before the next)

| Step | What                                                              | Done when                                                  |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| V-1  | The clock and the sky (clerestories, oculus)                      | a day passes in 15 minutes, saved and continued            |
| V-2  | The glass floor and the city by day, High and Ultra               | the hub over a city at both, benched; Low/Medium unchanged |
| V-3  | Night: lit windows, street lights; dawn and dusk; Ultra's traffic | a full day looked at, benched                              |

## 5. Performance and honesty

- Bench (`npm run bench`, real GPU, the renderer named) in the hub at every preset, by day and by
  night; the Low preset also measured with the GPU limited as before. SwiftShader numbers are never
  given as GPU results.
- e2e: the hub's tests unchanged; a test that the floor collider and the doors are as before; the
  draw-call counts of the labs unchanged at every preset.

## 6. Decisions for Phú

- D1 the download above (223 MB zip, CC0).
- D2 the glass area as in §2.3 (between the column rows) — or another size.
- The sky (§2.2) follows the clock at every preset (it is cheap); only the floor and city are High and Ultra.
- D3 a new game starts at 08:00; the clock shown only in the debug panel — or also on the HUD.
