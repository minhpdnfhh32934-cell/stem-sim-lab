import { useEffect, useState } from 'react';
import { gemmaReady } from '@/ai/gemmaTransport';
import { useChatStore } from '@/teacher/chat/chatStore';

/**
 * Which engine reads a problem ("Phân tích đề"):
 * - `gemma`: the local model is downloaded and the Gemma engine is selected;
 * - `gemma-missing`: the learner explicitly chose Gemma but it is not ready — nothing is sent
 *   online behind their back, Settings → AI Teacher explains what to do;
 * - `cloud`: everything else. New installs start with the Gemma engine pre-selected, but until
 *   a model is downloaded (or the learner picks Gemma themselves) the connected API is used,
 *   so a learner with a Gemini key is never sent to a model they never downloaded.
 */
export type AnalysisEngine = 'gemma' | 'gemma-missing' | 'cloud';

export function analysisEngineFor(
  engine: 'cloud' | 'gemma',
  engineChosen: boolean,
  localReady: boolean,
): AnalysisEngine {
  if (engine !== 'gemma') return 'cloud';
  if (localReady) return 'gemma';
  return engineChosen ? 'gemma-missing' : 'cloud';
}

export async function analysisEngine(): Promise<AnalysisEngine> {
  const chat = useChatStore.getState();
  if (chat.engine !== 'gemma') return 'cloud';
  const ready = await gemmaReady(chat.gemmaModel).catch(() => false);
  return analysisEngineFor(chat.engine, chat.engineChosen, ready);
}

/** The same choice for buttons (re-checked when a model is downloaded or deleted). */
export function useAnalysisEngine(): AnalysisEngine {
  const engine = useChatStore((s) => s.engine);
  const engineChosen = useChatStore((s) => s.engineChosen);
  const model = useChatStore((s) => s.gemmaModel);
  const [ready, setReady] = useState<{ model: string; ready: boolean } | null>(null);
  useEffect(() => {
    if (engine !== 'gemma') return;
    let alive = true;
    const check = () => {
      void gemmaReady(model)
        .catch(() => false)
        .then((r) => {
          if (alive) setReady({ model, ready: r });
        });
    };
    check();
    window.addEventListener('stemsim:gemma-changed', check);
    return () => {
      alive = false;
      window.removeEventListener('stemsim:gemma-changed', check);
    };
  }, [engine, model]);
  const localReady = ready?.model === model && ready.ready;
  return analysisEngineFor(engine, engineChosen, localReady);
}
