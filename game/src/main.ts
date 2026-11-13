import './platform/ui/styles.css';
import { FrameClock } from './core/FrameClock';
import { AudioLoader } from './platform/audio/AudioLoader';
import { BootError, Game } from './game/Game';
import { BrowserInput } from './platform/BrowserInput';
import { AppIntro } from './platform/ui/AppIntro';
import { detectDevice } from './platform/device';
import { GamepadInput } from './platform/gamepad';
import { TiltLook } from './platform/tilt';
import { ControlSettings } from './platform/ui/ControlSettings';
import { RendererHost } from './platform/render/RendererHost';
import { createRunHistoryDb } from './platform/runHistoryDb';
import { createBrowserStorage } from './platform/storage';
import { DebugPanel } from './platform/ui/DebugPanel';
import { PerfOverlay } from './platform/ui/PerfOverlay';
import { el } from './platform/ui/dom';
import { Hud } from './platform/ui/Hud';
import { InventoryView } from './platform/ui/InventoryView';
import { LaptopView } from './platform/ui/LaptopView';
import { OverheardView } from './platform/ui/OverheardView';
import { TaskPanel } from './platform/ui/TaskPanel';
import { TouchControls } from './platform/ui/TouchControls';
import { DialogueView } from './platform/ui/DialogueView';
import { ExplainView } from './platform/ui/ExplainView';
import { PaperView } from './platform/ui/PaperView';
import { TestSetupView } from './platform/ui/TestSetupView';
import { MainMenu } from './platform/ui/MainMenu';
import { PauseMenu } from './platform/ui/PauseMenu';
import { SettingsPanel } from './platform/ui/settings';
import { WorkspaceLoader } from './platform/ui/workspace/WorkspaceLoader';
import { LanRooms } from './platform/net/LanRooms';
import { VoiceChat } from './platform/net/VoiceChat';
import { ChatView } from './platform/ui/ChatView';

/** Longest frame step; after a stall (tab hidden, breakpoint) the game slows instead of jumping. */
const MAX_FRAME_S = 0.1;

async function start(app: HTMLElement): Promise<void> {
  // A computer plays with keyboard and mouse; a phone or tablet gets touch controls (2026-11-12).
  const device = detectDevice();
  document.documentElement.dataset.device = device;
  const viewport = el('div', 'viewport');
  // The page's one canvas: the renderer draws on it; it goes with the page (or the error screen).
  const canvas = el('canvas');
  viewport.append(canvas);
  app.append(viewport);
  const { storage, persistent } = createBrowserStorage();
  // One loop; the frame-rate cap (Settings) only skips display frames, see FrameClock. Made
  // before the game: the F3 overlay reads its frame rate from it.
  const clock = new FrameClock(performance.now(), MAX_FRAME_S);

  const game = await Game.boot({
    storage,
    // A neighbour scene comes in a few placements a frame, its door still shut (SceneManager):
    // a frame between slices (back-to-back timers ran several slices in one frame).
    pause: () => new Promise((done) => requestAnimationFrame(() => done())),
    history: createRunHistoryDb(),
    config: {
      debug: { enabled: import.meta.env.DEV, logLevel: import.meta.env.DEV ? 'debug' : 'info' },
    },
    platformSystems: (g) => {
      const input = new BrowserInput(viewport, g, device !== 'computer');
      const enterWorld = () => {
        input.lockPointer().catch(() => undefined); // may need a fresh click; the HUD says so
      };
      const hud = new Hud(app, g, viewport);
      // After the HUD: the hotbar and the inventory panel paint over it and the results.
      const inventory = new InventoryView(app, g, viewport, () => input.lockPointer());
      // The hub's laptop (Phase F-2): its start-up, desktop and books, over the game.
      const laptop = new LaptopView(app, g, viewport, () => input.lockPointer());
      // The guided tasks, on the right: after the HUD, whose objective docks beside it.
      const tasks = new TaskPanel(app, g, viewport, () => input.lockPointer());
      // The experiment workspaces: only this loader is in the menu's bundle, the rest is a chunk.
      const workspace = new WorkspaceLoader(app, g, () => input.lockPointer());
      // One settings element, shown by the main menu and by the pause menu.
      const settings = new SettingsPanel(g);
      // The world, drawn by a chunk loaded with the first world scene (RendererHost).
      const renderer = new RendererHost(viewport, g, canvas);
      // The Explain view at a station: its panel and the labels on the apparatus (Phase X).
      const explain = new ExplainView(
        app,
        g,
        viewport,
        (width, height) => renderer.explainAnchors(width, height),
        () => input.lockPointer(),
      );
      // A conversation with a person of the world (Phase Y: the hub's teacher).
      const dialogue = new DialogueView(app, g, viewport, () => input.lockPointer());
      // The teacher's tests (Phase Y-5): the setup form over his line, and a paper held up.
      const testSetup = new TestSetupView(app, g);
      const paper = new PaperView(app, g, viewport, () => input.lockPointer());
      // The game's sound (Phase S): a chunk of its own; it starts at the first click or key.
      const audio = new AudioLoader(g, settings);
      // LAN rooms (Phase M): only under the dev server (npm run dev:lan); the menu says so otherwise.
      const rooms = new LanRooms(g);
      // A panel has the mouse (or the finger): no pause for a freed mouse, no touch controls.
      // The room's chat line and voice (2026-11-12); the chat line has the mouse while typing.
      let chat: ChatView | null = null;
      const panelHasMouse = (): boolean =>
        (chat?.shown ?? false) ||
        hud.resultsShown ||
        inventory.shown ||
        laptop.shown ||
        tasks.shown ||
        workspace.shown ||
        explain.shown ||
        dialogue.shown ||
        paper.shown;
      chat = new ChatView(app, g, rooms, panelHasMouse, () => input.lockPointer());
      const voice = new VoiceChat(app, g, rooms);
      // A gamepad, on any device (2026-11-12): read each frame, beside the keys and the mouse.
      const gamepad = new GamepadInput(g);
      return [
        input,
        gamepad,
        renderer,
        audio,
        hud,
        inventory,
        laptop,
        tasks,
        workspace,
        explain,
        dialogue,
        // Phase F-3: the teacher heard teaching another player of the room nearby.
        new OverheardView(app, g),
        ...(device === 'computer'
          ? []
          : [new TouchControls(app, g, device, panelHasMouse), new TiltLook(g)]),
        testSetup,
        paper,
        settings,
        // The look sensitivity, the tilt, the gamepad's buttons: a section of the settings.
        new ControlSettings(g, settings, device),
        rooms,
        chat,
        voice,
        new MainMenu(app, g, enterWorld, !persistent, settings, rooms),
        new PauseMenu(app, g, settings, () => input.lockPointer(), panelHasMouse),
        // Dev only: in a production build this is false at compile time and the panel is not
        // shipped; there, F3 shows the frame rate alone (PerfOverlay).
        import.meta.env.DEV && g.config.debug.enabled
          ? new DebugPanel(app, g, audio, renderer, clock)
          : new PerfOverlay(app, g, clock),
      ];
    },
  });
  if (!persistent) game.log.warn('This browser blocks storage: progress will not be saved.');
  window.addEventListener('pagehide', () => game.save());

  const frame = (now: number) => {
    const dt = clock.tick(now, game.frameCap);
    if (dt !== null) game.update(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function showFatalError(app: HTMLElement, error: unknown): void {
  // eslint-disable-next-line no-console -- the logger may not exist when boot fails
  console.error(error);
  const box = el('div', 'fatal');
  box.append(
    el('h1', undefined, 'SIMLAB could not start'),
    el('p', undefined, error instanceof BootError ? `Stage: ${error.stage}` : 'Unexpected error'),
    el('pre', undefined, error instanceof Error ? error.message : String(error)),
  );
  app.replaceChildren(box);
}

const app = document.getElementById('app');
// The app's opening, over the page while the game loads; it ends into the menu once it is ready.
const intro = new AppIntro(document.body);
if (app) {
  start(app)
    .then(() => intro.done())
    .catch((error: unknown) => {
      intro.fail();
      showFatalError(app, error);
    });
}
