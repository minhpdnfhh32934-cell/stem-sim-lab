import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { el } from './dom';
import { formulaNodes } from './formulaHtml';
import { Speech } from './speech';

/** Heard from this far (m) in the same scene; the voice fades out towards it. */
const HEAR_M = 12;
/** A line stays on screen at least this long (s), longer for a long one. */
const SHOW_S = 4;
const READ_CPS = 14;

/**
 * What a person of the world says to another player of the room, heard here (Phase F-3, Phú: who
 * comes near hears the teacher teaching someone else): the line under the screen with whom he is
 * talking to, read aloud at a volume that falls with the distance. Nothing out of earshot, nothing
 * while this player has their own conversation.
 */
export class OverheardView implements GameSystem {
  readonly id = 'overheard-view';
  private readonly root = el('div', 'overheard');
  private readonly who = el('div', 'overheard-who');
  private readonly text = el('div', 'overheard-text');
  private readonly speech = new Speech();
  private readonly subscriptions = new Disposables();
  private left = 0;

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
  ) {}

  init(): void {
    this.root.setAttribute('aria-live', 'polite');
    this.root.hidden = true;
    this.root.append(this.who, this.text);
    this.parent.append(this.root);
    this.subscriptions.add(
      this.game.events.subscribe('NpcHeard', ({ npcId, text, with: name }) =>
        this.heard(npcId, text, name),
      ),
    );
  }

  update(dt: number): void {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left <= 0) this.root.hidden = true;
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.speech.stop();
    this.root.remove();
  }

  private heard(npcId: string, line: string, name: string): void {
    const { game } = this;
    if (game.npcs.conversation) return;
    const view = game.npcs.view(npcId);
    const offset = view ? game.scenes.offsetOf(view.sceneId) : null;
    if (!view || !offset || view.sceneId !== game.state.session.sceneId) return;
    const p = game.state.player.position;
    const distance = Math.hypot(view.x + offset[0] - p[0], view.z + offset[2] - p[2]);
    if (distance > HEAR_M) return;
    const texts = game.texts;
    this.who.textContent = texts.ui('npc.overheard', '{teacher}, to {name}', {
      teacher: texts.of(view.npc, 'title'),
      name,
    });
    this.text.replaceChildren(...formulaNodes(line, game.language));
    this.root.hidden = false;
    this.left = Math.max(SHOW_S, line.length / READ_CPS);
    const { volumes, muted, language } = game;
    const near = 1 - Math.max(0, distance - 2) / (HEAR_M - 2);
    const volume = muted ? 0 : (volumes.master / 100) * (volumes.voice / 100) * near;
    this.speech.speak(line, language, volume, () => undefined);
  }
}
