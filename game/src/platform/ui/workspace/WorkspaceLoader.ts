import { Disposables } from '../../../core/EventBus';
import { describeError, type GameSystem } from '../../../core/SystemRunner';
import type { Game } from '../../../game/Game';
import { listen } from '../../BrowserInput';
import type { WorkspaceHost } from './WorkspaceHost';

/**
 * The part of the workspace the menu ships: it hears `WorkspaceOpened`, frees the mouse, loads
 * the host (a chunk of its own, with the first world scene, like the results panel) and hands it
 * the station. While a workspace is open it owns the keyboard — no game key, no pause — and Esc
 * closes the innermost layer, then the workspace; the mouse is taken back for looking when it
 * closes. `shown` tells the pause menu the mouse is freed for a panel, not for a pause.
 */
export class WorkspaceLoader implements GameSystem {
  readonly id = 'workspace-ui';
  private host: WorkspaceHost | null = null;
  private load: Promise<WorkspaceHost | null> | null = null;
  private opened = false;
  private readonly subscriptions = new Disposables();

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    /** Takes the mouse back for looking (as after a click on the scene). */
    private readonly capture: () => Promise<void>,
  ) {}

  /** Whether a workspace is open (or opening): it has the mouse, so freeing it is not a pause. */
  get shown(): boolean {
    return this.opened;
  }

  init(): void {
    const { events } = this.game;
    const s = this.subscriptions;
    // Downloaded with the first world scene; a failure is logged and tried again when needed.
    s.add(this.game.addWorldPreparation(() => this.loadHost().then(() => undefined)));
    s.add(events.subscribe('WorkspaceOpened', ({ stationId }) => this.open(stationId)));
    s.add(events.subscribe('WorkspaceClosed', () => this.close()));
    // On the document: it hears keys before BrowserInput and the pause menu (on the window).
    listen(s, document, 'keydown', (event) => this.key(event));
    // A grant of the mouse asked for before the workspace opened is given back: it needs it.
    listen(s, document, 'pointerlockchange', () => {
      if (this.opened && document.pointerLockElement) document.exitPointerLock();
    });
  }

  update(dt: number): void {
    this.host?.update(dt);
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.host?.close();
    this.host?.root.remove();
  }

  private loadHost(): Promise<WorkspaceHost | null> {
    this.load ??= import('./WorkspaceHost').then(
      ({ WorkspaceHost }) => (this.host = new WorkspaceHost(this.game, this.parent)),
      (error: unknown) => {
        this.load = null;
        this.game.log.warn(`The workspace could not be loaded: ${describeError(error)}`);
        return null;
      },
    );
    return this.load;
  }

  private open(stationId: string): void {
    const { game } = this;
    this.opened = true; // first: the pause menu then lets the mouse go without pausing
    game.input.reset(); // a key held now (W) does not go on walking
    if (document.pointerLockElement) document.exitPointerLock();
    void this.loadHost().then((host) => {
      if (!this.opened || game.workspace.openStation !== stationId) return; // closed meanwhile
      if (host?.open(stationId)) return;
      game.workspace.close();
      game.events.publish('ActionBlocked', {
        entityId: stationId,
        actionId: 'open-workspace',
        reason: game.texts.ui('workspace.failed', 'The workspace could not be opened.'),
      });
    });
  }

  private close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.host?.close();
    this.capture().catch(() => undefined); // refused: the HUD says to click the scene
  }

  /** While open, the workspace has the keyboard, but for the developer panel's key. */
  private key(event: KeyboardEvent): void {
    if (!this.opened) return;
    if (this.game.config.input.bindings.toggleDebug.includes(event.code)) return;
    event.stopPropagation(); // no game key, no pause
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (event.repeat) return;
    if (this.host?.stationId) this.host.escape();
    else this.game.workspace.close(); // still loading
  }
}
