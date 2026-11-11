import { createContext } from 'react';

/**
 * True inside the bench shell's tree: the few shared parts that differ there read it. The bench is
 * the only shell since B8 (#193); the dev switch `stemsim.dev.shell` is gone (a saved value is
 * ignored).
 */
export const BenchContext = createContext(false);
