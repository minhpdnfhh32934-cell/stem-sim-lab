import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const DEG = Math.PI / 180;

/**
 * The surface pairs `surface` 1…4 selects, block on ramp strip: 1 Teflon on Teflon, 2 metal on
 * metal (lubricated), 3 wood on wood, 4 steel on steel (dry), with the coefficients of static
 * friction μs and kinetic friction μk from Serway & Jewett, Physics for Scientists and Engineers,
 * Table 5.1 "Coefficients of friction", which itself gives them as approximate. Wood on wood is
 * listed there as μs = 0.25–0.5; 0.35, the middle, is taken. Real coefficients depend on the
 * finish, cleanliness and wear of the surfaces and vary by tens of percent; μk ≤ μs for each.
 */
export const SURFACES: readonly {
  readonly staticFriction: number;
  readonly kineticFriction: number;
}[] = [
  { staticFriction: 0.04, kineticFriction: 0.04 },
  { staticFriction: 0.15, kineticFriction: 0.06 },
  { staticFriction: 0.35, kineticFriction: 0.2 },
  { staticFriction: 0.74, kineticFriction: 0.57 },
];

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['angle', (a) => a >= 0 && a <= 90, 'from 0 to 90 degrees'],
  [
    'surface',
    (s) => Number.isInteger(s) && s >= 1 && s <= SURFACES.length,
    `a whole number from 1 to ${SURFACES.length}`,
  ],
  ['mass', (m) => m > 0 && m < Infinity, 'above 0 kg and finite'],
  ['length', (l) => l > 0 && l < Infinity, 'above 0 m and finite'],
  ['gravity', (g) => g > 0 && g < Infinity, 'above 0 m/s² and finite'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Incline input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Incline input "${id}" must be ${rule}, got ${value}`);
  }
}

/** The surface pair of validated inputs. */
function surfaceOf(inputs: Inputs) {
  const surface = SURFACES[(inputs.surface ?? NaN) - 1];
  if (!surface) throw new Error(`Incline input "surface" ${inputs.surface} names no surface pair`);
  return surface;
}

/** Static friction holds the block while the pull down the ramp is at most μs·N: tanθ ≤ μs. */
function slides(inputs: Inputs): boolean {
  const theta = (inputs.angle ?? 0) * DEG;
  return Math.sin(theta) > surfaceOf(inputs).staticFriction * Math.cos(theta);
}

const DISTANCE = 0;
const HEIGHT = 1;
const SPEED = 2;
const ACCELERATION = 3;
const KINETIC = 4;
const POTENTIAL = 5;
const POTENTIAL_LOST = 6;
const FRICTION_WORK = 7;
const MECHANICAL = 8;
const FRICTION = 9;
const NORMAL = 10;
const NET_RATIO = 11;
const SLIDING = 12;
const STATIC_COEFFICIENT = 13;
const KINETIC_COEFFICIENT = 14;

/** Values that follow from the distance s and the speed v. */
function derive(state: Float64Array, inputs: Inputs): void {
  const theta = (inputs.angle ?? 0) * DEG;
  const sin = Math.sin(theta);
  const weight = (inputs.mass ?? 0) * (inputs.gravity ?? 0);
  const normal = weight * Math.cos(theta);
  const sliding = state[SLIDING] === 1;
  const s = state[DISTANCE] ?? 0;
  const v = state[SPEED] ?? 0;
  // Sliding: kinetic friction μk·N. Held: static friction, just what balances the weight's pull.
  const friction = sliding ? surfaceOf(inputs).kineticFriction * normal : weight * sin;
  const height = ((inputs.length ?? 0) - s) * sin;
  const kinetic = 0.5 * (inputs.mass ?? 0) * v * v;
  state[HEIGHT] = height;
  state[KINETIC] = kinetic;
  state[POTENTIAL] = weight * height;
  state[POTENTIAL_LOST] = weight * s * sin;
  state[FRICTION_WORK] = sliding ? friction * s : 0;
  state[MECHANICAL] = kinetic + weight * height;
  state[FRICTION] = friction;
  state[NORMAL] = normal;
  state[NET_RATIO] = (weight * sin - friction) / weight;
}

/**
 * A block let go from rest at the top of a fixed ramp of length L (`length`, m) tilted by θ
 * (`angle`, degrees, converted here), on the surface pair `surface` (`SURFACES`), of mass m
 * (`mass`, kg) in uniform gravity g (`gravity`, m/s²). A simplified teaching model, not a
 * laboratory-grade one: the block is a point that slides without tipping, rolling or bouncing;
 * friction is dry (Coulomb) friction with constant coefficients — static friction holds up to
 * μs·N, kinetic friction is μk·N whatever the speed; there is no air drag; the ramp is rigid and
 * does not move. Along the ramp (down positive) N = m·g·cosθ. If tanθ ≤ μs the block stays put
 * and the run ends at once (static friction m·g·sinθ, no more than μs·N). Otherwise
 * m·a = m·g·sinθ − μk·N, a constant a = g(sinθ − μk·cosθ), independent of m, so s = ½·a·t²,
 * v = a·t: the step is exact, and the step that reaches the foot (s = L) stops there and returns
 * the time it took.
 *
 * Variables: `distance` s slid from the top (m), `height` (L − s)·sinθ of the block above the foot
 * of the ramp (m), `speed` v (m/s), `acceleration` a (m/s²), `kineticEnergy` ½m·v², the
 * `potentialEnergy` m·g·height above the foot and `potentialEnergyLost` m·g·s·sinθ (J),
 * `frictionWork` μk·N·s — the size of the work friction does on the block (it does −μk·N·s),
 * turned into heat (J) — `mechanicalEnergy` kinetic + potential (J), so that
 * mechanicalEnergy + frictionWork stays m·g·L·sinθ; `frictionForce` (N, static or kinetic, its
 * size; it points up the ramp), `normalForce` N (N), `netForceRatio` F_net/(m·g) =
 * sinθ − (f/N)·cosθ, which is sinθ − μk·cosθ while sliding and 0 while held, so a = g·netForceRatio
 * always; `sliding`, 1 when the block slides, else 0; and the chosen surface pair's coefficients
 * `staticFriction` μs and `kineticFriction` μk (from `SURFACES`, constant during a run).
 */
export const inclineModel: SimulationModel = {
  id: 'mechanics.incline',
  inputs: ['angle', 'surface', 'mass', 'length', 'gravity'],
  variables: [
    'distance',
    'height',
    'speed',
    'acceleration',
    'kineticEnergy',
    'potentialEnergy',
    'potentialEnergyLost',
    'frictionWork',
    'mechanicalEnergy',
    'frictionForce',
    'normalForce',
    'netForceRatio',
    'sliding',
    'staticFriction',
    'kineticFriction',
  ],
  predictions: [
    'slides',
    'staticFriction',
    'kineticFriction',
    'criticalAngle',
    'normalForce',
    'staticFrictionLimit',
    'frictionForce',
    'kineticFrictionForce',
    'acceleration',
    'netForce',
    'netForceRatio',
    'gravity',
    'speedSquaredSlope',
    'startEnergy',
    'distance',
    'travelTime',
    'finalSpeed',
    'kineticEnergy',
    'potentialEnergyLost',
    'frictionWork',
    'mechanicalEnergy',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const sliding = slides(inputs);
    state[SLIDING] = sliding ? 1 : 0;
    const { staticFriction, kineticFriction: muK } = surfaceOf(inputs);
    state[STATIC_COEFFICIENT] = staticFriction;
    state[KINETIC_COEFFICIENT] = muK;
    if (sliding) {
      const theta = (inputs.angle ?? 0) * DEG;
      state[ACCELERATION] = (inputs.gravity ?? 0) * (Math.sin(theta) - muK * Math.cos(theta));
    }
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    const a = state[ACCELERATION] ?? 0;
    const s = state[DISTANCE] ?? 0;
    const length = inputs.length ?? 0;
    const left = length - s;
    if (!(a > 0 && left > 0)) return 0; // held by static friction, or at the foot
    const v = state[SPEED] ?? 0;
    const travel = v * dt + 0.5 * a * dt * dt;
    if (travel < left) {
      state[DISTANCE] = s + travel;
      state[SPEED] = v + a * dt;
      derive(state, inputs);
      return dt;
    }
    // Reaches the foot in this step: the positive root of ½a·t² + v·t = left, in the form that
    // adds positive numbers (no cancellation when v² ≫ a·left).
    const t = Math.min(dt, (2 * left) / (v + Math.sqrt(v * v + 2 * a * left)));
    state[DISTANCE] = length;
    state[SPEED] = v + a * t;
    derive(state, inputs);
    return t;
  },

  isComplete: (state, inputs) =>
    state[SLIDING] !== 1 || (state[DISTANCE] ?? 0) >= (inputs.length ?? 0),

  /**
   * The theory, in closed form. N = m·g·cosθ; it slides when tanθ > μs (`slides` 1, else 0), the
   * critical angle being arctan μs (degrees). Held: friction m·g·sinθ, below the limit μs·N, and
   * nothing moves. Sliding: a = g(sinθ − μk·cosθ), the net force down the ramp `netForce` m·a (0
   * when held), `netForceRatio` a/g, the kinetic friction force `kineticFrictionForce` μk·N and the
   * time to the foot √(2L/a) (these two only when it slides: a held block has neither), the speed
   * there √(2aL), and by the work–energy theorem
   * ½m·v² = m·g·L·sinθ − μk·N·L: kinetic energy m·a·L, potential energy lost m·g·L·sinθ (the
   * `startEnergy`, the mechanical energy at the top) and heat μk·N·L. For a line of v² at the foot
   * against L at one angle and surface, the slope 2a; for the kinetic energy at the foot against L,
   * the slope `netForce` (Eₖ = F_net·L); for the heat against s, the slope `kineticFrictionForce`.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const theta = (inputs.angle ?? 0) * DEG;
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    const { staticFriction, kineticFriction } = surfaceOf(inputs);
    const m = inputs.mass ?? 0;
    const g = inputs.gravity ?? 0;
    const length = inputs.length ?? 0;
    const weight = m * g;
    const normal = weight * cos;
    const sliding = slides(inputs);
    const a = sliding ? g * (sin - kineticFriction * cos) : 0;
    const startEnergy = weight * length * sin;
    const theory: Record<string, number> = {
      slides: sliding ? 1 : 0,
      staticFriction,
      kineticFriction,
      criticalAngle: Math.atan(staticFriction) / DEG,
      normalForce: normal,
      staticFrictionLimit: staticFriction * normal,
      frictionForce: sliding ? kineticFriction * normal : weight * sin,
      acceleration: a,
      netForce: m * a,
      netForceRatio: a / g,
      gravity: g,
      speedSquaredSlope: 2 * a,
      startEnergy,
      distance: sliding ? length : 0,
      finalSpeed: Math.sqrt(2 * a * length),
      kineticEnergy: m * a * length,
      potentialEnergyLost: sliding ? startEnergy : 0,
      frictionWork: sliding ? kineticFriction * normal * length : 0,
      mechanicalEnergy: sliding ? m * a * length : startEnergy,
    };
    if (sliding) {
      theory.kineticFrictionForce = kineticFriction * normal;
      theory.travelTime = Math.sqrt((2 * length) / a);
    }
    return theory;
  },
};
