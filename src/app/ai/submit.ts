import { useAiStore } from '@/ai/aiStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { analysisEngine } from './engineChoice';
import { analyze, showCrisisIfNeeded, useAnalyzeStore } from './analyze';

/** What the "Phân tích đề" button does now (shared by the top bar and the home screen). */
export function analyzeAction(text: string): 'off' | 'connect' | 'empty' | 'busy' | 'analyze' {
  const ai = useAiStore.getState();
  if (ai.provider === 'off') return 'off';
  // No key yet: the button leads to "Kết nối AI" instead (PROMPT_PHAN_2 A2).
  if (ai.status === 'noKey') return 'connect';
  if (useAnalyzeStore.getState().phase === 'running') return 'busy';
  return text.trim() ? 'analyze' : 'empty';
}

/**
 * "Phân tích đề": a crisis message gets the support card first (nothing is sent). With the
 * Gemma engine the local model analyzes the problem (no cloud key needed); otherwise no
 * key opens "Kết nối AI" and the analysis starts when ready.
 */
export async function submitProblem(text: string): Promise<void> {
  if (showCrisisIfNeeded(text)) return;
  const engine = await analysisEngine();
  if (engine !== 'cloud') {
    if (useAnalyzeStore.getState().phase === 'running') return;
    // Gemma was chosen but is not downloaded: show where to get it, send nothing online.
    if (engine === 'gemma-missing') {
      useWorkspaceStore.getState().openSettingsAt('teacher');
      return;
    }
    await analyze(text);
    return;
  }
  const action = analyzeAction(text);
  if (action === 'connect') useWorkspaceStore.getState().openSettingsAt('ai');
  else if (action === 'analyze') await analyze(text);
}
