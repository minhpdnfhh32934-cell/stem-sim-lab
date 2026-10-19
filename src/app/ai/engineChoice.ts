import { useEffect, useState } from 'react';
import { gemmaReady } from '@/ai/gemmaTransport';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { useChatStore, type ChatEngine } from '@/teacher/chat/chatStore';

/**
 * Which engine answers (AI Teacher) and reads a problem ("Phân tích đề", "Giải thích"):
 * - `gemma`: the in-app model is downloaded and the Gemma engine is selected;
 * - `gemma-missing`: the learner explicitly chose Gemma but it is not ready — nothing is sent
 *   online behind their back, Settings → AI local explains what to do;
 * - `local`: the learner chose a runtime on this computer (Ollama, LM Studio, llama.cpp…) and a
 *   runtime and model are picked in Settings → AI trên máy khác;
 * - `local-missing`: the local runtime engine is chosen but no runtime and model are picked (or
 *   the saved address was not valid and was dropped). Nothing is sent anywhere, and it NEVER
 *   becomes `cloud`: a runtime that does not answer is reported as such when asked;
 * - `cloud`: everything else. New installs start with the Gemma engine pre-selected, but until
 *   a model is downloaded (or the learner picks Gemma themselves) the connected API is used,
 *   so a learner with a Gemini key is never sent to a model they never downloaded.
 *
 * `local` is reached only through `setEngine` (always the learner's own choice): there is no
 * pre-selected local runtime.
 */
export type AnalysisEngine = 'gemma' | 'gemma-missing' | 'cloud' | 'local' | 'local-missing';

export function analysisEngineFor(
  engine: ChatEngine,
  engineChosen: boolean,
  gemmaIsReady: boolean,
  localSelected = false,
): AnalysisEngine {
  if (engine === 'local') return localSelected ? 'local' : 'local-missing';
  if (engine !== 'gemma') return 'cloud';
  if (gemmaIsReady) return 'gemma';
  return engineChosen ? 'gemma-missing' : 'cloud';
}

/** The engine that really answers, in three kinds (a missing local engine is still local). */
export function engineKind(engine: AnalysisEngine): ChatEngine {
  if (engine === 'local' || engine === 'local-missing') return 'local';
  return engine === 'cloud' ? 'cloud' : 'gemma';
}

export async function analysisEngine(): Promise<AnalysisEngine> {
  const chat = useChatStore.getState();
  if (chat.engine === 'local') {
    return analysisEngineFor('local', true, false, useLocalAiStore.getState().selected !== null);
  }
  if (chat.engine !== 'gemma') return 'cloud';
  const ready = await gemmaReady(chat.gemmaModel).catch(() => false);
  return analysisEngineFor(chat.engine, chat.engineChosen, ready);
}

/** The same choice for buttons (re-checked when a model is downloaded or deleted). */
export function useAnalysisEngine(): AnalysisEngine {
  const engine = useChatStore((s) => s.engine);
  const engineChosen = useChatStore((s) => s.engineChosen);
  const model = useChatStore((s) => s.gemmaModel);
  const localSelected = useLocalAiStore((s) => s.selected !== null);
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
  const gemmaIsReady = ready?.model === model && ready.ready;
  return analysisEngineFor(engine, engineChosen, gemmaIsReady, localSelected);
}
