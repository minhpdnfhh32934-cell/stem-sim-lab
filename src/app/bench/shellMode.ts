import { createContext } from 'react';

/**
 * True inside the bench shell's tree: the shared parts that differ there read it. The bench is
 * the only shell since B8 (#193), so in the app it is always true; the dev switch
 * `stemsim.dev.shell` is gone (a saved value is ignored).
 * shortcut: the `false` branches it still guards in 27 files (28 reads) are classic code no screen
 * shows, remove them with this context in #200 once #198 is in main.
 */
export const BenchContext = createContext(false);
