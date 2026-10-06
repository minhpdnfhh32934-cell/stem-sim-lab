/** Fields of a web-update manifest that are signed (see manifest-message.mjs). */
export interface SignedFields {
  webVersion: string;
  minNative: string;
  sha256: string;
  size: number;
  url: string;
  edition?: string;
  minRequired?: string;
}
export function signedMessage(m: SignedFields): string;
export function signedMessageV2(m: SignedFields): string;
