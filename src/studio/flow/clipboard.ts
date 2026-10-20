/**
 * Copies text with the browser's Clipboard API. Returns false when the page may not write to
 * the clipboard (no API, no permission); the caller then tells the learner to copy by hand.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
