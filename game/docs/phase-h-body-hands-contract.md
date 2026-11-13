# Phase H contract — the body, hands that hold, and actions acted out (2026-11-03)

Status: **APPROVED** by Phú, 2026-11-03, with the decisions of §12; built in three steps (D6),
each with Phú's display QA and a commit. Step H-1 (the body, shadows, mirrors, walking) first.
Request (Phú, 2026-11-03): a whole human body, so that the player sees themself in their shadow
and in a mirror (male and female told apart); taking the coat off acted out (taken off, carried,
put in the cabinet), and the same for the other actions (picking up a ball, lifting a flask,
pouring into a tube…); everything held is held in the hands, never floating; the hands placed for
each task, and the person leaning in for precise work such as pouring. Already decided by Phú: the
body is built in code (no downloaded model); mirrors in the preparation room and the teacher's
washroom, reflecting on High/Ultra and not on Low; this phase starts after Phase B and L are
committed (done: 290f136, b52938d).

## 1. Objective

The player is a person in the world, not a camera with two boxes in front of it:

1. **A body.** Head, torso, arms with elbows and wrists, hands with a thumb and fingers, legs and
   feet, in the character's height (1.75 m and 1.65 m today) and build, with hair, clothes and the
   PPE being worn (coat, gloves, goggles, face shield). Male and female differ in build, hair and
   clothes, all read from the character's data.
2. **Seen.** In its shadow (cast by the room's key lights, as the scene's own objects are), in a
   mirror, and when the player looks down (torso, legs, feet; the head is never drawn for the
   player's own eyes).
3. **Holding.** A held object sits in the hand, gripped where a person grips it (a bottle by its
   body, a flask by its neck, a pipette between the fingers, a burette with both hands); the arms
   reach it. Large items are held with both hands.
4. **Leaning in.** For precise work — pouring, pipetting, drops, reading a meniscus up close — the
   upper body leans in and down towards the work, the view with it.
5. **Acting.** Actions play as short motions of the body: putting on and taking off the coat
   (taken off, carried in the hand, hung in the wardrobe), gloves, goggles and the face shield;
   picking up and setting down; throwing the ball; pouring and squeezing; pressing a button and
   turning a dial; opening a door or a cabinet; the hand-hygiene steps (today's hand motions,
   moved to the new arms); walking and turning.

## 2. Scope

| #   | Part     | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Body     | A procedural skinned body (one skeleton, about 25 bones; one mesh per material: skin, hair, shirt, trousers, shoes, each piece of PPE) built in `src/platform/render` from the character's data. Characters gain `appearance.build` (shoulder and hip widths) and `appearance.hair` (a style id); no rule branches on `gender` (the schema's rule, kept).                                                                                                                  |
| H2  | Seen     | The body is drawn in the scene and casts shadows (it replaces the invisible shadow cylinder). Its head and hair are on a layer the player's camera does not see; shadows and mirrors see it. Looking down shows the torso, legs and feet. The first-person hands of today (`HandsView`, boxes drawn over the world) are retired: the body's own arms are the hands.                                                                                                        |
| H3  | Mirrors  | A `mirror` item: a real reflection (a mirrored camera into a render target) on High and Ultra, half resolution on Medium, a dark glass with no reflection on Low; rendered only while the mirror is in view and within 6 m. One full-length mirror in the preparation room (beside the PPE wardrobe); the teacher's washroom mirror (decor today) becomes one.                                                                                                             |
| H4  | Walking  | Idle, walk and turn poses: legs stepping in time with the capsule's speed, arms swinging when empty; nothing changes how the player moves (physics keeps the capsule).                                                                                                                                                                                                                                                                                                     |
| H5  | Hands    | Two-bone arm IK to grip points. Items gain `grip` data (where and how each hand holds it: one hand or both, palm direction, finger pose). The hold point becomes the hand's reach (`player.holdDistance` about 0.5 m from the eye, was 1 m); physics still moves the held body (ObjectHolder), and the arms follow the object's drawn pose, so a blocked object keeps the hand with it.                                                                                    |
| H6  | Lean     | While pouring, pipetting, giving drops or looking closely, the upper body leans towards the work (up to about 0.25 m forward and 0.15 m down), eased in and out; the eye and the hold point move with it, the capsule does not. A clearance probe (physics query port) stops the head at benches, shelves and walls.                                                                                                                                                       |
| H7  | Actions  | Action sequences as data (`actions.json`: keyframes of hand targets, body pose, lean, the item's attachment, the moment the state changes, a duration). An `ActionSystem` in gameplay owns their timing: it starts one when an action is performed, keeps movement and other actions waiting while it plays (looking around stays free), and changes the world's state at the sequence's keyframe (the coat off the body, then in the wardrobe). Views only play the pose. |
| H8  | The list | Sequences in this phase: coat on and off (with the wardrobe), gloves on (dispenser) and off (into the waste bin), goggles and face shield on and off, pick up and set down (short: about 0.4 s), pick up from the floor (a crouch: the burette, a dropped ball), throw, pour (wrist tilt), pipette fill and deliver, dropper squeeze, press, turn a dial, open and close a door or a cabinet door, the hand-hygiene steps.                                                 |
| H9  | Tests    | IK, grips, sequences (timing, the state change at its keyframe, input waiting) and the lean probe unit-tested; the body's draws and the mirror's cost measured; e2e: the coat taken off into the wardrobe, a flask held in the hand and poured, the mirror shows the player (a pixel check), the shadow follows the body. Every e2e that aims with `HOLD = 1` updated to the new reach.                                                                                    |

## 3. Non-goals

- Faces with expressions, lip sync, character creation or customisation screens, a third-person
  camera, cloth simulation (the coat is skinned to the body, not simulated), photoreal skin.
- Any change to an experiment's model, definitions, results or measurements: only where hands
  and objects are, never how much is poured or what is measured.
- Other people in the world (teacher, other students).

## 4. Constraints

- Architecture: physics stays authoritative for motion (the capsule and held bodies); gameplay
  decides what is held and when an action's state changes (`ActionSystem`, data in `actions.json`);
  the renderer reads state and plays poses; no three.js outside `src/platform`. No gameplay rule
  reads `gender`; reach and eye height come from appearance values.
- Saves: no format change (an action in progress is not saved: a save during one keeps the state
  from before it, or after it if its keyframe has passed).
- Performance: High holds 300 fps with vsync at 2560×1600 in every lab and the preparation room
  with the mirror in view (GPU A/B before and after, the renderer named). The body costs at most
  about 8 draws plus its shadow passes. Low gets no mirror reflection and a cheaper body (no finger
  bones, fewer segments); Low's frame time on the software renderer is measured before and after.
- Science and teaching: grips and motions are plausible lab practice (a flask by its neck, a
  pipette bulb squeezed, the burette with both hands); where a motion is simplified for play it is
  marked as an AFFORDANCE, as the burette filled on the floor is.
- Languages: every new prompt or notice through `Texts`, with its Vietnamese.

## 5. Risks

- **The reach change (H5)** touches every aiming test: pours, set-downs, the e2e aim arithmetic
  (`HOLD = 1` in many specs) and the unit tests that place a held object at 1 m. It lands as its
  own step, all tests moved together.
- Hands clipping into benches when standing close, elbows bending the wrong way: joint limits and
  the clearance probe; a hand never enters a wall it is held out of (the object's pose leads).
- Sequences that take control can annoy: they stay short (≤ 0.5 s for picking up and setting
  down, ≤ 3 s for clothes), and looking around is never taken away.
- A body in first person can clip the camera's near plane (0.05 m) when looking down or leaning:
  the head is hidden, the neck and shoulders kept clear of the eye.
- The mirror's cost (a second render of the room) and the extra shader programs (a compile hitch
  the first time a mirror is seen): mirrors render only in view and in range, programs precompiled
  with the room.
- Size: this is the largest phase so far. It is delivered in three steps (§11 D6), each with its
  own tests, report and Phú's display QA before the next.

## 6. Tests and verification

`npm run check`; full `npx playwright test`; GPU A/B (`gpu-fullscreen`, High, vsync and uncapped)
before and after each step, in every lab and the preparation room facing the mirror; screenshots
of the body in the mirror and in its shadow for each character; Phú's 300 Hz QA after each step.

## 7. Rollback

Each step is one commit series after its QA; a step that fails QA is reverted whole. H1–H4 (body,
mirrors, walking) can ship without H5–H8 (the old floating hold stays until H5 lands).

## 11. Decisions for Phú

- **D1 — one hand or two.** (a) **Recommended:** the right hand for small items (bottles, flasks,
  pipettes, the ball), both hands for long or heavy ones (the burette, the coat while carried);
  the free hand steadies or rests. (b) Always one hand.
- **D2 — while an action plays.** (a) **Recommended:** moving and other actions wait until it ends
  (at most 3 s for clothes, under 0.5 s for picking up), looking around stays free. (b) Moving
  cancels the action (the state does not change).
- **D3 — leaning in.** (a) **Recommended:** automatic while pouring (R), pipetting, giving drops and
  looking closely (C). (b) A key to lean in and out by hand.
- **D4 — the hands' detail.** (a) **Recommended:** a thumb and four fingers in two joints each, posed
  per grip (holding a neck, pinching a pipette, pressing a button). (b) A thumb and a mitten for the
  four fingers (fewer bones, simpler grips).
- **D5 — what the player sees of themself.** (a) **Recommended:** the whole body except the head:
  looking down shows the torso, legs and feet, and the arms in front are the same arms the mirror
  shows. (b) Only arms and hands in first person; the whole body only in shadows and mirrors.
- **D6 — order of delivery.** (a) **Recommended:** three steps, each with Phú's QA and a commit:
  **H-1** the body, shadows, mirrors and walking (H1–H4); **H-2** hands that hold, the new reach and
  the lean (H5, H6); **H-3** the actions (H7, H8). (b) All of it in one delivery.

## 12. Decisions (Phú, 2026-11-03)

1. D1 (a): one hand for small items, both hands for long or heavy ones.
2. D2 (a): moving and other actions wait while an action plays; looking around stays free.
3. D3 (a): the lean is automatic while pouring, pipetting, giving drops and looking closely.
4. D4 (a): a thumb and four fingers, two joints each, posed per grip.
5. D5 (a): the whole body but the head in first person.
6. D6 (a): three steps — H-1 body, shadows, mirrors, walking; H-2 hands that hold, the reach, the
   lean; H-3 the actions — each with Phú's QA and a commit. In H-1 the body's arms are seen in the
   shadow and the mirror only; the first-person hands stay until H-2 makes the body's arms the hands.
