import { useAiStore } from '@/ai/aiStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
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
 * "Phân tích đề": a crisis message gets the support card first (nothing is sent), no key opens
 * "Kết nối AI", otherwise the analysis starts.
 */
export function submitProblem(text: string): void {
  if (showCrisisIfNeeded(text)) return;
  const action = analyzeAction(text);
  if (action === 'connect') useWorkspaceStore.getState().setSettingsOpen(true);
  else if (action === 'analyze') void analyze(text);
}
