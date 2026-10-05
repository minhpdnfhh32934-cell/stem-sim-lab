import { create } from 'zustand';
import { getSafety, type IncidentKind, type SafetyStatus } from './safety';

export interface SafetyUiState {
  /** Null until the first `loadSafety()` answers. */
  status: SafetyStatus | null;
  /** Pilot: the supervisor chose "Để sau" this session (the AI stays off, no gate shown). */
  deferred: boolean;
  /** The gate was opened from Settings (to answer again / finish the supervisor setup). */
  gateRequested: boolean;
  /** Supervisor session end (ms since 1970, 0 = locked). The real check is in Rust. */
  unlockedUntil: number;
  privacyOpen: boolean;
}

export const useSafetyStore = create<SafetyUiState>()(() => ({
  status: null,
  deferred: false,
  gateRequested: false,
  unlockedUntil: 0,
  privacyOpen: false,
}));

export async function loadSafety(): Promise<SafetyStatus> {
  const safety = getSafety();
  const [status, secs] = await Promise.all([safety.status(), safety.unlockedSecs()]);
  useSafetyStore.setState({ status, unlockedUntil: secs > 0 ? Date.now() + secs * 1000 : 0 });
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
  if (s.gateRequested) return true;
  if (!st.answered) return true;
  if (st.edition === 'pilot' && !s.deferred) return !st.pinSet || !st.aiAllowed;
  return false;
}

export function useGateVisible(): boolean {
  return useSafetyStore(gateVisible);
}

export function openGate(): void {
  useSafetyStore.setState({ gateRequested: true, deferred: false });
}

export function closeGate(deferred = false): void {
  useSafetyStore.setState({ gateRequested: false, deferred });
}

export async function unlockSupervisor(pin: string): Promise<void> {
  const secs = await getSafety().unlock(pin);
  useSafetyStore.setState({ unlockedUntil: Date.now() + secs * 1000 });
}

/** Called after `setPin`: Rust opened the session for the person who set the PIN. */
export async function refreshUnlock(): Promise<void> {
  const secs = await getSafety().unlockedSecs();
  useSafetyStore.setState({ unlockedUntil: secs > 0 ? Date.now() + secs * 1000 : 0 });
}

export async function lockSupervisor(): Promise<void> {
  await getSafety().lock();
  useSafetyStore.setState({ unlockedUntil: 0 });
}

export function isUnlocked(s: SafetyUiState, now = Date.now()): boolean {
  return s.unlockedUntil > now;
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
