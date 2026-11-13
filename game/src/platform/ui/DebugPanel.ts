import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { shownResults } from '../../simulation/experiment';
import { totalUl } from '../../simulation/liquid';
import { clockText } from '../../world/clock';
import type { FrameClock } from '../../core/FrameClock';
import { PHONE_ITEM } from '../../gameplay/phone/PhoneSystem';
import { el } from './dom';
import { FrameMeter, frameLines } from './FrameMeter';

const REFRESH_S = 0.25; // text refresh rate; rebuilding DOM every frame would cost more than it shows

const deg = (rad: number) => Math.round((rad * 180) / Math.PI);
const fixed = (n: number) => n.toFixed(2);

/**
 * Developer overlay (development builds only, toggled with the `toggleDebug` binding, F3 by
 * default): game state, FPS, player, focus, systems, event counts, latest experiment, and a
 * scene jump tool.
 */
export class DebugPanel implements GameSystem {
  readonly id = 'debug-panel';
  private readonly root = el('div', 'debug');
  private readonly text = el('pre', 'debug-text');
  private readonly sceneSelect = el('select');
  /** The frame rate from the game's frame loop (FrameMeter), refreshed with the text. */
  private readonly meter: FrameMeter;

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly audio: { readonly status: string } | null,
    /** The renderer's rooms not drawn (RendererHost.roomsAsleep). */
    private readonly rooms: { readonly roomsAsleep: string; readonly shadowMaps: string } | null,
    /** The game's frame loop's clock: the frame rate it shows. */
    clock: FrameClock,
  ) {
    this.meter = new FrameMeter(clock, performance.now());
  }

  init(): void {
    const tools = el('div', 'debug-tools');
    for (const scene of this.game.content.scenes.all()) {
      if (scene.kind !== 'world') continue;
      const option = el('option', undefined, scene.id);
      option.value = scene.id;
      this.sceneSelect.append(option);
    }
    this.sceneSelect.setAttribute('aria-label', 'Scene to load');
    const go = el('button', undefined, 'Load scene');
    go.addEventListener('click', () => {
      if (this.game.state.session.phase !== 'playing') return; // needs a character
      this.game.events.publish('SceneChangeRequested', { sceneId: this.sceneSelect.value });
    });
    // A developer teleport, not a player transition: no door, no entry rules, the scene's spawn.
    go.title = 'Debug jump: arrives at the scene spawn and bypasses doors and entry rules';
    tools.append(this.sceneSelect, go);
    this.root.append(el('strong', undefined, 'SIMLAB DEBUG (F3)'), this.text, tools);
    this.parent.append(this.root);
    // Hidden at start (Phú 2026-11-12): F3 shows it, ?debug=1 starts with it. A test browser on a
    // computer starts with it too: the e2e tests read the game's state from it.
    const touch = document.documentElement.dataset.device !== 'computer';
    const flag = new URLSearchParams(location.search).get('debug');
    const asked = flag !== null && flag !== '0';
    if (!asked && (touch || !navigator.webdriver)) this.root.classList.add('hidden');
  }

  update(): void {
    if (this.game.input.wasPressed('toggleDebug')) this.root.classList.toggle('hidden');
    // Real time, not game time: it keeps telling the state while paused (dt 0).
    if (!this.meter.sample(performance.now(), REFRESH_S)) return;
    if (!this.root.classList.contains('hidden')) this.text.textContent = this.describe();
  }

  dispose(): void {
    this.root.remove();
  }

  /** Load status, world counts, step cost and up to four dynamic bodies (held/focused first). */
  private physicsLines(physics: Game['physics']): string[] {
    const stats = physics.stats();
    const head = stats.active
      ? `ready · bodies ${stats.bodies} · colliders ${stats.colliders} · ${stats.stepMs.toFixed(3)} ms/step · loaded in ${(stats.loadMs ?? 0).toFixed(0)} ms`
      : stats.status === 'idle'
        ? 'idle (Rapier not loaded)'
        : stats.status;
    const focused = this.game.interaction.heldId ?? this.game.interaction.focused?.id;
    const ids = physics
      .dynamicBodyIds()
      .sort((a, b) => Number(b === focused) - Number(a === focused));
    // In the current scene's own coordinates, as Position.
    const [ox, oy, oz] = this.game.scenes.origin;
    const bodies = ids.slice(0, 4).map((id) => {
      const b = physics.body(id);
      if (!b) return `  ${id}`;
      if (b.driven) return `  ${id}  driven (its pose is set by an experiment)`;
      const [x, y, z] = b.position;
      return `  ${id}  ${(x - ox).toFixed(3)}, ${(y - oy).toFixed(3)}, ${(z - oz).toFixed(3)} m  ${b.speed.toFixed(2)} m/s${b.sleeping ? '  asleep' : ''}`;
    });
    return [`Physics:      ${head}`, ...(bodies.length > 0 ? ['Dynamic:', ...bodies] : [])];
  }

  /**
   * The station in the player's room (else the scene's first): state, parameters, the run's time
   * and the live value of its first measurement, the results once completed, checklist position.
   */
  private stationText(): string {
    const view = this.game.stations.activeStation();
    if (!view) return '—';
    const { session, definition } = view;
    const params = definition.parameters
      .map((p) => `${p.id}=${session.parameters[p.id] ?? '?'}`)
      .join(' ');
    const run = session.run;
    const live = definition.measurements[0];
    const runText = run
      ? ` ${run.runId} t=${run.time.toFixed(3)}` +
        (live ? ` ${live.id}=${run.value(live.variable).toFixed(3)}` : '')
      : '';
    const results =
      run?.status === 'completed'
        ? shownResults(definition) // an answer the student works out stays off, here too
            .map((r) => ` ${r.id}=${(run.results?.[r.id] ?? NaN).toFixed(3)}`)
            .join('')
        : '';
    return `${view.id} ${session.state} ${params}${runText}${results} step ${view.next}/${view.checklist.length}`;
  }

  /**
   * Physical-lab containers: volumes only, in µL by material id (what the bookkeeping holds, never
   * a concentration or a model value, so no hidden input can show here), the held and focused ones
   * first, then those of the station the player is at (its own placement order), up to six: the
   * e2e specs read the bench they work at.
   */
  private containerLines(): string[] {
    const { state, interaction, world, stations } = this.game;
    const first = interaction.heldId ?? interaction.focused?.id;
    const here = stations.activeStation()?.id;
    const rank = (id: string) => {
      if (id === first) return 0;
      const e = world.entity(id);
      const named = typeof e?.params.station === 'string' ? `${e.roomId}/${e.params.station}` : id;
      return named === here ? 1 : 2;
    };
    const ids = Object.keys(state.world.containers).sort((a, b) => rank(a) - rank(b));
    if (ids.length === 0) return [];
    const lines = ids.slice(0, 6).map((id) => {
      const c = state.world.containers[id];
      if (!c) return `  ${id}`;
      const parts = Object.entries(c.contents)
        .map(([material, ul]) => `${material} ${ul}`)
        .join(', ');
      return `  ${id}  ${totalUl(c.contents)} µL${parts ? ` (${parts})` : ''}${c.closed ? '  closed' : ''}${c.mixed ? '  mixed' : ''}`;
    });
    const more = ids.length > 6 ? [`  … ${ids.length - 6} more`] : [];
    return ['Containers:', ...lines, ...more];
  }

  /** Active procedure: id, status, step n/total, next step id and a running timer. */
  /** The guided task (Phase A): its step, the floor path's turns and length, what is outlined. */
  private taskLines(): string[] {
    const { tasks, taskGuide, heldTargets } = this.game;
    const active = tasks.active;
    const path = taskGuide.path;
    let length = 0;
    for (let i = 2; i + 1 < path.length; i += 2) {
      length += Math.hypot(
        (path[i] ?? 0) - (path[i - 2] ?? 0),
        (path[i + 1] ?? 0) - (path[i - 1] ?? 0),
      );
    }
    const step = active
      ? `${active.task.id} step ${active.index + 1}/${active.task.steps.length} ${active.step.id}`
      : '—';
    return [
      `Task:         ${step}`,
      `Guide:        ${path.length / 2} points, ${length.toFixed(2)} m · ${taskGuide.objects.join(', ') || '—'}`,
      `Outlined:     ${heldTargets.ids.join(', ') || '—'}`,
      `Circuit:      ${this.circuitText()}`,
      `Fire:         ${this.fireText()}`,
      `Phone:        ${this.phoneText()}`,
    ];
  }

  /** Each circuit board: parts, leads, the supply's output, what the aim is on. */
  private circuitText(): string {
    const lines: string[] = [];
    for (const board of this.game.circuits.all()) {
      const s = this.game.circuits.supply(board);
      const aim = board.aim ? JSON.stringify(board.aim) : '—';
      lines.push(
        `${board.state.parts.length} parts ${board.state.wires.length} leads · ${s.volts.toFixed(2)} V ${s.amps.toFixed(3)} A${s.limited ? ' CC' : ''} · aim ${aim}`,
      );
    }
    return lines.join(' | ') || '—';
  }

  /** The phone: out or away, what is dialled, the call. */
  private phoneText(): string {
    const p = this.game.phone;
    const call = p.call.state === 'talking' ? `talking ${p.call.outcome}` : p.call.state;
    return `${p.out ? 'out' : 'away'} ${p.number || '—'} ${call}`;
  }

  /** Each fire (its object and size), the jet, the brigade coming. */
  private fireText(): string {
    const f = this.game.fires;
    const fires = f.list.map((x) => `${x.entityId} ${x.size.toFixed(2)}`).join(', ') || '—';
    const brigade = f.brigadeIn === null ? '' : ` · brigade in ${Math.ceil(f.brigadeIn)} s`;
    return `${fires}${f.spraying ? ' · spraying' : ''}${brigade}`;
  }

  private procedureText(): string {
    const procedures = this.game.procedures;
    const active = procedures.activeProcedure();
    if (!active) return '—';
    const v = procedures.view(active.id);
    const timer = v.timer ? ` timer ${v.timer.elapsed.toFixed(1)}/${v.timer.duration} s` : '';
    return `${active.id} ${v.status} ${v.completed}/${v.total} next ${v.step?.id ?? '—'}${timer}`;
  }

  /** Pairs that are not closed: the first leaf, the state and each leaf's opening fraction. */
  /** The action acted out playing (Phase H-3): its sequence, seconds in of its seconds; or —. */
  /** The test papers (Phase Y-5): each one's id, answered of its questions, its mark; the one up. */
  private papersText(): string {
    const { papers } = this.game;
    const list = papers.papers.map((p) => {
      const done = p.answers.filter((a) =>
        Array.isArray(a) ? a.some((m) => m !== null) : a !== null,
      ).length;
      return `${p.id} ${done}/${p.items.length}${p.marked ? ` mark ${p.marked.score}` : ''}`;
    });
    const up = papers.reading ? ` · up ${papers.reading.id}` : '';
    return `${list.join(' · ') || '—'}${up} · scores ${this.game.state.progression.scores.length}`;
  }

  /** The conversation going on (Phase Y): with whom, what shows, which line; the teacher's walk. */
  /** The LAN room (Phase M): its ID and count, and each other player's scene and place. */
  private playersText(): string {
    const { room, players } = this.game.peers;
    if (!room) return '—';
    const each = players.map((p) => {
      // What the others see of them (Phase F-3): worn, held, resting, acting.
      const t = p.target;
      const extra = [
        t?.gear?.length ? `wears ${t.gear.join('+')}` : '',
        t?.held ? `holds ${t.held}` : '',
        t?.rest ? `rest ${t.rest}` : '',
        t?.act ? `act ${t.act}` : '',
        t?.doing ? `doing ${t.doing}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `${p.name} ${p.sceneId ?? '—'} ${fixed(p.x)}, ${fixed(p.z)}${extra ? ` ${extra}` : ''}`;
    });
    return [`${room.id} ${room.players}/${room.max}`, ...each].join(' · ');
  }

  private talkText(): string {
    const open = this.game.state.session.conversation ?? null;
    const people = this.game.npcs.views
      .map(
        (v) =>
          `${v.npc.id} ${this.game.npcs.mode(v.npc.id) ?? '?'} ${v.sceneId} ` +
          `${v.x.toFixed(2)}, ${v.z.toFixed(2)} ${v.gesture}${v.point ? ` → ${v.point}` : ''}` +
          (v.card ? ' card' : ''),
      )
      .join('; ');
    // The board written on (Y-3): its lines written whole, of all.
    const { board } = this.game.npcs;
    const whole = board.lines.filter((line, i) => (board.shown[i] ?? 0) >= line.length).length;
    const written = board.boardId ? ` · board ${board.boardId} ${whole}/${board.lines.length}` : '';
    return `${open ? `${open.npcId} ${open.stage} #${open.line}` : '—'} · ${people || 'nobody'}${written}`;
  }

  private actionText(): string {
    const a = this.game.actions.current;
    return a ? `${a.sequence.id} ${a.t.toFixed(1)}/${a.sequence.seconds} s` : '—';
  }

  private doorsText(): string {
    const { doors } = this.game;
    const f = (id: string) => doors.fraction(id).toFixed(2);
    const open = doors.pairIds
      .filter(([id]) => doors.state(id) !== 'closed')
      .map(([id, other]) => `${id} ${doors.state(id) ?? '?'} ${f(id)} ${f(other)}`);
    return open.join(', ') || '—';
  }

  private describe(): string {
    const { state, world, interaction, events, experiments, systems, physics, scenes } = this.game;
    const p = state.player;
    // Position: in the current scene's own coordinates; Campus: in the campus frame, which goes
    // on through a walk into a neighbour scene in both directions.
    const [ox, oy, oz] = scenes.origin;
    const [cx, cy, cz] = scenes.campusOffset;
    const run = experiments.latest?.run;
    const runText = run
      ? `${run.runId} ${run.definition.id} ${run.status}${run.endReason ? ` (${run.endReason})` : ''} t=${run.time.toFixed(3)} s`
      : '—';
    return [
      `Phase:        ${state.session.phase}${state.session.paused ? ' · paused' : ''}`,
      `Scene:        ${state.session.sceneId ?? '—'}`,
      ...frameLines(
        this.meter.reading,
        this.game.frameCap,
        this.game.graphicsQuality,
        this.game.gpuName,
      ),
      `Character:    ${p.characterId ?? '—'}`,
      `Position:     ${fixed(p.position[0] - ox)}, ${fixed(p.position[1] - oy)}, ${fixed(p.position[2] - oz)} m`,
      // To the millimetre, for aiming at a 15 mm capture radius from a test (e2e/physical-lab).
      `Position mm:  ${(p.position[0] - ox).toFixed(3)}, ${(p.position[1] - oy).toFixed(3)}, ${(p.position[2] - oz).toFixed(3)} m`,
      `Campus:      ${fixed(p.position[0] + cx)}, ${fixed(p.position[1] + cy)}, ${fixed(p.position[2] + cz)} m`,
      `Look:         yaw ${deg(p.yaw)}°  pitch ${deg(p.pitch)}°`,
      `Room:         ${p.roomId ?? '—'}  ${p.grounded ? 'grounded' : 'airborne'}`,
      `Clock:        ${clockText(state.world.clockS)}`,
      `Resident:     ${scenes.residentIds.join(', ') || '—'}`,
      `Asleep:       ${this.rooms?.roomsAsleep ?? '—'}`,
      `Shadow maps:  ${this.rooms?.shadowMaps ?? '—'}`,
      `Doors:        ${this.doorsText()}`,
      `Focus:        ${interaction.focused?.id ?? '—'}`,
      `Holding:      ${interaction.heldId ?? '—'}`,
      `Action:       ${this.actionText()}`,
      `Talk:         ${this.talkText()}`,
      `Papers:       ${this.papersText()}`,
      `Players:      ${this.playersText()}`,
      `Device:       ${document.documentElement.dataset.device ?? '—'} · look ${this.game.controls.lookSensitivity}× · tilt ${this.game.controls.tiltLook ? 'on' : 'off'}`,
      `Sound:        ${this.audio?.status ?? '—'}`,
      ...this.containerLines(),
      // Item ids by slot (#1 is hotbar key 1), never entity ids.
      `Inventory:    ${
        this.game.inventory.stacks
          // The phone is always carried (E-2b): its own Phone line.
          .filter((s) => s.item !== PHONE_ITEM)
          .map((s) => `#${s.slot + 1} ${s.item}×${s.placements.length}`)
          .join(' · ') || '—'
      } · selected #${this.game.inventory.selected + 1}`,
      `Entities:   ${world.entityCount}  interactables: ${interaction.count}`,
      ...this.physicsLines(physics),
      `Events:       ${events.publishedCount} published, ${events.listenerCount()} listeners`,
      `Experiment:   ${runText}`,
      `Completed:    ${state.progression.completedExperiments.join(', ') || '—'}`,
      `Equipment:    ${this.game.equipment.worn.join(', ') || '—'}`,
      `Station:      ${this.stationText()}`,
      `Procedure:    ${this.procedureText()}`,
      ...this.taskLines(),
      `Systems:      ${systems
        .statuses()
        .map((s) => `${s.id}${s.status === 'active' ? '' : `[${s.status}]`}`)
        .join(' ')}`,
    ].join('\n');
  }
}
