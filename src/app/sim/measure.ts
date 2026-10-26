/**
 * Length (m) and angle (rad) of a ruler / protractor segment between two world points. A scene
 * that draws its vertical axis stretched (`PhysicsScene.yStretch`) is measured unstretched.
 */
export function measureSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  yStretch = 1,
): { length: number; angle: number } {
  const dx = b.x - a.x;
  const dy = (b.y - a.y) / yStretch;
  return { length: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
}
