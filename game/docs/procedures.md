# Procedures (Phases 5–6A)

A **procedure** is an ordered, data-defined list of steps the player must do before an entrance
opens. The shipped one is **cleanroom entry** (`src/content/procedures.json`): read the rules,
put on a lab coat and safety goggles from the wardrobe, wash hands at the corridor basin, rub in
hand sanitizer, put on gloves, then go through the door to the clean area (SIMLAB Hub).

> It is a **simplified, illustrative teaching sequence**, not a certified cleanroom,
> laboratory-safety or infection-control protocol. Durations (2 s per rubbing motion, 3 s for
> sanitizer) are shortened game timings, not recommendations.

## Model — `src/gameplay/procedure/procedure.ts`

```
ProcedureDefinition {
  id, name, description,
  scene            world scene where it is done (preparation-room)
  entrance         entity id of the door it gates (cleanroom-corridor/door-hub)
  exits[]          doors out of the preparation area (preparation-room/door-teacher)
  stages[]         { id, label } for the HUD (Briefing, Gowning, Hand washing, …)
  requiredEquipment[]  item ids that must be worn *when entering* (checked live)
  steps[]          ordered; each { id, stage, instruction, hands? } plus one of:
    wear     { item }                         done when the item is worn
    state    { condition: {item, key, value} } done when an entity of the item has that state
    perform  { item, action, durationS = 0,   done when the action is performed on the item
               requires: [{item,key,value,message}] }   (and held for durationS seconds)
}
```

`hands` names a first-person hand motion (`wet`, `soap`, `rub-palms`, `rub-backs`,
`rub-fingers`, `rub-thumbs`, `rinse`, `dry`, `sanitize`) the renderer acts out.

Content validation (`checkProcedure` in `src/game/content.ts`) rejects at boot, with a path: an
entrance that is not a door placed in the scene, an exit that is not one (or is the entrance),
required equipment or `wear` steps whose item is not wearable PPE placed in the scene,
`state`/`requires` items that are not placed, `perform` steps whose item does not offer that
action (actions come from the behaviours' `actionIds`), duplicate step ids, unknown stages,
durations outside 0–60 s.

## State machine — `src/gameplay/procedure/ProcedureSystem.ts`

Progress is `progression.procedures[id] = { completed: stepId[], entered }` (saved). The current
step is the first step not completed; steps complete **strictly in order**, and `completed` is
always rewritten as the exact prefix of steps done — ids from an edited or older save that are out
of order or unknown never count. The status is **live**: `ready` and `entered` only while the
entrance would open right now (every step done, required PPE worn); `entered` additionally means
it has been used.

```
not-started ──first step done──► in-progress ──last step done and requiredEquipment worn──► ready
     ▲                                ▲  │                                                   │
     │                                │  └─ required item taken off ◄────────────────────────┘
 new game                             │                                (ready ⇄ in-progress)
                                      │
ready ──travel through the entrance──► entered   (ProcedureEntered, saved)
entered ──required PPE taken off──► in-progress ──put back on──► entered
any ──travel through an exit──► not-started   (ProcedureReset; only if anything was done)
```

Per step:

- **wear / state** — complete as soon as they are current and hold (checked on
  `EquipmentChanged`, `EntityStateChanged`, `SceneLoaded`). Turning the water on early is fine:
  the `water-on` step completes the moment it becomes current.
- **perform, quick** (`durationS` 0) — the action on the right item while current completes it.
- **perform, timed** — the action starts a timer (`ProcedureStepStarted`); the step completes
  after `durationS` seconds of play while the player keeps looking at that object. Looking at
  anything else or leaving the scene cancels it (`ProcedureStepCancelled` with a reason); pressing
  again during the timer is refused ("Already in progress: keep looking at it.").

Rules are one **action guard** (`InteractionSystem.addGuard`). Before any action runs the guard
may refuse it with a reason; refused actions do nothing and publish `ActionBlocked`:

| Situation                                                    | Reason shown                               |
| ------------------------------------------------------------ | ------------------------------------------ |
| Entrance before every step is done                           | `Entry blocked. Next: <next instruction>`  |
| Entrance with all steps done but required PPE taken off      | `Entry blocked. Put on: <items>.`          |
| Action of a later step (e.g. soap before wetting hands)      | `Not yet. Next: <next instruction>`        |
| Equipment worn too early (only other wear steps may precede) | `Not yet. Next: <next instruction>`        |
| Current step's `requires` not met (wash with the water off)  | the requirement's `message`                |
| Timed step already running                                   | `Already in progress: keep looking at it.` |
| Garment in a closed container (behaviour's own `blocked()`)  | `Open the wardrobe first.`                 |

Repeating a completed step is allowed and counts for nothing (reading the notice board again).
Coat and goggles may go on in either order; gloves only after hand hygiene.

Events: `ProcedureStepStarted`, `ProcedureStepCancelled`, `ProcedureStepCompleted`,
`ProcedureReady` (once per transition into ready), `ProcedureEntered`, `ActionBlocked`,
`EquipmentChanged`.

`view(id)` gives the HUD, renderer and debug panel everything derived from state: status, step
n/total, next step, stage label, missing equipment, running timer, last hand motion.

## Leaving: the exit and de-gowning (Phase 6A)

Areas, as the world has them: the **preparation area** is the Preparation Room scene — the
Preparation Room (wardrobe) and the cleanroom corridor (wash station, glove dispenser); the
**clean area** is everything behind the entrance — the hub and the laboratories. The Teacher Room
is outside both.

- **Back from the clean area**: the hub's "Back to Preparation Room" door arrives 1 m inside the
  entrance, in the corridor. Nothing is taken off by the trip and the preparation stays valid, so
  the entrance opens again straight away (status `entered`): the gate never traps anyone.
- **De-gowning** is the player's own interactions: the used gloves into the corridor's waste bin
  (UX3: disposable, never back into the dispenser), goggles, face shield and coat back on their
  hooks in the (open) PPE cabinet. Taking required PPE off or discarding it closes the entrance
  again (`Entry blocked. Put on: …`) until it is back on — gloves: a fresh pair.
- **Walk-through doors (phase WX).** The entrance and the exit are sliding pairs like every door.
  The procedure is the guard on opening them, as before. "Entered" and the reset now happen when
  the player walks through into the other scene (`SceneEntered` with the door passed), not when
  the door is used.
  - Taking off or discarding required PPE is refused while the clean-area entrance is not closed,
    so nobody de-gowns in an open doorway.
  - A procedure's door closes as soon as the player is more than 2 m away, without the 1.5 s wait,
    once the player has come near it.
  - Procedure conditions count only objects of the procedure's own scene, so a neighbour scene
    that is attached does not change them.
  - Known gap: an object propped in the exit's doorway keeps that door open, and nothing stops a
    player from putting PPE on and walking out. There is no interlock at the exit like the one at
    the entrance.
- **The exit** (`exits`: the Teacher Room door) refuses travel while any PPE is worn — "Take off
  your PPE before leaving: lab coat, safety goggles." — so PPE stays in the lab area and no door
  action skips de-gowning. Going through it resets the procedure (`ProcedureReset`, a notice), so
  entering the clean area again needs the whole preparation, hand hygiene included.
- Not rules: the order of de-gowning, and washing hands after it (see Limitations).
- The developer scene jump is a teleport: it neither checks nor resets anything.

## Equipment — `src/gameplay/player/Equipment.ts`

`player.equipment` (saved) lists worn item ids. Only the `wear` behaviour changes it:

- Garments (`"params": { "container": "wardrobe" }`): **Put on** hides the object from its spot
  (`taken` state); looking at the empty spot offers **Put back**. Both need the container open.
- Dispensers (`"params": { "dispenser": true }`, the glove box): **Put on**; the box stays.
  Disposable PPE (item `disposable`: the gloves) has no **Take off** anywhere: once worn it is used,
  and the `waste-bin` behaviour (the corridor's pedal bin) offers **Discard used …** — removed
  for good (`EquipmentChanged` with `discarded`, the notice "Discarded: …, used"). The save is
  unchanged: it lists what is worn, and a used pair is never anywhere to take back.

Items declare `wornOn: body | hands | eyes | face`; the view shows worn PPE from that, never from
item ids: coat-coloured sleeves (body), glove-coloured hands (hands), a goggles frame (eyes), a
tinted shield (face).

## The cleanroom corridor station

| Object (item)             | Behaviour                    | Action ids              |
| ------------------------- | ---------------------------- | ----------------------- |
| Notice board              | `inspect`                    | `inspect`               |
| Wardrobe (PPE cabinet)    | `openable` (doors swing)     | `open`, `close`         |
| Lab coat, goggles, shield | `wear` (container: wardrobe) | `wear`, `take-off`      |
| Faucet                    | `faucet` (`running` state)   | `water-on`, `water-off` |
| Hand-wash basin           | `use` (+ `inspect`)          | `wash`                  |
| Soap dispenser            | `use`                        | `take-soap`             |
| Paper towels              | `use`                        | `dry-hands`             |
| Hand sanitizer            | `use` (+ `inspect`)          | `sanitize`              |
| Glove dispenser           | `wear` (dispenser)           | `wear`                  |
| Waste bin (pedal bin)     | `waste-bin`                  | `discard`               |
| Door to the clean area    | `travel` (gated entrance)    | `travel`                |

`use` is a named action with no effect of its own; what it means comes from the procedure.

## Add a procedure

1. Place the objects (items with the behaviours above) in a world scene.
2. Add an entry to `procedures.json`: scene, entrance door entity id, stages, required equipment,
   steps. `npm test` reports any reference that does not match the placed objects.
3. The HUD objective, entrance gate, saving and debug line work without code changes.

## Limitations

- Hygiene is modelled as an order of actions, not physically: no hand-contact tracking, no
  contamination after a correct step (touching a door handle does not undo washing), no check
  that hands stay raised after disinfection (the hands are only shown raised).
- One active procedure per scene; the developer scene jump (F3 panel) bypasses the gate.
- De-gowning has no enforced order (gloves first, coat last) and no hand washing after it; only
  "no PPE through the exit" is a rule. Re-gloving after taking gloves off inside the preparation
  area needs no new hand hygiene (no contamination model).
- A timed step needs continued focus; there is no "hold E" input.
