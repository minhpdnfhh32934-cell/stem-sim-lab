import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../core/EventBus';
import { ENGLISH } from '../../../core/i18n';
import { Logger } from '../../../core/Logger';
import type { Game } from '../../../game/Game';
import type { GameEvents } from '../../../game/GameEvents';
import { WorkspaceLoader } from './WorkspaceLoader';

// The real host needs a DOM; the loader only needs something with open/close/escape.
const host = vi.hoisted(() => ({
  opens: [] as string[],
  accepts: true,
  id: null as string | null,
}));
vi.mock('./WorkspaceHost', () => ({
  WorkspaceHost: class {
    root = { remove() {} };
    get stationId() {
      return host.id;
    }
    open(id: string) {
      host.opens.push(id);
      host.id = host.accepts ? id : null;
      return host.accepts;
    }
    close() {
      host.id = null;
    }
    escape() {
      return false;
    }
    update() {}
  },
}));

function setup() {
  const events = new EventBus<GameEvents>(Logger.create('error', () => undefined));
  const blocked: GameEvents['ActionBlocked'][] = [];
  events.subscribe('ActionBlocked', (b) => blocked.push(b));
  const workspace = {
    openStation: null as string | null,
    close: vi.fn(() => (workspace.openStation = null)),
  };
  const game = {
    events,
    texts: ENGLISH,
    workspace,
    input: { reset: vi.fn() },
    log: { warn: vi.fn() },
    config: { input: { bindings: { toggleDebug: ['F3'] } } },
    addWorldPreparation: () => () => undefined,
  } as unknown as Game;
  const capture = vi.fn(() => Promise.resolve());
  const loader = new WorkspaceLoader({} as HTMLElement, game, capture);
  loader.init();
  const open = (id: string) => {
    workspace.openStation = id;
    events.publish('WorkspaceOpened', { stationId: id });
  };
  const close = () => {
    workspace.openStation = null;
    events.publish('WorkspaceClosed', { stationId: 'lab/titration' });
  };
  const key = (code: string) => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), {
      key: code,
      code,
      repeat: false,
    });
    document.dispatchEvent(event);
    return event;
  };
  return { loader, game, workspace, open, close, key, blocked, capture };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  host.opens = [];
  host.accepts = true;
  host.id = null;
  vi.stubGlobal('document', Object.assign(new EventTarget(), { pointerLockElement: null }));
});
afterEach(() => vi.unstubAllGlobals());

describe('WorkspaceLoader', () => {
  it('opens the host for the station and takes the mouse back on close', async () => {
    const { loader, open, close, capture } = setup();
    open('lab/titration');
    expect(loader.shown).toBe(true); // at once: the pause menu then lets the mouse go
    await settle();
    expect(host.opens).toEqual(['lab/titration']);
    close();
    expect(loader.shown).toBe(false);
    expect(capture).toHaveBeenCalledOnce();
  });

  it('does not open a workspace that was closed while the host loaded', async () => {
    const { open, close } = setup();
    open('lab/titration');
    close();
    await settle();
    expect(host.opens).toEqual([]);
  });

  it('closes and says why when the host has no workspace for the station', async () => {
    host.accepts = false;
    const { open, workspace, blocked } = setup();
    open('lab/titration');
    await settle();
    expect(workspace.close).toHaveBeenCalledOnce();
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.actionId).toBe('open-workspace');
  });

  it('owns the keyboard while open; Esc closes a workspace still loading', () => {
    const { open, key, workspace } = setup();
    expect(key('Escape').defaultPrevented).toBe(false); // closed: not its key
    open('lab/titration');
    expect(key('Escape').defaultPrevented).toBe(true);
    expect(workspace.close).toHaveBeenCalledOnce(); // the host has not opened yet
  });
});
