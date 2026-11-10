import { createContext } from 'react';

/** localStorage key of the bench dev switch (0.8.1 B1, #115): value `bench` shows the new shell. */
export const DEV_SHELL_KEY = 'stemsim.dev.shell';

/**
 * Whether the "Bàn thí nghiệm" shell replaces the classic one. Only a development build reads the
 * switch (`import.meta.env.DEV` is `false` in production, where this is always false); one build,
 * no `VITE_*` flag. The classic shell stays the default until the flip (B8).
 */
export function benchShellOn(
  dev: boolean = import.meta.env.DEV,
  storage?: Pick<Storage, 'getItem'>,
): boolean {
  if (!dev) return false;
  try {
    // Reading `localStorage` itself can throw (blocked site data), so it is read in here too.
    return (storage ?? globalThis.localStorage).getItem(DEV_SHELL_KEY) === 'bench';
  } catch {
    return false;
  }
}

/** True inside the bench shell's tree: the few shared parts that differ there read it. */
export const BenchContext = createContext(false);
