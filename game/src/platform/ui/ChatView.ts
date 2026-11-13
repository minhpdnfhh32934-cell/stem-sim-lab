import './chat.css';
import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { CHAT_MAX } from '../../multiplayer/protocol';
import type { LanRooms } from '../net/LanRooms';
import { listen } from '../BrowserInput';
import { el } from './dom';

/** A line stays on screen this long (s) after it came, then fades (all show while typing). */
const SHOW_S = 10;
/** Lines kept (older ones are dropped). */
const KEEP = 50;

interface Line {
  readonly root: HTMLElement;
  left: number;
}

/**
 * The room's chat (Phú 2026-11-12, as in Minecraft): in a LAN room, Enter opens a line at the
 * bottom left (the mouse freed, the game going on), Enter sends it, Esc closes it. Lines said in
 * the room show there for a while, then fade; all of them while typing. What players write is
 * shown as text, never markup, and never translated.
 */
export class ChatView implements GameSystem {
  readonly id = 'chat-view';
  private readonly root = el('div', 'chat hidden');
  private readonly list = el('ol', 'chat-lines');
  private readonly entry = el('input', 'chat-entry');
  private readonly lines: Line[] = [];
  private readonly subscriptions = new Disposables();
  private open = false;

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly rooms: LanRooms,
    /** Another panel has the mouse: no chat opened over it. */
    private readonly panelHasMouse: () => boolean,
    private readonly capture: () => Promise<void>,
  ) {}

  /** The chat line is open and has the keys and the mouse (no pause for a freed mouse). */
  get shown(): boolean {
    return this.open;
  }

  init(): void {
    const { events, texts: t } = this.game;
    this.list.setAttribute('aria-live', 'polite');
    this.entry.type = 'text';
    this.entry.maxLength = CHAT_MAX;
    this.entry.autocomplete = 'off';
    this.entry.spellcheck = false;
    const label = () => {
      this.entry.placeholder = t.ui('chat.placeholder', 'Say something to the room…');
      this.entry.setAttribute('aria-label', t.ui('chat.label', 'Chat'));
    };
    label();
    this.entry.hidden = true;
    this.root.append(this.list, this.entry);
    this.parent.append(this.root);
    const s = this.subscriptions;
    s.add(events.subscribe('LanguageChanged', label));
    s.add(events.subscribe('ChatHeard', ({ name, text, own }) => this.add(name, text, own)));
    s.add(
      events.subscribe('RoomChanged', () => {
        if (this.game.peers.room) return;
        this.close(false);
        for (const line of this.lines.splice(0)) line.root.remove();
      }),
    );
    s.add(
      events.subscribe('SceneLoaded', ({ kind }) => {
        this.root.classList.toggle('hidden', kind === 'menu');
        if (kind === 'menu') this.close(false);
      }),
    );
    listen(s, document, 'keydown', (event) => this.key(event));
    // Typing: the line keeps every key (Esc too: no pause menu); Enter sends.
    this.entry.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close(true);
      } else if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        const text = this.entry.value.trim();
        if (text) this.rooms.chat(text);
        this.close(true);
      }
    });
    // A click on the scene takes the mouse back: the line closes, unsent.
    this.entry.addEventListener('blur', () => this.close(false));
  }

  update(dt: number): void {
    if (this.open) return;
    for (const line of this.lines) {
      if (line.left <= 0) continue;
      line.left -= dt;
      if (line.left <= 0) line.root.classList.add('faded');
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.root.remove();
  }

  private key(event: KeyboardEvent): void {
    if (this.open || event.repeat) return;
    if (!this.game.config.input.bindings.chat.includes(event.code)) return;
    const { phase, paused } = this.game.state.session;
    if (phase !== 'playing' || paused || !this.game.peers.room || this.panelHasMouse()) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    this.open = true;
    this.root.classList.add('open');
    this.entry.hidden = false;
    this.entry.value = '';
    if (document.pointerLockElement) document.exitPointerLock(); // the line needs the keys
    this.entry.focus();
    this.list.scrollTop = this.list.scrollHeight;
  }

  private close(capture: boolean): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('open');
    this.entry.hidden = true;
    this.entry.blur();
    this.list.scrollTop = this.list.scrollHeight;
    if (capture) this.capture().catch(() => undefined); // refused: the HUD says to click
  }

  private add(name: string, text: string, own: boolean): void {
    const root = el('li', own ? 'chat-line own' : 'chat-line');
    root.append(el('span', 'chat-name', `<${name}>`), ' ', el('span', 'chat-text', text));
    this.list.append(root);
    this.lines.push({ root, left: SHOW_S });
    while (this.lines.length > KEEP) this.lines.shift()?.root.remove();
    this.list.scrollTop = this.list.scrollHeight;
  }
}
