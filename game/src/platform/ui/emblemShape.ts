/**
 * The SimLab emblem — a measured flight: a dial, a floor tape, a strobed trajectory and the ball
 * at its top — as plain numbers on its square view box (units, y down, the dial's centre at
 * size / 2). menuArt.ts draws the menu's SVG from them and the hub's 3D emblem
 * (platform/render/props/hub.ts) is built from them, so the two stay one design. No imports: it
 * is in the menu's bundle, and the renderer's reads it from there.
 */
export const EMBLEM = {
  size: 240,
  colors: { cyan: '#4fb3d9', pale: '#cdeefa', warm: '#ffb454' },
  /** The dial's inner ring (stroke 1, the SVG default) and outer ring. */
  inner: 88,
  outer: { r: 114, width: 1.5 },
  /** The tick dashes round the dial: `length` across the ring, `dash` and `gap` along it. */
  ticks: { r: 103, length: 8, dash: 1.2, gap: 9.586 },
  /** At rest on top of the outer ring (the menu turns it round the dial); `glow` is its halo. */
  satellite: { x: 120, y: 6, r: 2.4, glow: 6 },
  /** The floor tape and its marks below it, [x, length] (stroke 1). */
  tape: {
    y: 168,
    from: 44,
    to: 196,
    width: 1.5,
    marks: [
      [56, 7],
      [80, 4],
      [104, 7],
      [128, 4],
      [152, 7],
      [176, 4],
    ],
  },
  /** The trajectory: a quadratic curve from launch to landing, on the tape, dashed. */
  flight: { from: [56, 168], control: [120, 28], to: [184, 168], width: 2, dash: 5, gap: 6 },
  /**
   * Strobe images of the ball on the trajectory (at t = 0.15, 0.3, 0.7, 0.85, to 0.1 unit); in
   * the menu each rests at opacity `rest` and lights `at` seconds into each sweep.
   */
  strobes: [
    { x: 75.2, y: 132.3, r: 3, rest: 0.4, at: 0 },
    { x: 94.4, y: 109.2, r: 3.5, rest: 0.65, at: 0.25 },
    { x: 145.6, y: 109.2, r: 3.5, rest: 0.65, at: 0.75 },
    { x: 164.8, y: 132.3, r: 3, rest: 0.4, at: 1 },
  ],
  /** The ball at the top of its flight (t = 0.5), and its glow. */
  ball: { x: 120, y: 98, r: 7, glow: 16 },
} as const;
