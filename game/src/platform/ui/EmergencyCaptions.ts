import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { el } from './dom';
import { Speech } from './speech';

/** Heard from this far (m): they shout. The voice fades out towards it. */
const HEAR_M = 30;
/** The blast's white flash reaches this far (m), fading with the distance. */
const FLASH_M = 45;

/**
 * The emergency squad's lines (Phú 2026-11-13: the firefighters, the police, the teacher answering
 * them) under the screen — who, then what — read aloud at a volume that falls with the distance;
 * and the screen flashing white when the ceiling is blown open near the player. Reads
 * `game.emergency` only.
 */
export class EmergencyCaptions implements GameSystem {
  readonly id = 'emergency-captions';
  private readonly root = el('div', 'emergency-caption');
  private readonly who = el('div', 'emergency-caption-who');
  private readonly text = el('div', 'emergency-caption-text');
  private readonly flash = el('div', 'emergency-flash');
  private readonly speech = new Speech();
  private shown = 0;
  private flashed = false;

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
  ) {}

  init(): void {
    this.root.setAttribute('aria-live', 'polite');
    this.root.hidden = true;
    this.root.append(this.who, this.text);
    this.parent.append(this.flash, this.root);
  }

  update(): void {
    const e = this.game.emergency;
    const line = e.line;
    if (!line) {
      if (!this.root.hidden) this.root.hidden = true;
    } else if (line.n !== this.shown) {
      this.shown = line.n;
      this.say(line.who, line.text, line.sceneId, line.x, line.z);
    }
    // The blast: once per call, the screen white for a moment.
    if (e.blast >= 0 && e.blast < 0.3 && !this.flashed) {
      this.flashed = true;
      const near = this.near(e.squad?.arrival.scene ?? '', ...(e.squad?.arrival.at ?? [0, 0]));
      if (near < FLASH_M) {
        this.flash.style.setProperty('--strength', String(1 - (near / FLASH_M) * 0.7));
        this.flash.classList.remove('on');
        requestAnimationFrame(() => this.flash.classList.add('on'));
      }
    }
    if (e.blast < 0) this.flashed = false;
  }

  dispose(): void {
    this.speech.stop();
    this.root.remove();
    this.flash.remove();
  }

  private say(who: string, text: string, sceneId: string, x: number, z: number): void {
    const distance = this.near(sceneId, x, z);
    if (distance > HEAR_M) return;
    const squad = this.game.emergency.squad;
    this.root.dataset.squad = squad?.behavior ?? '';
    // The teacher answering them is not one of the squad: no squad colour.
    this.root.dataset.speaker =
      squad && who === this.game.texts.of(squad, 'title') ? 'squad' : 'person';
    this.who.textContent = who;
    this.text.textContent = text;
    this.root.hidden = false;
    const { volumes, muted, language } = this.game;
    const near = 1 - Math.max(0, distance - 3) / (HEAR_M - 3);
    const volume = muted ? 0 : (volumes.master / 100) * (volumes.voice / 100) * near;
    this.speech.speak(text, language, volume, () => undefined);
  }

  /** How far the player is from (x, z) of `sceneId` (m); far when that scene is not here. */
  private near(sceneId: string, x: number, z: number): number {
    const offset = this.game.scenes.offsetOf(sceneId);
    if (!offset) return Infinity;
    const p = this.game.state.player.position;
    return Math.hypot(x + offset[0] - p[0], z + offset[2] - p[2]);
  }
}
