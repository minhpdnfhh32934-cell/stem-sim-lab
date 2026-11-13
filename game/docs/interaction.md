# Interaction

Look at something, press **E**, something happens. The system is generic: it knows targets,
actions and a ray — never what a door or a lamp is.

## Concepts — `src/gameplay/interaction/InteractionSystem.ts`

```ts
interface InteractionAction {
  id: string; // 'open', 'activate', 'travel', …
  label: string; // shown in the HUD prompt
  isAvailable(): boolean;
  /** Why it cannot be done right now (e.g. "Open the wardrobe first."), or null. */
  blocked?(): string | null;
  perform(): void;
  /** Performed with the held object on this target (E while holding), e.g. "Load into the launcher". */
  withHeld?: boolean;
}

interface Interactable {
  id: string; // entity id for world objects
  displayName: string;
  center: Vec3; // world-space box used for targeting (live reference for entities)
  halfExtents: Vec3;
  rotation: Quat; // [x, y, z, w]; live reference for entities
  actions: readonly InteractionAction[];
}
```

The **primary action** is the first available one (E performs it); the **secondary action** is
the next available one (F performs it, binding `secondary`). Actions that are not currently
available (e.g. "Close" on a closed cabinet) are skipped, so one behaviour can offer opposite
actions, and the order of `interactions` in the item decides which action is primary:

| Item                    | `interactions`        | E (primary)          | F (secondary) |
| ----------------------- | --------------------- | -------------------- | ------------- |
| Steel ball, microscope  | `["grab", "inspect"]` | Grab                 | Inspect       |
| Desk lamp               | `["toggle", "grab"]`  | Turn on / Turn off   | Grab          |
| Door, cabinet, bench, … | one behaviour         | its available action | —             |

`primaryAction(id)` / `secondaryAction(id)` return them (the HUD shows both keys); `interact()` /
`interact(true)` perform them. Both keys in the same frame perform only the primary action.
Further actions (a third available one) are reachable only through `perform(targetId,
actionId)` — the hook for a future action wheel / configuration panel.

## Flow

1. `World.spawn(entity)` publishes `EntitySpawned`. The interaction system asks each behaviour
   listed in `entity.item.interactions` for its actions and registers an `Interactable`.
2. Every frame while playing, it casts a ray from the player's eye (`position + eyeHeight`, yaw,
   pitch) and focuses the nearest target box within `config.player.reach` (2.2 m). Boxes, not
   spheres, so a lamp on a desk can be targeted. The test (`rayBox` in `core/math.ts`) handles
   any orientation, and entity targets reference the entity's `Pose` arrays, so an object that
   physics moves or tumbles stays targetable where it actually is. Focus changes publish
   `InteractionFocusChanged`.
3. On the `interact` input it performs the focused target's primary action (on `secondary` the
   secondary one) and publishes `InteractionPerformed`. If the action is held back (below), it
   does nothing and publishes `ActionBlocked { entityId, actionId, reason }` instead.
4. `EntityDespawned` (or calling the unregister function) removes the target; if it was focused,
   focus is cleared and announced. Acting on a removed or unknown target is a logged no-op.

Error isolation: a throwing action is caught and logged; the game continues.

## Held-back actions and guards (Phase 5)

An available action can still be **held back with a reason**: first by its own `blocked()`
(a garment in a closed wardrobe), then by **action guards** — rules other systems register with
`addGuard((entity, actionId, pressed) => reason | null)` (the returned function removes it;
`pressed` is true only when `perform` asks, so a guard may log a real refusal, never a prompt's). The
procedure system was the first guard: it holds the cleanroom door shut and refuses steps
done out of order ([procedures.md](procedures.md)). Since Phase 6B the station system is the
second: experiment rules such as "Load a projectile ball into the launcher first." or the
lane limit ([experiments.md](experiments.md)). `blockedReason(targetId, action)` answers
the same question without acting, so the HUD shows the reason under the prompt before the player
presses anything; a press shows it again as a warning notice. Interaction stays generic: it never
knows what a procedure is.

## Behaviours — `src/gameplay/interaction/behaviors.ts`

| Id          | Actions                                                                                                                                                              | Placement params                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `inspect`   | Inspect → `ItemInspected`                                                                                                                                            | —                                                        |
| `toggle`    | Turn on / Turn off (`active` state)                                                                                                                                  | —                                                        |
| `openable`  | Open / Close (`open` state)                                                                                                                                          | —                                                        |
| `travel`    | a walk-through door (item with `door`): `label` opens it (`DoorRequested`), "Close the door" while it is not closed; any other door publishes `SceneChangeRequested` | `targetScene`, `label`, `arrival` (door entity id there) |
| `grab`      | Grab → the player holds it (see below)                                                                                                                               | — (item must be dynamic)                                 |
| `faucet`    | Turn on / off water (`running` state)                                                                                                                                | —                                                        |
| `wear`      | Put on / Put back or Take off (PPE; never Take off for `disposable` PPE)                                                                                             | `container` (placement), `dispenser`                     |
| `waste-bin` | Discard used … (the worn `disposable` PPE: gloves), removed for good                                                                                                 | —                                                        |
| `use`       | one named action, no effect of its own                                                                                                                               | `action` (id), `label`                                   |

Experiment apparatus behaviours (Phase 6B, `src/gameplay/experiment/behaviors.ts`) only publish
`ExperimentCommand { stationId, command }`; `StationSystem` decides and acts:

| Id                   | Actions                                          | Placement params                     |
| -------------------- | ------------------------------------------------ | ------------------------------------ |
| `launcher`           | Load into the launcher (held), Take the ball out | `experimentId`, `accepts` (item tag) |
| `pendulum`           | none (marks the pendulum stand as the station)   | `experimentId`                       |
| `drop-tower`         | none (marks the free-fall tower as the station)  | `experimentId`                       |
| `parameter-dial`     | Raise / Lower <symbol> (E / F)                   | `station`, `parameter`, `label`      |
| `experiment-control` | RUN, STOP or RESET                               | `station`, `command`, `label`        |
| `results-display`    | Read the results (opens the results panel)       | `station`                            |
| `instrument`         | none (a screen showing the station)              | `station`                            |

State-changing behaviours write through `EntityStates`, which persists the value in the save and
publishes `EntityStateChanged`; the renderer reacts (glow when `active`, a prop's hinged leaves swing when
`open`, `visual.stream` when `running` — its water falls in from the spout's mouth when turned on
and its tail falls away when turned off, in ~0.12 s; a save with it running shows it at once; the
look only, never saved — hidden when `taken`). While open, an openable object's
targeting box is its `visual.openBox`: the PPE cabinet's back, so the PPE inside can be reached
through its open doors; the cabinet itself never moves. An openable item with `hinged` leaves
(the cabinet, the washroom door; UX3.1) swings them in `swingS` (HingeSystem, eased; physics turns
each leaf's kinematic body; the renderer draws them alike): **Open** / **Close** are refused with
"Step back to open it." / "Step back to close it." while the whole swing would meet the player, and a
leaf that meets them mid-swing waits where it is until they step out of its way. A walk-through door
(UX3.1) is aimed at by its whole doorway: its leaf, the pocket it slides into, its jamb and header. `wear` changes the player's
`Equipment` (only PPE with `wornOn`, validated); `use` exists so procedures can name an action
("wash", "take-soap") on an object. Behaviours never call other systems directly.

### Add a behaviour

1. In `behaviors.ts`, define a `BehaviorDefinition`:
   - `id`, a Zod `params` schema for per-placement parameters,
   - optional `references(params)` listing scene/experiment/placement ids it points at
     (checked at boot; a placement must be in the same room),
   - `actionIds(params)` — every action id it can offer (procedures are validated against it),
   - optional `check(item)` — a content problem with the item that lists it, or null,
   - `createActions(context, params)` returning actions. Use `context.events`,
     `context.entityStates`, `context.hands` and `context.equipment`; nothing else.
2. Add it to `BUILT_IN_BEHAVIORS`.
3. Reference it from an item: `"interactions": ["my-behaviour"]`, with params on placements.
4. Test it through the real game (`bootTestGame`, `placePlayer`, `lookAt` in `src/game/testing.ts`).

The interaction system itself does not change.

## Input — `src/gameplay/player/InputState.ts`, `src/platform/BrowserInput.ts`

Gameplay reads device-independent actions (`moveForward`, `run`, `interact`, `toggleDebug`, …):
`isHeld`, `wasPressed` (this frame only) and an accumulated look delta. The browser adapter maps
`KeyboardEvent.code` through `config.input.bindings` and mouse movement under pointer lock.
The mouse is captured only while playing (in a world, not paused). The browser grants a lock some
time after it is asked for, so a lock that arrives after play stopped (Esc, or leaving, while the
request was pending) is given back at once: the menus keep the mouse (`e2e/pointer-lock.spec.ts`).
Losing window focus resets all keys. Game keys are ignored while a field that keeps the keys
has focus (text, a radio group, a select); a focused checkbox or button (the results' run list)
keeps the game keys working. Gamepad/VR would be new adapters writing the same `InputState`.

Controls: click the view to capture the mouse · WASD/arrows move · Shift run · E interact ·
F secondary action · LMB throw (while holding) · Esc pause · F3 debug panel (dev).
Only F is bound to `secondary` by default; a right-mouse binding (`Mouse2`) would need the
browser's context menu suppressed first.

**Pause** (`platform/ui/PauseMenu.ts`, Phase P1): Esc during play — or the mouse freed from the
scene, which is how a browser spends the Esc while the pointer is captured — opens the pause menu
and lets the mouse go, except while the results panel is open (freeing the mouse is then for its
run list). `Game.pause` sets `session.paused` (runtime only, never saved): every system is updated
with dt 0, so physics, experiment runs, procedure timers and movement stand still, game keys and
mouse buttons are ignored (F3 still works), and nothing completes. Resume (the button, a click on
the scene, or Esc on the menu) carries on from the next frame with its own dt — nothing is made up.
The menu offers Settings (the shared `SettingsPanel`, the same element as the main menu's; Esc or
Back returns to the pause menu) and Back to the main menu, which saves first (`Game.backToMenu`)
and, when a run still running would end unrecorded (ended runs stay in the run history) or the
save fails, asks first. Any
scene change ends a pause.

The pause menu is a dialog in the middle of the window (Phase P3.1) over the dimmed scene: the
title, a line saying the simulation stands still, Resume (the primary button), Settings, and Back
to the main menu set apart in a warm "caution" style (as is the leave button of the
confirmation). The dim takes no clicks, so a click on the scene around the dialog resumes. The
dialog scrolls inside a short window and fits 360 px without sideways scrolling; focus is drawn
with an outline and a halo, and under reduced motion the buttons change without transition.

## Line of sight

Targeting is a box scan (above) plus **one physics ray** per frame (`LineOfSight.castRay`,
implemented by the physics system): if a solid surface that does not belong to the best target is
hit in front of it, nothing is focused. So objects behind walls, behind the bench or behind any
collider — even one that is not interactable — cannot be targeted. The ray ignores the player's
own capsule and a held object. Without physics (menu) the check is skipped.

## Grab, hold, drop, throw (Phase 3)

The interaction system is also the player's **hands** (`Hands` in `behaviors.ts`): it owns what
is held. Physics executes the hold through the `ObjectHolder` port (`hold.ts`, implemented by
`PhysicsSystem`), so gameplay never moves bodies or meshes itself.

```
NotHolding ──E on "Grab" (grab behaviour → hands.grab → holder.grab)──► Holding
Holding ──E─────────────► release(drop,  velocity 0)            ──► NotHolding
Holding ──LMB (throwable)► release(throw, aim × impulse / mass)  ──► NotHolding
Holding ──scene change / object despawned / stuck > 0.5 s at > 1 m from the hold point──► NotHolding
```

- **Capability is data.** An item opts in with `"interactions": ["grab", …]`; content validation
  rejects `grab` on anything that is not `physical.body: "dynamic"`. `physical.throwable` allows
  throwing. The grab action is available only if the hands are free and the item's mass is at
  most `config.player.maxCarryMassKg` (15 kg) — the hook for a future strength system.
- **Grab distance** is the targeting reach, `config.player.reach` (2.2 m); it is not repeated
  anywhere else.
- **Holding.** Targeting only considers targets with an available `withHeld` action (the
  launcher, for a projectile ball); everything else, and the held object itself, is skipped. E
  performs that action if such a target is focused and drops otherwise; the throw input (left
  mouse button) throws if the item is throwable. `place()` releases the held object with reason
  `placed`, for the system that takes it (the launcher). The object follows the hold point,
  `config.player.holdDistance` (1 m) along the aim from the eye, with the aim's pitch clamped to ±50° for the hold point so a
  held object never ends up inside the player. How it follows (and why it cannot pass walls):
  [physics.md](physics.md#held-objects).
- **Drop** lets go with zero velocity: the object stays where it is, gravity and collisions take
  over, it does not return to its placement.
- **Throw** sets the velocity to the camera aim × `min(throwImpulse / mass, maxThrowSpeed)`
  (2.5 N·s, 12 m/s): the steel ball (0.25 kg) leaves at 10 m/s; heavier objects slower.
- **Events:** `ObjectGrabbed { entityId }`, `ObjectReleased { entityId, reason, velocity }` with
  reason `drop | throw | placed | scene-change | despawned | out-of-reach`. The HUD uses them
  for the prompt.
- **Scene transitions:** the hold is released on `SceneLoading`, before the old scene is torn
  down, so nothing ever references a destroyed body. Objects are not carried between scenes.
- **Saving** while holding is allowed and writes no hold state (held is runtime-only); dynamic
  object positions are not saved at all yet, so a held or moved object is back at its placement
  after Continue.

**Feedback:** looking at a target shows `[E] <primary>` and, if it has one, `[F] <secondary>`
with its name (the steel ball: `[E] Grab  [F] Inspect`); while holding the prompt is
`[E] Drop  [LMB] Throw` (Throw only if throwable) with "Holding: <name>"; the debug panel has a
`Holding:` line. Looking at the launcher with a ball in hand, the prompt is
`[E] Load into the launcher` with the launcher's name, or the reason it is refused.

## What the held object can act on, outlined (Phase A)

`game.heldTargets` (`gameplay/lab/HeldTargets.ts`) lists, while something is held, every object it
can act on now: an action "with held" available and not blocked (`InteractionSystem.usableTargets`:
fill, deliver, load…), a vessel it may pour into (`StationSystem.pourBlock`) and a seat it may be
set down on (`StationSystem.setDownBlock`, the seat's `accepts` tags). Those two are the rules' pure
halves: the set-down rule and `pourRefusal` call them and then commit or remember; the list only
asks. It is recomputed after an event that can change it, never per frame. The renderer outlines
those objects and the guided task step's (`render/outlines.ts`): a stencil mask and a pushed-out
shell per mesh, two draws each, at most 12 at once, on every preset (the renderer has a stencil
buffer for it). **T** opens the lab's guided tasks (`platform/ui/TaskPanel.ts`).

## Planned

Configuration panels and placing/rotating held objects precisely are later interaction work; NPC
dialogue will register NPCs through `register()`. Targets with more than two available actions
need an action wheel (only two keys exist). A per-room spatial index replaces the linear focus
scan when a scene holds thousands of interactables (marked `shortcut:` in the code).

## Inventory and hotbar (phase WX) — `src/gameplay/inventory/InventorySystem.ts`

The player carries items whose definition has `inventory` (see
[data-model.md](data-model.md#item)): 27 slots, 1–9 the hotbar, one stack per slot up to the
item's `stack`. `InventorySystem` is the only writer of `player.inventory`. The hotbar and panel
(`platform/ui/InventoryView.ts`) only read it and act through it.

| Input            | Effect                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q, holding       | Puts the held object away: out of the hands and out of the world, onto a stack of its item with room, else the lowest empty slot. Refused with a reason: not carriable, inventory full. |
| Q, hands free    | Takes the selected item out into the hands.                                                                                                                                             |
| 1–9, mouse wheel | Select a hotbar slot. The wheel steps one slot, wraps, and is left to the results panel while it is open.                                                                               |
| I                | Opens the panel (27 slots, details, the worn PPE read-only) and releases the mouse, without pausing.                                                                                    |
| I or Esc         | Closes the panel and recaptures the mouse.                                                                                                                                              |
| In the panel     | Click, Enter or Space picks up or puts down; Shift+Enter or a right click takes half a stack; merging and swapping are supported.                                                       |

**Taking out.** The item is rebuilt from its placement, with the same id, behaviours and entity
states. It is spawned on the player's capsule axis and grabbed in the same call. If it is not
clear of the capsule within 0.3 s, it goes back to its slot with "It cannot be taken out now.";
an item let go before that goes back the same way. It never pushes the player.

**Never in two places.** A carried instance is not spawned when its scene loads or is attached. It
crosses scenes with the player. Taken out and left in another scene, it is back at its placement
the next time its own scene loads.

PPE is worn, never stored. Nothing is put away or taken out while paused, loading or in the menu.

## The controls reference (phase UX1)

The main menu's **Controls** button opens a modal dialog (`platform/ui/ControlsPanel.ts`, a
native `<dialog>`: Esc, Close or a click outside closes it, and the focus returns to the button).
It lists the keys the bindings give (`config.input.bindings`), so a changed binding shows there too.
Esc and the mouse wheel are not bindings, so the panel names them itself. F3 is listed only in
development builds.

The groups:

- **Movement:** walk, run, look.
- **Interaction:** E, F, throw.
- **Inventory:** Q, 1–9, the wheel, I.
- **System:** Esc.
