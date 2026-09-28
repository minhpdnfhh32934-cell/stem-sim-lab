import { registerEngine } from '@/core/sim/engine';

/**
 * Every simulation engine is registered here with a lazy import, so each domain's code
 * is only loaded when one of its scenes opens (MASTER_PROMPT §4.2 lazy loading).
 */
registerEngine('demo.oscillator', async () => {
  const { OscillatorEngine } = await import('@/core/sim/demoEngine');
  return () => new OscillatorEngine();
});

registerEngine('phys.projectile', async () => {
  const { ProjectileEngine } = await import('@/physics/projectile/engine');
  return () => new ProjectileEngine();
});

registerEngine('phys.linear', async () => {
  const { LinearEngine } = await import('@/physics/linear/engine');
  return () => new LinearEngine();
});

registerEngine('phys.incline', async () => {
  const { InclineEngine } = await import('@/physics/incline/engine');
  return () => new InclineEngine();
});

registerEngine('phys.pulley', async () => {
  const { PulleyEngine } = await import('@/physics/pulley/engine');
  return () => new PulleyEngine();
});

registerEngine('phys.spring', async () => {
  const { SpringEngine } = await import('@/physics/spring/engine');
  return () => new SpringEngine();
});

registerEngine('phys.pendulum', async () => {
  const { PendulumEngine } = await import('@/physics/pendulum/engine');
  return () => new PendulumEngine();
});

registerEngine('phys.track', async () => {
  const { TrackEngine } = await import('@/physics/track/engine');
  return () => new TrackEngine();
});

registerEngine('phys.collision', async () => {
  const { CollisionEngine } = await import('@/physics/collision/engine');
  return () => new CollisionEngine();
});
