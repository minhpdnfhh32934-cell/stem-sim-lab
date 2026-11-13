import { el, svg } from './dom';
import { EMBLEM } from './emblemShape';
import { emblem } from './menuArt';

/** The opening runs at least this long (ms), then ends once the game is ready. */
const MIN_MS = 3600;
const MIN_MS_STILL = 700;
/** Its fade into the menu, when the logo cannot fly there (ms); with reduced motion. */
const LEAVE_MS = 700;
const LEAVE_MS_STILL = 300;
/** The logo's flight into the menu's own emblem and name (ms), and its ease. */
const FLY_MS = 900;
const FLY_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The translation that, with `scale` about an element's top-left corner `box`, carries the point
 * `from` (on the element) onto `to` — a FLIP from where it is drawn to where the menu draws it.
 */
export const flipOffset = (box: Point, from: Point, to: Point, scale: number): Point => ({
  x: to.x - box.x - scale * (from.x - box.x),
  y: to.y - box.y - scale * (from.y - box.y),
});

/**
 * The app's own opening (2026-11-12, Phú: an opening animation that is SimLab's own), over the
 * page while the game loads: the emblem's rings come spinning in and settle into their orbits
 * (the dial, its ticks, the inner ring, the satellite), a ball flies in on a parabola and lands
 * on the trajectory's top — the measured flight the emblem draws — the strobe images light, the
 * letters of SIMLAB rise one by one with a light sweeping across, then the emblem and the name
 * fly to where the menu draws its own (Phú: slide over, seamless with the menu) while the dark
 * around them fades and the menu appears (a fade instead when the menu's are not on screen or the
 * window is narrow). A click, a tap or a key skips it (as soon as the game is ready) to that
 * flight; with reduced motion it is a short still and a cross-fade. No text but the name (it runs before the game's language is known). Automated
 * browsers (the tests) do not get it unless asked: `?intro=1`; `?intro=0` turns it off.
 */
export class AppIntro {
  private readonly root = el('div', 'app-intro');
  private readonly art = emblem();
  private readonly word = el('div', 'app-intro-word');
  private readonly started = performance.now();
  private ready = false;
  private skipped = false;
  private ending = false;
  /** The menu's own emblem and name, hidden while this one flies onto them. */
  private readonly covered: (HTMLElement | SVGElement)[] = [];
  private readonly skip = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
    this.skipped = true;
    this.maybeEnd();
  };

  constructor(parent: HTMLElement) {
    if (!AppIntro.wanted()) return;
    this.root.setAttribute('aria-hidden', 'true');
    const { art, word } = this;
    art.classList.remove('menu-emblem');
    art.classList.add('app-intro-emblem');
    art.append(...flight());
    ['S', 'I', 'M', 'L', 'A', 'B'].forEach((letter, i) => {
      const span = el('span', undefined, letter);
      span.style.setProperty('--i', String(i));
      word.append(span);
    });
    this.root.append(
      el('div', 'app-intro-back'),
      el('div', 'app-intro-ripple'),
      el('div', 'app-intro-ripple late'),
      art,
      word,
      el('div', 'app-intro-bar'),
    );
    parent.append(this.root);
    window.addEventListener('keydown', this.skip, true);
    this.root.addEventListener('pointerdown', this.skip);
  }

  /** Off for automated browsers unless asked for; the address can turn it on or off. */
  static wanted(): boolean {
    const asked = new URLSearchParams(location.search).get('intro');
    if (asked === '0') return false;
    if (asked === '1') return true;
    return !navigator.webdriver;
  }

  /** The game is ready: the opening ends when it has run its course (or was skipped). */
  done(): void {
    this.ready = true;
    this.root.classList.add('ready');
    this.maybeEnd();
  }

  /** The game could not start: the opening goes at once (the error is shown instead). */
  fail(): void {
    this.release();
    this.remove();
  }

  private maybeEnd(): void {
    if (!this.ready || this.ending || !this.root.isConnected) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const left = (still ? MIN_MS_STILL : MIN_MS) - (performance.now() - this.started);
    if (this.skipped || left <= 0) this.end();
    else window.setTimeout(() => this.maybeEnd(), left);
  }

  private end(): void {
    if (this.ending) return;
    this.ending = true;
    this.release();
    this.root.classList.add('leaving');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const fade = this.root.animate([{ opacity: 0 }], {
        duration: LEAVE_MS_STILL,
        fill: 'forwards',
      });
      this.leave(LEAVE_MS_STILL, [fade]);
    } else if (!this.fly()) {
      const fade = this.root.animate(
        [{ opacity: 0, transform: 'scale(1.08)', filter: 'blur(4px)' }],
        {
          duration: LEAVE_MS,
          easing: 'ease-in',
          fill: 'forwards',
        },
      );
      this.leave(LEAVE_MS, [fade]);
    }
  }

  /**
   * The emblem and the name fly onto the menu's (a FLIP: measured, then moved and scaled there),
   * the dark around them fading; false when the menu's are not where the flight could end.
   */
  private fly(): boolean {
    const brand = document.querySelector('.menu-brand');
    const emblemTo = brand?.querySelector<SVGSVGElement>('.menu-emblem');
    const title = brand?.querySelector<HTMLElement>('.menu-title');
    const titleText = title?.firstChild;
    const letter = this.word.firstElementChild?.firstChild;
    // Stacked (a narrow window): the brand is not beside the controls; the old fade there.
    const panel = brand?.parentElement;
    if (!emblemTo || !title || !titleText || !letter || !panel) return false;
    if (getComputedStyle(panel).flexDirection.startsWith('column')) return false;
    // A skip: the opening's own (finite) motions jump to their end, so what flies is the logo.
    if (this.skipped) {
      for (const motion of this.root.getAnimations({ subtree: true })) {
        const end = motion.effect?.getComputedTiming().endTime;
        if (typeof end === 'number' && Number.isFinite(end)) motion.finish();
      }
    }
    const artBox = this.art.getBoundingClientRect();
    const artTo = emblemTo.getBoundingClientRect();
    const wordBox = this.word.getBoundingClientRect();
    // The first letter's glyph (not its line box): both names' letters are spaced alike in em.
    const from = firstGlyph(letter);
    const to = firstGlyph(titleText);
    if (!onScreen(artTo) || !onScreen(to) || artBox.width <= 0 || from.height <= 0) return false;
    const wordScale =
      parseFloat(getComputedStyle(title).fontSize) /
      parseFloat(getComputedStyle(this.word).fontSize);
    if (!(wordScale > 0)) return false;

    const timing: KeyframeAnimationOptions = {
      duration: FLY_MS,
      easing: FLY_EASE,
      fill: 'forwards',
    };
    const move = (
      target: HTMLElement | SVGElement,
      box: DOMRect,
      at: DOMRect,
      dest: DOMRect,
      scale: number,
    ) => {
      const { x, y } = flipOffset(
        { x: box.left, y: box.top },
        { x: at.left, y: at.top },
        { x: dest.left, y: dest.top },
        scale,
      );
      target.style.transformOrigin = '0 0';
      return target.animate([{ transform: `translate(${x}px, ${y}px) scale(${scale})` }], timing);
    };
    syncMotion(this.art, emblemTo);
    this.covered.push(emblemTo, title);
    for (const element of this.covered) element.style.visibility = 'hidden';
    const flights = [
      move(this.art, artBox, artBox, artTo, artTo.width / artBox.width),
      move(this.word, wordBox, from, to, wordScale),
    ];
    for (const child of this.root.children) {
      if (child === this.art || child === this.word) continue;
      child.animate([{ opacity: 0 }], { ...timing, duration: FLY_MS * 0.7, easing: 'ease-out' });
    }
    this.leave(FLY_MS, flights);
    return true;
  }

  /** Removes the overlay when its last motion ends (or a little after, whatever happens). */
  private leave(ms: number, motions: Animation[]): void {
    void Promise.allSettled(motions.map((motion) => motion.finished)).then(() => this.remove());
    window.setTimeout(() => this.remove(), ms + 1000);
  }

  /** The menu's emblem and name back, in the same frame as the overlay goes: one logo always. */
  private remove(): void {
    for (const element of this.covered) element.style.visibility = '';
    this.covered.length = 0;
    this.root.remove();
  }

  private release(): void {
    window.removeEventListener('keydown', this.skip, true);
  }
}

/** The box of a text's first character as drawn (its glyph's em box, independent of line height). */
function firstGlyph(text: Node): DOMRect {
  const range = document.createRange();
  range.setStart(text, 0);
  range.setEnd(text, 1);
  return range.getBoundingClientRect();
}

/**
 * The menu's emblem takes up the opening's endless motions where they are (the satellite, the
 * strobe sweep, the dashes), so nothing jumps when the two swap: the same drawing, so the same
 * elements in the same order (the opening's flight is appended after them).
 */
function syncMotion(from: Element, to: Element): void {
  const sources = [...from.querySelectorAll('*')];
  const targets = [...to.querySelectorAll('*')];
  for (const motion of to.getAnimations({ subtree: true })) {
    if (!(motion instanceof CSSAnimation) || !(motion.effect instanceof KeyframeEffect)) continue;
    const source = sources[targets.indexOf(motion.effect.target as Element)];
    const twin = source
      ?.getAnimations()
      .find(
        (other) => other instanceof CSSAnimation && other.animationName === motion.animationName,
      );
    const time = twin?.currentTime;
    if (typeof time !== 'number' || !twin?.effect) continue;
    // Same phase: each one's time past its own delay.
    motion.currentTime =
      time - (twin.effect.getTiming().delay ?? 0) + (motion.effect.getTiming().delay ?? 0);
  }
}

const onScreen = (box: DOMRect) =>
  box.width > 0 &&
  box.height > 0 &&
  box.right > 0 &&
  box.bottom > 0 &&
  box.left < innerWidth &&
  box.top < innerHeight;

/**
 * The ball's flight into the emblem (in its view box, drawn past its edges): a long parabola from
 * off to the left, landing on the trajectory's top where the emblem's ball rests; its trail drawn
 * behind it.
 */
function flight(): SVGElement[] {
  const { ball, colors } = EMBLEM;
  const path = `M -360 300 Q -120 -240 ${ball.x} ${ball.y}`;
  const trail = svg('path', {
    d: path,
    class: 'app-intro-trail',
    stroke: colors.warm,
    'stroke-width': 3,
    'stroke-linecap': 'round',
    fill: 'none',
    pathLength: 1,
  });
  const comet = svg('g', { class: 'app-intro-comet' });
  comet.append(
    svg('circle', { r: ball.glow * 1.4, fill: colors.warm, 'fill-opacity': 0.25 }),
    svg('circle', { r: ball.r + 1, fill: '#fff4dc' }),
    svg('animateMotion', {
      path,
      dur: '1.15s',
      begin: '1.05s',
      fill: 'freeze',
      keyPoints: '0;1',
      keyTimes: '0;1',
      calcMode: 'spline',
      keySplines: '0.35 0 0.25 1',
    }),
  );
  return [trail, comet];
}
