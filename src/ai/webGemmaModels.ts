/**
 * Gemma models runnable inside the app (Transformers.js + WebGPU, no server).
 * Every repo below is public (`gated: false` on HuggingFace), so the in-app
 * download works with no token — the exact setup the old project used.
 */

export type WebGemmaKind = 'text' | 'vision';

export interface WebGemmaModel {
  /** Stable id used in settings and migrations. */
  id: string;
  /** Public HuggingFace repo (also the manual-download page). */
  repo: string;
  repoUrl: string;
  kind: WebGemmaKind;
  /** Quantization variant fetched from the repo. */
  dtype: 'q4' | 'q4f16';
  /** Approximate download size, shown before downloading. */
  sizeLabel: string;
  /** Bytes of the q4 files the app downloads (HuggingFace API, checked 2026-10-12). */
  bytes: number;
}

export const WEB_GEMMA_MODELS: WebGemmaModel[] = [
  {
    id: 'gemma3-270m',
    repo: 'onnx-community/gemma-3-270m-it-ONNX',
    repoUrl: 'https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX',
    kind: 'text',
    dtype: 'q4',
    sizeLabel: '≈ 345 MB',
    bytes: 345_000_000,
  },
  {
    id: 'gemma3-1b',
    repo: 'onnx-community/gemma-3-1b-it-ONNX',
    repoUrl: 'https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX',
    kind: 'text',
    dtype: 'q4',
    sizeLabel: '≈ 880 MB',
    bytes: 880_000_000,
  },
  {
    id: 'gemma4-e2b',
    repo: 'onnx-community/gemma-4-E2B-it-ONNX',
    repoUrl: 'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX',
    kind: 'vision',
    dtype: 'q4',
    sizeLabel: '≈ 3,8 GB',
    bytes: 3_760_000_000,
  },
];

export function webGemmaModel(id: string): WebGemmaModel | undefined {
  return WEB_GEMMA_MODELS.find((m) => m.id === id);
}
