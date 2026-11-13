# Phase C contract — choosing a character in a room full of people (2026-11-07)

Phú (2026-11-07, then away: "Em từ bây giờ sẽ bắt đầu treo máy và để thầy làm"): replace the
two radio buttons with a character page. Decisions below were taken by thầy on Phú's behalf
(he is away), each the recommended option; every one can be changed after his look. Nothing is
committed before he has seen it on his display.

## 1. What Phú asked (his words, summarised)

1. The menu shows a row "Choose your character" with a picture of the chosen character at its end.
2. Clicking it slides in a new page: the chosen character stands in the middle, in front of a
   room full of researchers and interns of different styles, talking or discussing a project.
3. "<" and ">" on either side change the character, in a fixed order (never random). ">": the one
   in the middle walks out to the right, the next walks in from the left and strikes their own
   pose; "<" the other way round.
4. The one called up was doing something in the room (talking, a task): they stand up, walk to
   the front, pose for the player; when another is chosen they walk back to what they were doing.
5. The people behind are not frozen nor on one loop: they talk in groups, notice someone and go
   over to talk, do their own tasks — each as their personality suggests. Someone talking who is
   called up leaves their partner, who waits or goes to talk to someone else; they come back after.
6. A button in the middle to choose.
7. More detailed characters, each with a personality of their own, men and women.
8. The room: a lab, a café or a hall.

## 2. Decisions (taken for Phú, recommended)

- **D1 The cast: eight playable characters**, four men and four women, the two of today kept
  (their ids: saves name them) and given a name and personality; six new. Everyone in the room is
  a playable character (pressing ">" calls one of them up); no extras in the first step.
- **D2 The room: the institute's common room** — a café counter with a coffee machine, a
  whiteboard covered in a project's sketches, a long table with laptops and papers, a sofa corner,
  plants, windows. Lab, café and hall in one place, lit brightly ([[labs-bright]]).
- **D3 Personality is data** (`characters.json`): role, a one-line personality, a signature pose,
  how sociable and how restless they are, the tasks they like. The room's behaviour reads these
  numbers; no code branches on a character id.
- **D4 Detail**: new hair styles (long, bun, curly, side-parted), glasses, tops (shirt, hoodie,
  sweater, blouse) and the lab coat per character (interns without). Presentation only, as today:
  no gameplay rule reads them.
- **D5 Its own lazy chunk and its own WebGL canvas**, made when the page opens and freed when it
  closes; the menu's code stays under its budget. Its quality follows the graphics setting.
- **D6 Behaviour**: each person has an activity (a task at a spot, a conversation in a group, a
  walk to someone); every few seconds each one may change by its weights and what is around;
  called up, they go to the front mark and pose; sent back, they return to their activity or, if
  it ended, choose another. Seeded randomness: the same room plays out the same way each time it
  opens (testable).
- **D7 The order**: the cast's order in `characters.json`; ">" the next, "<" the previous,
  wrapping. Several presses in a row: the last one wins (the one walking up turns back).

## 3. Steps (each: tests, stills, report; no commit before Phú's look)

- **C-1** the cast data and the body's new detail (schema, eight characters, hair, glasses, tops).
- **C-2** the page: menu row with the portrait, the slide, the room, the front mark, "<" ">",
  walking in and out, the poses, the Choose button, English and Vietnamese.
- **C-3** the room alive: activities, conversations, walking over to someone, the called-up
  person's partner waiting or leaving, everyone going back.

## 4. Not in this contract

- Voices or speech text (talk is shown by gestures and turned heads only).
- Changing the character in a running game (the choice is made before New game, as today).
