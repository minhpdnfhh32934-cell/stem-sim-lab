/**
 * The Qwen card's state (#190): what Rust said last, the running download and the last error.
 * Not saved: Rust keeps the model and the card-fault switch on disk. A download keeps running in
 * Rust when Settings closes; its progress lands here, so the card shows it again when reopened.
 */
import { create } from 'zustand';
import { useChatStore } from '@/teacher/chat/chatStore';
import { createEtaTracker } from '@/ui/eta';
import { toAiError } from '../types';
import { useLocalAiStore } from '../local/localAiStore';
import { getBuiltinClient } from './client';
import { BUILTIN_SELECTION, type BuiltinStatus } from './types';

export interface BuiltinProgress {
  bytes: number;
  /** Seconds left at the recent speed (null: no fair estimate yet). */
  eta: number | null;
}

export type BuiltinAction = 'download' | 'remove' | 'start' | 'stop' | 'enable';

interface BuiltinState {
  status: BuiltinStatus | null;
  /** The AiError message of the last status check, if it failed (e.g. no desktop app). */
  statusError: string | null;
  progress: BuiltinProgress | null;
  /** The action running now, if any. */
  busy: BuiltinAction | null;
  /** The AiError message of the last failed action. */
  error: string | null;
  refresh: () => Promise<void>;
  /** Downloads, or resumes, the model. */
  download: () => Promise<void>;
  cancel: () => Promise<void>;
  remove: () => Promise<void>;
  /** "Dùng cho AI Teacher": the local engine with Qwen, then the model loads on the card. */
  choose: () => Promise<void>;
  /** "Giải phóng bộ nhớ card". */
  stop: () => Promise<void>;
  /** "Bật lại" after a card fault. */
  enable: () => Promise<void>;
}

const message = (e: unknown) => toAiError(e).message;

export const useBuiltinStore = create<BuiltinState>()((set, get) => {
  /** Runs one action, then reads the status again (whatever happened). */
  const run = async (action: BuiltinAction, work: () => Promise<void>) => {
    if (get().busy) return;
    set({ busy: action, error: null });
    try {
      await work();
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: null });
      await get().refresh();
    }
  };
  return {
    status: null,
    statusError: null,
    progress: null,
    busy: null,
    error: null,
    refresh: async () => {
      try {
        set({ status: await getBuiltinClient().status(), statusError: null });
      } catch (e) {
        set({ statusError: message(e) });
      }
    },
    download: () =>
      run('download', async () => {
        const eta = createEtaTracker();
        const size = get().status?.size ?? null;
        set({ progress: { bytes: 0, eta: null } });
        try {
          await getBuiltinClient().download((bytes) => {
            set({ progress: { bytes, eta: eta(bytes, size) } });
          });
        } finally {
          set({ progress: null });
        }
      }),
    cancel: async () => {
      await getBuiltinClient()
        .cancel()
        .catch((e: unknown) => {
          set({ error: message(e) });
        });
    },
    remove: () =>
      run('remove', async () => {
        if (useLocalAiStore.getState().selected?.builtin) {
          useLocalAiStore.getState().select(null);
          useChatStore.getState().leaveLocal();
        }
        await getBuiltinClient().remove();
      }),
    choose: () =>
      run('start', async () => {
        useLocalAiStore.getState().select(BUILTIN_SELECTION);
        useChatStore.getState().setEngine('local');
        await getBuiltinClient().start();
      }),
    stop: () => run('stop', () => getBuiltinClient().stop()),
    enable: () => run('enable', () => getBuiltinClient().enable()),
  };
});
