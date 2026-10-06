import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { setSafetyBackendForTests, statusOf, TERMS_VERSION, BrowserSafety } from '@/safety/safety';
import { useSafetyStore } from '@/safety/safetyStore';
import { useProfileStore } from '@/app/learner/profileStore';

// jsdom does not implement <dialog>.showModal()/close().
if (typeof HTMLDialogElement !== 'undefined' && !('showModal' in HTMLDialogElement.prototype)) {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
}

afterEach(() => {
  cleanup();
  // Node-environment tests (`@vitest-environment node`) have no localStorage.
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

// Unit tests run as an adult who accepted the terms (main) or with recorded consent (pilot), so
// the AI code paths can be tested. The gates themselves are tested in src/safety and in Rust.
class OpenSafety extends BrowserSafety {
  override status() {
    return Promise.resolve(
      statusOf(
        { adultTerms: TERMS_VERSION, birthYear: 2000, pinHash: 'x', pinSalt: 'x' },
        __EDITION__ === 'pilot',
        2026,
      ),
    );
  }
}

beforeEach(() => {
  setSafetyBackendForTests(new OpenSafety());
  useSafetyStore.setState({
    status: null,
    deferred: false,
    gateRequested: false,
    unlockedUntil: 0,
  });
  // Unit tests start after the first-run onboarding (tested in src/app/learner and E2E).
  useProfileStore.setState({ onboarded: true, connectSeen: true, lastTopic: null });
});
