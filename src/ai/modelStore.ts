/**
 * Where downloaded Gemma files live: the Origin Private File System (OPFS).
 *
 * Transformers.js caches in Cache Storage by default, but Chromium (and so WebView2) refuses a
 * single entry of ~300 MB ("Failed to execute 'put' on 'Cache'"), which is exactly the size of a
 * model's weights (`model_q4.onnx_data`). The weights were then downloaded again on every start
 * while the app said "ready". OPFS has no such limit and works in pages and workers.
 *
 * The object below implements the two methods Transformers.js needs (`match`, `put`), so it is
 * plugged in as `env.customCache`. Files are grouped per model repo, which makes deletion easy.
 */

const ROOT = 'stemsim-models';

/** `https://huggingface.co/<owner>/<name>/resolve/<rev>/<file>` → repo folder + file name. */
export function storagePath(key: string): { repo: string; file: string } {
  const match = /huggingface\.co\/([^/]+\/[^/]+)\/resolve\/[^/]+\/(.+?)(?:\?.*)?$/.exec(key);
  const repo = match?.[1] ?? '_other';
  const file = match?.[2] ?? key;
  return { repo: safeName(repo), file: safeName(file) };
}

function safeName(text: string): string {
  return text.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200);
}

export function opfsAvailable(): boolean {
  try {
    // Older WebViews and test environments lack `navigator.storage` or OPFS entirely.
    const storage = (navigator as { storage?: { getDirectory?: unknown } }).storage;
    return typeof storage?.getDirectory === 'function';
  } catch {
    return false;
  }
}

async function repoDir(repo: string, create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const models = await root.getDirectoryHandle(ROOT, { create });
  return models.getDirectoryHandle(repo, { create });
}

export const modelStore = {
  async match(key: string): Promise<Response | undefined> {
    try {
      const { repo, file } = storagePath(key);
      const handle = await (await repoDir(repo, false)).getFileHandle(file);
      const blob = await handle.getFile();
      // A file is created empty and filled only when its writer closes: empty = not stored.
      if (blob.size === 0) return undefined;
      return new Response(blob, {
        headers: { 'content-length': String(blob.size) },
      });
    } catch {
      return undefined;
    }
  },

  /** Written through a writable stream: the content is committed only once it is complete. */
  async put(key: string, response: Response): Promise<void> {
    const { repo, file } = storagePath(key);
    const handle = await (await repoDir(repo, true)).getFileHandle(file, { create: true });
    const writable = await handle.createWritable();
    try {
      if (response.body) {
        await response.body.pipeTo(writable);
      } else {
        await writable.write(await response.arrayBuffer());
        await writable.close();
      }
    } catch (e) {
      await writable.abort().catch(() => undefined);
      await (await repoDir(repo, true)).removeEntry(file).catch(() => undefined);
      throw e;
    }
  },
};

/** Smallest believable size of a model's weights (the 270M model is ~300 MB). */
const MIN_WEIGHTS_BYTES = 10_000_000;

/**
 * True when the repo folder holds the model weights: ONNX files (graph + external data)
 * adding up to a real model size, so a stored graph without its weights does not count.
 */
export async function repoStored(repoId: string): Promise<boolean> {
  if (!opfsAvailable()) return false;
  try {
    const dir = await repoDir(safeName(repoId), false);
    let bytes = 0;
    for await (const handle of (
      dir as unknown as { values(): AsyncIterable<FileSystemHandle> }
    ).values()) {
      if (handle.kind === 'file' && handle.name.includes('.onnx')) {
        bytes += (await (handle as FileSystemFileHandle).getFile()).size;
      }
    }
    return bytes >= MIN_WEIGHTS_BYTES;
  } catch {
    return false;
  }
}

/** Deletes every stored file of one model repo. */
export async function deleteRepo(repoId: string): Promise<void> {
  if (!opfsAvailable()) return;
  try {
    const root = await navigator.storage.getDirectory();
    const models = await root.getDirectoryHandle(ROOT);
    await models.removeEntry(safeName(repoId), { recursive: true });
  } catch {
    /* nothing stored */
  }
}
