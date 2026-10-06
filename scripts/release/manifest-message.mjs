// Signed messages of a web-update manifest. Must stay byte-identical to `signed_message` and
// `signed_message_v2` in src-tauri/src/webupdate.rs (both sides are tested against the same
// literal strings: tests/web-update-message.test.ts and the Rust test
// `signed_messages_match_the_release_script`).

/** v1 — read by apps older than 0.3.0. Main keeps the original format; pilot adds its edition. */
export function signedMessage(m) {
  const lines = ['stemsim-web-update', m.webVersion, m.minNative, m.sha256, String(m.size), m.url];
  if ((m.edition || 'main') !== 'main') lines.push(`edition:${m.edition}`);
  return lines.join('\n');
}

/** v2 — 0.3.0+: also covers the edition and the mandatory-update floor. */
export function signedMessageV2(m) {
  return [
    'stemsim-web-update-v2',
    m.webVersion,
    m.minNative,
    m.sha256,
    String(m.size),
    m.url,
    `edition:${m.edition || 'main'}`,
    `required:${m.minRequired ?? ''}`,
  ].join('\n');
}
