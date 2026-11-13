import type { FrameClock } from '../../core/FrameClock';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { el } from './dom';
import { FrameMeter, frameLines } from './FrameMeter';

const REFRESH_S = 0.5;

/**
 * The F3 overlay of a production build (the developer panel is in development builds only): the
 * frame rate, frame times, the browser's display rate, the cap, the graphics preset and the GPU
 * drawing (FrameMeter). Hidden until F3; while hidden it only counts. Not translated (a debug
 * readout, like the developer panel).
 */
export class PerfOverlay implements GameSystem {
  readonly id = 'perf-overlay';
  private readonly root = el('div', 'debug perf hidden');
  private readonly text = el('pre', 'debug-text');
  private readonly meter: FrameMeter;

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    clock: FrameClock,
  ) {
    this.meter = new FrameMeter(clock, performance.now());
  }

  init(): void {
    this.root.setAttribute('aria-hidden', 'true');
    this.root.append(el('strong', undefined, 'SIMLAB (F3)'), this.text);
    this.parent.append(this.root);
  }

  update(): void {
    if (this.game.input.wasPressed('toggleDebug')) this.root.classList.toggle('hidden');
    if (!this.meter.sample(performance.now(), REFRESH_S)) return;
    if (this.root.classList.contains('hidden')) return;
    this.text.textContent = frameLines(
      this.meter.reading,
      this.game.frameCap,
      this.game.graphicsQuality,
      this.game.gpuName,
    ).join('\n');
  }

  dispose(): void {
    this.root.remove();
  }
}
