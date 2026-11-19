import { FRAMING } from './framing';
import { applyProperty, defaults, PROPERTY, TIME_ITEMS } from './settings';
import packedCity from 'virtual:wallpaper-city';
import { startWallpaper } from './Wallpaper';

/*
 * The wallpaper page's entry (`wallpaper.html`, Phase W). Settings by the address, for stills:
 * `w`/`h` (a fixed canvas), `t` (a frozen clock, s), `mx`/`my` (a fixed mouse, −1…1), and while
 * tuning the framing `eye`, `target` (x,y,z) and `fov`; `time` (auto, afternoon, sunset, night),
 * `bright` (0.5–1.5), `fps` (0: the screen's), `hide` (parts left out, to measure them),
 * `yaw` (the view turned round the two to the left, degrees, as the wheel scrolled down).
 */

const query = new URLSearchParams(location.search);
const number = (key: string): number | null => {
  const v = query.get(key);
  return v === null || !Number.isFinite(Number(v)) ? null : Number(v);
};
const w = number('w');
const h = number('h');
const mx = number('mx');
const my = number('my');
const vec = (key: string): [number, number, number] | null => {
  const v = query.get(key)?.split(',').map(Number);
  if (v?.length !== 3 || !v.every(Number.isFinite)) return null;
  const [x = 0, y = 0, z = 0] = v;
  return [x, y, z];
};
// Settings: Lively's panel sets them (`livelyPropertyListener`); the address too, for stills.
const settings = defaults();
const timeAsked = TIME_ITEMS.indexOf((query.get('time') ?? 'auto') as never);
if (timeAsked >= 0) applyProperty(settings, PROPERTY.time, timeAsked);
const brightAsked = number('bright');
if (brightAsked !== null) applyProperty(settings, PROPERTY.brightness, brightAsked * 100);
const fpsAsked = number('fps');
if (fpsAsked !== null) settings.fps = fpsAsked;
(
  window as unknown as { livelyPropertyListener: (name: string, value: unknown) => void }
).livelyPropertyListener = (name, value) => applyProperty(settings, name, value);
const host = document.getElementById('wallpaper');
if (!host) throw new Error('no #wallpaper on the page');
const chosen = FRAMING;
startWallpaper(host, {
  framing: {
    ...chosen,
    eye: vec('eye') ?? chosen.eye,
    target: vec('target') ?? chosen.target,
    fov: number('fov') ?? chosen.fov,
  },
  size: w && h ? { w, h } : null,
  frozen: number('t'),
  mouse: mx !== null && my !== null ? { x: mx, y: my } : null,
  hide: new Set((query.get('hide') ?? '').split(',').filter(Boolean)),
  settings,
  lapAt: number('lapAt'),
  chatAt: number('chatAt'),
  // The city's models packed into the build for Lively (empty under the dev server: fetched).
  cityFiles: packedCity,
  // (Degrees in the address, + left as the wheel scrolled down turns it.)
  orbit: number('yaw') === null ? null : -((number('yaw') ?? 0) * Math.PI) / 180,
}).catch((error: unknown) => {
  host.textContent = `The wallpaper could not start: ${String(error)}`;
  host.style.color = '#e8e8e8';
});
