export interface LlamaPin {
  tag: string;
  commit: string;
  file: string;
  size: number;
  sha256: string;
}
export const LLAMA: LlamaPin;
export const URL: string;
export const KEEP: string[];
export const STAMP: string;
export function checkZip(bytes: Uint8Array, pin?: LlamaPin): void;
export function isCurrent(dir: string, pin?: LlamaPin): boolean;
