// Builds the SimLab 3D game from game/ into public/game, as SimLab ships it (docs/GAME.md):
// the embedded build (VITE_SIMLAB_EMBED=1: single player, no face from a photo, no Ultra
// preset) with relative paths, then without the folders the app does not use.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const game = join(root, 'game');
const out = join(root, 'public', 'game');
const shell = process.platform === 'win32';

/** Quoted for a shell (Windows runs npm / npx through cmd): a path may hold spaces. */
const quote = (arg) => (/[\s"]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg);

function run(cmd, args, env = {}) {
  const options = { cwd: game, stdio: 'inherit', env: { ...process.env, ...env } };
  const r = shell
    ? spawnSync([cmd, ...args].map(quote).join(' '), { ...options, shell: true })
    : spawnSync(cmd, args, options);
  if (r.status !== 0) {
    console.error(`${cmd} ${args.join(' ')} failed (${String(r.status)})`);
    process.exit(r.status ?? 1);
  }
}

// The game's own dependencies, always exactly as game/package-lock.json says (a changed lockfile is
// never built with old ones); no install scripts are run.
run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
run('npx', ['vite', 'build', '--base', './', '--outDir', out, '--emptyOutDir'], { VITE_SIMLAB_EMBED: '1' });
// Not shipped in SimLab: the Ultra textures (107 MB) and the MediaPipe models (no in-app model).
for (const dir of ['ultra', 'models']) rmSync(join(out, dir), { recursive: true, force: true });
console.log(`SimLab 3D built into ${out}`);
