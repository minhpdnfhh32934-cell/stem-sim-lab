import { create } from 'zustand';
import { getSafety, type IncidentKind, type SafetyStatus } from './safety';

export interface SafetyUiState {
  /** Null until the first `loadSafety()` answers. */
  status: SafetyStatus | null;
  /** The gate was opened from Settings (to answer again). */
  gateRequested: boolean;
  /** …or from the bench's first run ("Quay lại" on step 3): it stays "Bước 2/3". */
  gateFirstRun: boolean;
  privacyOpen: boolean;
}

export const useSafetyStore = create<SafetyUiState>()(() => ({
  status: null,
  gateRequested: false,
  gateFirstRun: false,
  privacyOpen: false,
}));

export async function loadSafety(): Promise<SafetyStatus> {
  const status = await getSafety().status();
  useSafetyStore.setState({ status });
  return status;
}

/** The current status (loads it once if needed). */
export async function currentSafety(): Promise<SafetyStatus> {
  return useSafetyStore.getState().status ?? loadSafety();
}

export function setSafetyStatus(status: SafetyStatus): void {
  useSafetyStore.setState({ status });
}

/**
 * AI Teacher's door is locked: the learner answered "under 18" (the AI stays off; the gate in Rust
 * refuses every AI call). The one rule every way into AI Teacher follows: the launch card, the
 * notebook's "Hỏi AI" tab, Ctrl+K, "Hỏi thầy" in the 3D lessons and `openTeacher` itself.
 */
export function teacherLocked(s: SafetyUiState): boolean {
  return s.status?.minor === true;
}

/** Should the first-run gate be on screen? */
export function gateVisible(s: SafetyUiState): boolean {
  const st = s.status;
  if (!st) return false;
  return s.gateRequested || !st.answered;
}

export function useGateVisible(): boolean {
  return useSafetyStore(gateVisible);
}

export function openGate({ firstRun = false } = {}): void {
  useSafetyStore.setState({ gateRequested: true, gateFirstRun: firstRun });
}

export function closeGate(): void {
  useSafetyStore.setState({ gateRequested: false, gateFirstRun: false });
}

/** Records an incident (kind and time only). Never fails the caller. */
export function logIncident(kind: IncidentKind): void {
  void getSafety()
    .logIncident(kind)
    .catch(() => undefined);
}

export function openPrivacy(): void {
  useSafetyStore.setState({ privacyOpen: true });
}

export function closePrivacy(): void {
  useSafetyStore.setState({ privacyOpen: false });
}
