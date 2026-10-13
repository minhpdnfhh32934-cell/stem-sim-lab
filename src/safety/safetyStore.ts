import { create } from 'zustand';
import { getSafety, type IncidentKind, type SafetyStatus } from './safety';

export interface SafetyUiState {
  /** Null until the first `loadSafety()` answers. */
  status: SafetyStatus | null;
  /** The gate was opened from Settings (to answer again). */
  gateRequested: boolean;
  privacyOpen: boolean;
}

export const useSafetyStore = create<SafetyUiState>()(() => ({
  status: null,
  gateRequested: false,
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

/** Should the first-run gate be on screen? */
export function gateVisible(s: SafetyUiState): boolean {
  const st = s.status;
  if (!st) return false;
  return s.gateRequested || !st.answered;
}

export function useGateVisible(): boolean {
  return useSafetyStore(gateVisible);
}

export function openGate(): void {
  useSafetyStore.setState({ gateRequested: true });
}

export function closeGate(): void {
  useSafetyStore.setState({ gateRequested: false });
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
