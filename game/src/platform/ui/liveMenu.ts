import type { Game } from '../../game/Game';
import { type Hour, hourAt } from '../wallpaper/cycle';
import { FRAMING } from '../wallpaper/framing';
import { defaults, TIME_ITEMS } from '../wallpaper/settings';
import type { Wallpaper } from '../wallpaper/Wallpaper';
import type { RocketSound } from '../audio/rocketSound';
import type { RocketOverlay } from './rocketIntro/rocketOverlay';
import type { IntroPhases } from './AppIntro';
import { el } from './dom';
import { type LiveLook, liveLook } from './liveLook';
import './liveMenu.css';
import './liveKit.css';

/*
 * The main menu over the live background (Phú 2026-11-18): the wallpaper — Linh and Khoa on the
 * roof, the city, the floating lab, the day into the night — drawn behind the menu, the menu laid
 * out round it. Its layout follows where the wheel has turned the view (the panel slides out and
 * slams back in where the picture leaves room), its style the scene's hour (day, evening, night:
 * colours crossfading), as `liveLook` says. Loaded only when chosen (its own chunk: three.js and
 * the wallpaper), and freed when the menu goes: entering the world gives the GPU back.
 *
 * Its building is heavy (a city, two people, a sky, a few hundred shaders: seconds of work), and
 * built while the app's opening played it froze the opening (Phú 2026-11-18). So the menu turns
 * live at once over a still of the scene as it starts (`public/menu/live-still.jpg`: the same
 * framing and hour), its entrance plays as the opening leaves, and only then is the scene built,
 * a step per frame, its shaders compiled off the page's thread; once it has drawn its first
 * frames it fades in over the still.
 */

const HOURS = ['live-day', 'live-dusk', 'live-night'] as const;
const VIEWS = ['live-back', 'live-front', 'live-side'] as const;
/** How long the panel takes to fly out before it comes back in its new place (ms). */
const SWAP_OUT_MS = 260;
/** How long an entrance plays before the panel may fly out again (ms): its buttons mostly in. */
const SETTLE_MS = 1350;
/** How long the entrance plays (ms): then its classes go, and hover and press take over. */
const ENTER_MS = 1500;
/** The scene's fade over the still (ms; liveMenu.css). */
const FADE_MS = 1200;
/** The still of the scene as it starts (made by `scripts/live-still.mjs`). */
const STILL = 'menu/live-still.jpg';
/** The rocket opening plays once, at the app's start (not each time the menu comes back). */
let prologueTaken = false;

export class LiveMenu {
  private readonly scene = el('div', 'menu-live-scene');
  private readonly still = el('div', 'menu-live-still');
  private readonly clock = el('div', 'menu-live-clock');
  private readonly clockText = el('span');
  private readonly hint = el('div', 'menu-live-hint');
  private readonly hintText = el('span');
  private readonly settings = defaults();
  private wallpaper: Wallpaper | null = null;
  private faded = false;
  private lookedAt = -Infinity;
  private atEnd = false;
  private look: LiveLook | null = null;
  /** The layout drawn, the one asked for, whether a move is on, the last entrance's start. */
  private layout: LiveLook['view'] = 'back';
  private wanted: LiveLook['view'] = 'back';
  private swapping = false;
  private enteredAt = -Infinity;
  private entrances = 0;
  private timers: number[] = [];
  private disposed = false;
  /**
   * The rocket opening (Phú 2026-11-18): played in the scene before the menu shows, its notes
   * over it (`RocketOverlay`), its roar; the menu comes in as it ends.
   */
  private prologue = false;
  private overlay: RocketOverlay | null = null;
  private sound: RocketSound | null = null;
  private entered = false;
  private makeOverlay: ((wallpaper: Wallpaper) => RocketOverlay | null) | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly game: Game,
    private readonly wheel: (event: WheelEvent) => boolean,
    private readonly opening: IntroPhases,
  ) {
    this.scene.setAttribute('aria-hidden', 'true');
    this.still.setAttribute('aria-hidden', 'true');
    this.still.style.backgroundImage = `url("${import.meta.env.BASE_URL}${STILL}")`;
    this.clock.setAttribute('aria-hidden', 'true');
    this.clock.append(this.clockText);
    this.hint.append(el('i', 'menu-live-mouse'), this.hintText);
    // Dev only: an hour held (`?liveTime=night`), to see each style without waiting the day.
    if (import.meta.env.DEV) {
      const held = new URLSearchParams(location.search).get('liveTime');
      const time = TIME_ITEMS.find((item) => item === held);
      if (time) this.settings.time = time;
    }
  }

  /**
   * The menu live at once, over the still; its entrance as the opening leaves; the scene built
   * once the opening has gone and the entrance has played, then faded in.
   */
  async start(): Promise<void> {
    if (this.opening.prologue && !prologueTaken) {
      prologueTaken = true;
      this.prologue = true;
    }
    // The opening's cover is over the page while its scene is built: no still needed.
    if (this.prologue) this.root.prepend(this.scene);
    else this.root.prepend(this.still, this.scene);
    this.root.append(this.clock, this.hint);
    this.root.addEventListener('input', this.onInput);
    this.root.addEventListener('click', this.onClick);
    this.follow();
    // The look of the scene's first moment (the still's): its hour, the framing, its clock.
    const first: Hour = { night: 0, elevation: 0, azimuth: 0, golden: 0, outfit: 0, clockS: 0 };
    hourAt(0, first);
    this.show(liveLook({ ...first, yaw: 0 }), false);
    document.body.classList.add('live-ui');
    this.root.classList.add('live', 'live-wait');
    this.paintRanges();
    if (this.prologue) {
      await this.build();
      return;
    }
    await this.opening.leaving;
    this.check();
    this.root.classList.remove('live-wait');
    this.enter();
    await this.opening.gone;
    await new Promise((resolve) => window.setTimeout(resolve, ENTER_MS));
    this.check();
    await this.build();
  }

  /** The scene built (and its opening, with its notes, when it plays), a step per frame. */
  private async build(): Promise<void> {
    // three.js and the scene's code loaded only now (loading them ran through the opening too).
    const { startWallpaper } = await import('../wallpaper/Wallpaper');
    if (this.prologue) {
      const [{ RocketOverlay }, { rocketNotes }, { playRocket }] = await Promise.all([
        import('./rocketIntro/rocketOverlay'),
        import('./rocketIntro/rocketNotes'),
        import('../audio/rocketSound'),
      ]);
      this.makeOverlay = (wallpaper) => {
        this.sound = playRocket();
        const swoop = wallpaper.swoop();
        const view = wallpaper.prologueView();
        if (!swoop || !view) return null;
        const notes = rocketNotes(
          this.game.texts,
          swoop.spec,
          swoop.stateAt(view.chemAt),
          swoop.stateAt(view.physAt),
          swoop.stateAt(view.bioAt),
        );
        return new RocketOverlay(notes, () => this.skipPrologue());
      };
    }
    this.check();
    const wallpaper = await startWallpaper(this.scene, {
      framing: FRAMING,
      size: null,
      frozen: null,
      mouse: null,
      hide: new Set(),
      settings: this.settings,
      lapAt: null,
      chatAt: null,
      orbit: null,
      wheel: this.wheel,
      prologue: this.prologue,
      // Dev only: the opening from a moment (`?prologueAt=12.5`), held there (`&prologueHold=1`).
      ...(import.meta.env.DEV && new URLSearchParams(location.search).has('prologueAt')
        ? {
            prologueAt: {
              t: Number(new URLSearchParams(location.search).get('prologueAt')) || 0,
              hold: new URLSearchParams(location.search).get('prologueHold') === '1',
            },
          }
        : {}),
      // A frame given back between the steps; stopped if the menu went meanwhile.
      yieldTo: () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())).then(() =>
          this.check(),
        ),
    });
    if (this.disposed) {
      wallpaper.dispose();
      return;
    }
    this.wallpaper = wallpaper;
  }

  /** Stops the building when the menu has gone (MainMenu ignores this error). */
  private check(): void {
    if (!this.disposed) return;
    const stop = new Error('The live menu was closed while it was being built');
    stop.name = 'LiveCancelled';
    throw stop;
  }

  /** Per frame: the game's own settings carried over, and the menu's look after the scene. */
  update(): void {
    const wallpaper = this.wallpaper;
    if (!wallpaper) return;
    this.follow();
    if (this.prologue) this.playPrologue(wallpaper);
    // Drawn its first frames: faded in over the still, which then goes.
    if (!this.faded && this.scene.dataset.ready === '1') {
      this.faded = true;
      this.scene.classList.add('shown');
      this.later(FADE_MS, () => this.still.remove());
    }
    // The look read ten times a second (it changes slowly; nothing made every frame).
    const now = performance.now();
    if (now - this.lookedAt < 100) return;
    this.lookedAt = now;
    const view = wallpaper.view();
    this.show(liveLook(view), view.yaw <= view.stop + 0.05);
  }

  /** The menu after the scene's look: its hour, its layout, its clock, the wheel's hint. */
  private show(look: LiveLook, atEnd: boolean): void {
    const was = this.look;
    const t = this.game.texts;
    if (look.hour !== was?.hour) {
      // On the menu, and on the body for the dialogs the menu opens there (and the palette).
      for (const node of [this.root, document.body]) {
        node.classList.remove(...HOURS);
        node.classList.add(`live-${look.hour}`);
      }
    }
    if (look.view !== was?.view) {
      if (!was) {
        this.layout = look.view;
        this.root.classList.add(`live-${look.view}`);
      } else this.swap(look.view);
    }
    if (look.clock !== was?.clock || look.part !== was.part) {
      const names = {
        morning: t.ui('menu.liveMorning', 'Morning'),
        afternoon: t.ui('menu.liveAfternoon', 'Afternoon'),
        evening: t.ui('menu.liveEvening', 'Evening'),
        night: t.ui('menu.liveNight', 'Night'),
      };
      this.clockText.textContent = `${names[look.part]} · ${look.clock}`;
    }
    // At the end of the turn, the way back.
    if (atEnd !== this.atEnd || !was) {
      this.atEnd = atEnd;
      this.hintText.textContent = atEnd
        ? t.ui('menu.liveScrollBack', 'Scroll up to turn back')
        : t.ui('menu.liveScroll', 'Scroll to turn the view');
    }
    this.look = look;
  }

  /**
   * The opening: the cover goes once the scene draws (a skip asked for meanwhile taken), its notes
   * and its roar while it plays, the menu's entrance as it ends.
   */
  private playPrologue(wallpaper: Wallpaper): void {
    if (this.entered) return;
    if (!this.overlay && this.scene.dataset.ready === '1') {
      this.faded = true;
      this.scene.classList.add('shown');
      if (this.opening.release()) wallpaper.skip();
      this.overlay = this.makeOverlay?.(wallpaper) ?? null;
      // (No opening in the scene after all: straight to the menu.)
      if (!this.overlay) this.prologue = false;
    }
    const view = wallpaper.prologueView();
    if (!this.overlay || !view) {
      if (!this.prologue) this.enterNow();
      return;
    }
    if (!view.done) {
      this.overlay.update(view, wallpaper);
      this.sound?.set(view.scale);
      return;
    }
    this.overlay.dispose();
    this.sound?.fade();
    this.enterNow();
  }

  /** The menu's entrance, once. */
  private enterNow(): void {
    if (this.entered) return;
    this.entered = true;
    this.root.classList.remove('live-wait');
    this.enter();
  }

  /** Straight to the menu: he is sat by her. */
  /** The player changed the volumes: the rocket's roar follows (0–100 each). */
  volume(master: number, effects: number, muted: boolean): void {
    this.sound?.volume(master, effects, muted);
  }

  private skipPrologue(): void {
    this.wallpaper?.skip();
  }

  dispose(): void {
    this.disposed = true;
    this.overlay?.dispose();
    this.overlay = null;
    this.sound?.fade();
    this.sound = null;
    for (const id of this.timers) window.clearTimeout(id);
    this.timers = [];
    this.wallpaper?.dispose();
    this.wallpaper = null;
    this.scene.remove();
    this.still.remove();
    this.clock.remove();
    this.hint.remove();
    this.root.classList.remove('live', 'live-wait', 'live-enter', 'live-swap', ...HOURS, ...VIEWS);
    document.body.classList.remove('live-ui', ...HOURS);
    this.root.removeEventListener('input', this.onInput);
    this.root.removeEventListener('click', this.onClick);
  }

  /**
   * Each slider's fill (liveKit.css draws it from --fill): set when one moves, and when a page
   * opens (a click) — never per frame.
   */
  private paintRanges(): void {
    for (const input of this.root.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const v = (Number(input.value) - min) / (max - min || 1);
      input.style.setProperty('--fill', `${Math.round(Math.min(1, Math.max(0, v)) * 1000) / 10}%`);
    }
  }

  private readonly onInput = (event: Event): void => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'range')
      this.paintRanges();
  };

  private readonly onClick = (): void => {
    requestAnimationFrame(() => this.paintRanges());
  };

  /**
   * The game's graphics carried to the scene: full size at every level that shows it (Low shows the
   * still picture: MainMenu); the former Medium drew it at 70 %, a level gone since 2026-11-18. The
   * frame cap is shared.
   */
  private follow(): void {
    this.settings.quality = 'high';
    this.settings.fps = this.game.frameCap;
  }

  /** The entrance: the title stamped on, the buttons sliding in one after another. */
  private enter(): void {
    this.root.classList.remove('live-enter');
    this.root.getBoundingClientRect(); // laid out: played again from its start
    this.root.classList.add('live-enter');
    this.enteredAt = performance.now();
    // Only this entrance's end takes its class off (an earlier one's timer had cut a later
    // entrance short: the buttons jumped into place).
    const entrance = ++this.entrances;
    this.later(ENTER_MS, () => {
      if (entrance === this.entrances) this.root.classList.remove('live-enter');
    });
  }

  /**
   * A new layout: the panel flies out, takes its new place, and comes back in. Turned on and on
   * (Phú 2026-11-18: the buttons jumped instead of moving): one move at a time, to the latest
   * layout asked for, after the last entrance has mostly landed; none if the view has come back.
   */
  private swap(view: LiveLook['view']): void {
    this.wanted = view;
    if (this.swapping) return;
    this.swapping = true;
    const wait = Math.max(0, SETTLE_MS - (performance.now() - this.enteredAt));
    this.later(wait, () => {
      if (this.wanted === this.layout) {
        this.swapping = false;
        return;
      }
      this.root.classList.remove('live-enter');
      this.root.classList.add('live-swap');
      this.later(SWAP_OUT_MS, () => {
        this.swapping = false;
        this.layout = this.wanted;
        this.root.classList.remove('live-swap', ...VIEWS);
        this.root.classList.add(`live-${this.layout}`);
        this.enter();
      });
    });
  }

  private later(ms: number, then: () => void): void {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      then();
    }, ms);
    this.timers.push(id);
  }
}
