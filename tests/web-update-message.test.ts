import { describe, expect, it } from 'vitest';
import { signedMessage, signedMessageV2 } from '../scripts/release/manifest-message.mjs';

// The same literal strings are asserted in Rust (`signed_messages_match_the_release_script`
// in src-tauri/src/webupdate.rs): a signature made by the release script must verify in the app.
const base = {
  webVersion: '0.3.2',
  minNative: '0.3.0',
  sha256: 'ab'.repeat(32),
  size: 1234,
  url: 'https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/download/v0.3.2/web-bundle.zip',
};
const SHA = 'ab'.repeat(32);
const URL = base.url;

describe('web-update signed messages (release script ↔ app)', () => {
  it('v1 keeps the pre-0.3.0 format for main and adds the edition for pilot', () => {
    expect(signedMessage({ ...base, edition: 'main' })).toBe(
      `stemsim-web-update\n0.3.2\n0.3.0\n${SHA}\n1234\n${URL}`,
    );
    expect(signedMessage({ ...base, edition: 'pilot' })).toBe(
      `stemsim-web-update\n0.3.2\n0.3.0\n${SHA}\n1234\n${URL}\nedition:pilot`,
    );
  });

  it('v2 always names the edition and the mandatory floor', () => {
    expect(signedMessageV2({ ...base, edition: 'main', minRequired: '0.3.1' })).toBe(
      `stemsim-web-update-v2\n0.3.2\n0.3.0\n${SHA}\n1234\n${URL}\nedition:main\nrequired:0.3.1`,
    );
    expect(signedMessageV2({ ...base, edition: 'pilot', minRequired: '' })).toBe(
      `stemsim-web-update-v2\n0.3.2\n0.3.0\n${SHA}\n1234\n${URL}\nedition:pilot\nrequired:`,
    );
  });
});
