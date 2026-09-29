import { invoke, isTauri } from '@tauri-apps/api/core';

export interface SaveRequest {
  /** Suggested file name, e.g. "nem-xien.stemsim". */
  name: string;
  filterName: string;
  extensions: string[];
  /** Text, or binary data (PNG) as a Blob. */
  contents: string | Blob;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * Saves a file: the native "Save as" dialog in the desktop app, a download in the browser.
 * Returns the saved path/name, or null when the user cancelled.
 */
export async function saveFile(req: SaveRequest): Promise<string | null> {
  if (isTauri()) {
    const binary = typeof req.contents !== 'string';
    const contents =
      typeof req.contents === 'string' ? req.contents : await blobToBase64(req.contents);
    return invoke<string | null>('save_file', {
      defaultName: req.name,
      filterName: req.filterName,
      extensions: req.extensions,
      contents,
      base64: binary,
    });
  }
  const blob =
    typeof req.contents === 'string'
      ? new Blob([req.contents], { type: 'text/plain;charset=utf-8' })
      : req.contents;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = req.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
  return req.name;
}

export interface OpenedFile {
  name: string;
  text: string;
}

/** Lets the user pick a text file (native dialog, or a file input in the browser). */
export async function openTextFile(
  filterName: string,
  extensions: string[],
): Promise<OpenedFile | null> {
  if (isTauri()) {
    return invoke<OpenedFile | null>('open_text_file', { filterName, extensions });
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = extensions.map((e) => `.${e}`).join(',');
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void file.text().then((text) => {
        resolve({ name: file.name, text });
      });
    });
    input.addEventListener('cancel', () => {
      resolve(null);
    });
    input.click();
  });
}

/** File-name-safe slug ("Ném xiên" → "nem-xien"). */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'mo-phong'
  );
}
