import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const LAB_TIME = 0;
const MASS = 1;
const PERCENT = 2;
const SOLUTION_POTENTIAL = 3;
const TISSUE_POTENTIAL = 4;
const DIFFERENCE = 5;
const DIRECTION = 6;

/** The molar gas constant R, J/(mol·K): exact in the 2019 SI (CODATA 2018). */
export const GAS_CONSTANT = 8.314462618;
/** 0 °C in kelvin, by definition. */
const ZERO_CELSIUS = 273.15;
/** The van 't Hoff factor of sucrose: it does not dissociate in water. */
const SUCROSE_I = 1;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). Concentrations stop at 1.5 mol/L (the ideal
 * van 't Hoff value is far off there, see `osmosisModel`); temperatures stay where potato tissue is
 * alive (its membranes leak from about 50 °C).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['concentration', (c) => c >= 0 && c <= 1.5, 'from 0 to 1.5 mol/L'],
  ['temperature', (t) => t >= 0 && t <= 45, 'from 0 to 45 °C'],
  ['initialMass', (m) => m > 0 && m <= 1000, 'above 0 and at most 1000 g'],
  ['isotonicConcentration', (c) => c > 0 && c <= 1.5, 'above 0 and at most 1.5 mol/L'],
  ['tissueModulus', (e) => e >= 100 && e <= 1e5, 'from 100 to 1e5 kPa'],
  ['timeConstant', (t) => t > 0 && t <= 1e6, 'above 0 and at most 1e6 s'],
  ['soakTime', (t) => t > 0 && t <= 1e6, 'above 0 and at most 1e6 s'],
  ['timeLapse', (k) => k >= 1 && k <= 1e4, 'from 1 to 1e4'],
];

/** R·T (J/mol = kPa·L/mol), so R·T·C with C in mol/L is in kPa. */
const rtOf = (inputs: Inputs) => GAS_CONSTANT * ((inputs.temperature ?? NaN) + ZERO_CELSIUS);

/** The water-potential difference at the start, Ψ_solution − Ψ_tissue = i·R·T·(C_iso − C), kPa. */
const startDifference = (inputs: Inputs) =>
  SUCROSE_I *
  rtOf(inputs) *
  ((inputs.isotonicConcentration ?? NaN) - (inputs.concentration ?? NaN));

/** The fractional mass change u = Δm/m₀ the cylinder tends to: ΔΨ₀/E. */
const equilibriumFraction = (inputs: Inputs) =>
  startDifference(inputs) / (inputs.tissueModulus ?? NaN);

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Osmosis input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Osmosis input "${id}" must be ${rule}, got ${value}`);
  }
  const u = equilibriumFraction(inputs);
  // Only water moves: raw potato is about 79 % water (USDA FoodData Central), so it cannot lose
  // more than that; refusing past 80 % keeps the mass positive, not the model realistic there.
  if (!(u > -0.8)) {
    throw new Error(
      `Osmosis: the cylinder would lose ${(-100 * u).toFixed(0)} % of its mass, more than the ` +
        `water it holds; lower the concentration or raise the tissue modulus`,
    );
  }
  // A stated bound, not a measured limit: cell walls cannot stretch the tissue to double its mass.
  if (!(u < 1)) {
    throw new Error(
      `Osmosis: the cylinder would gain ${(100 * u).toFixed(0)} % of its mass, more than its ` +
        `cell walls can hold; raise the concentration or the tissue modulus`,
    );
  }
}

/** Values that follow from u = Δm/m₀: mass, percent change, potentials and the flow direction. */
function derive(state: Float64Array, u: number, inputs: Inputs): void {
  const e = inputs.tissueModulus ?? NaN;
  const rt = rtOf(inputs);
  const difference = startDifference(inputs) - e * u;
  state[MASS] = (inputs.initialMass ?? NaN) * (1 + u);
  state[PERCENT] = 100 * u;
  state[SOLUTION_POTENTIAL] = 0 - SUCROSE_I * (inputs.concentration ?? NaN) * rt; // 0 − x: never −0
  state[TISSUE_POTENTIAL] = -SUCROSE_I * (inputs.isotonicConcentration ?? NaN) * rt + e * u;
  state[DIFFERENCE] = difference;
  state[DIRECTION] = Math.sign(difference);
}

/**
 * Osmosis in a potato cylinder soaked in a sucrose solution: a simplified teaching model, not a
 * model of real tissue to lab precision. Units as a biology lab uses them: mass in g, sucrose in
 * mol/L, temperature in °C, water potential Ψ in kPa (R·T·C, with C in mol/L, is in kPa), time in
 * s. Positive Δm and ΔΨ mean water flows into the tissue.
 *
 * The solution's water potential is its solute potential, by van 't Hoff for an ideal dilute
 * solution: Ψ_solution = −i·C·R·T, i = 1 for sucrose. That is the ideal value: real sucrose
 * solutions are more negative, as their molality exceeds their molarity and their osmotic
 * coefficient exceeds 1 — by roughly 5–10 % at 0.25 mol/L, 15 % at 0.5 and 30–40 % at 1 mol/L
 * (about −3.4 MPa against the ideal −2.44 MPa; our own estimate from sucrose's density and osmotic
 * coefficient, not a cited table). The tissue starts at Ψ_iso = −i·C_iso·R·T: it is
 * taken to be in balance with sucrose at its isotonic concentration C_iso (`isotonicConcentration`,
 * about 0.2–0.3 mol/L for potato tuber in school experiments — an approximate, variety- and
 * storage-dependent value, given as a stated constant). As it takes up water its potential rises
 * linearly with its fractional mass change u = Δm/m₀: Ψ_tissue = Ψ_iso + E·u. E
 * (`tissueModulus`, kPa) is one effective constant chosen so the percent changes are of the size
 * school experiments report; it lumps the wall's stiffness and the dilution of the cell sap and is
 * not a measured property. Real tissue is not linear: stiffer as it swells against its walls,
 * softer once plasmolysed, and its loss levels off at high concentrations.
 *
 * Water flows down the potential difference at a rate proportional to it,
 * du/dt = (Ψ_solution − Ψ_tissue)/(E·τ), so u relaxes to u_eq = ΔΨ₀/E (ΔΨ₀ = i·R·T·(C_iso − C))
 * as u_eq·(1 − e^(−t/τ)). τ (`timeConstant`, s) is a stated teaching value, one rate for every
 * concentration, temperature and cylinder length (the borer fixes the diameter, through which
 * water moves); real rates also rise with temperature, which this model leaves out.
 *
 * Temperature enters only through R·T, with E fixed, so here a warmer run moves the equilibrium a
 * little (∝ T in K). That is a side effect of the model, not physics: where the tissue has no
 * turgor (plasmolysed) both potentials scale with R·T and the equilibrium does not depend on T.
 * Temperature is therefore meant as a fixed condition, not as a variable to investigate. The sucrose
 * does not enter the tissue and the solution is large enough that its concentration stays C.
 *
 * Time is compressed: a soak of `soakTime` lab seconds (hours, as in a school lab) is shown at
 * `timeLapse` lab seconds per run second; `labTime` is the soaking time the run represents. Each
 * step advances u by the exact solution of the flow law over its lab time, so the step size
 * changes where samples fall, never the curve. The run ends when the soak is over, the last step
 * taking only the time it needs.
 *
 * Variables: `labTime` (s of soaking), `mass` (g), `percentChange` 100·u (%),
 * `solutionPotential` and `tissuePotential` (kPa), `potentialDifference` Ψ_solution − Ψ_tissue
 * (kPa) and `direction`, its sign: +1 water in, −1 water out, 0 no net flow.
 */
export const osmosisModel: SimulationModel = {
  id: 'biology.osmosis',
  inputs: [
    'concentration',
    'temperature',
    'initialMass',
    'isotonicConcentration',
    'tissueModulus',
    'timeConstant',
    'soakTime',
    'timeLapse',
  ],
  variables: [
    'labTime',
    'mass',
    'percentChange',
    'solutionPotential',
    'tissuePotential',
    'potentialDifference',
    'direction',
  ],
  predictions: [
    'solutionPotential',
    'tissuePotential',
    'potentialDifference',
    'direction',
    'equilibriumPercent',
    'finalPercent',
    'finalMass',
    'percentSlope',
    'percentIntercept',
    'isotonicConcentration',
    'timeConstant',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, 0, inputs);
  },

  step(state, dt, inputs) {
    const soak = inputs.soakTime ?? NaN;
    const lapse = inputs.timeLapse ?? NaN;
    const time = state[LAB_TIME] ?? 0;
    if (!(time < soak)) return 0; // the soak is over
    const reached = time + lapse * dt >= soak;
    const h = reached ? soak - time : lapse * dt;
    const ueq = equilibriumFraction(inputs);
    const u = (state[PERCENT] ?? 0) / 100;
    state[LAB_TIME] = reached ? soak : time + h;
    derive(state, ueq + (u - ueq) * Math.exp(-h / (inputs.timeConstant ?? NaN)), inputs);
    return reached ? h / lapse : dt;
  },

  isComplete: (state, inputs) => (state[LAB_TIME] ?? 0) >= (inputs.soakTime ?? NaN),

  /**
   * The theory, in closed form: Ψ_solution, Ψ_tissue at the start and their difference ΔΨ₀ (kPa);
   * the direction of the net flow, sign(ΔΨ₀); the percent change at equilibrium, 100·ΔΨ₀/E, and
   * after the soak, that times 1 − e^(−t_soak/τ); the mass then; for percent change against C at
   * one temperature, a straight line with slope −100·i·R·T·(1 − e^(−t_soak/τ))/E (%/(mol/L)) and
   * intercept at C = 0, `percentIntercept`, so it crosses 0 % at C_iso (`isotonicConcentration`);
   * and τ.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const rt = rtOf(inputs);
    const e = inputs.tissueModulus ?? NaN;
    const cIso = inputs.isotonicConcentration ?? NaN;
    const reach = 1 - Math.exp(-(inputs.soakTime ?? NaN) / (inputs.timeConstant ?? NaN));
    const difference = startDifference(inputs);
    const equilibriumPercent = (100 * difference) / e;
    const finalPercent = equilibriumPercent * reach;
    const percentSlope = (-100 * SUCROSE_I * rt * reach) / e;
    return {
      solutionPotential: 0 - SUCROSE_I * (inputs.concentration ?? NaN) * rt,
      tissuePotential: -SUCROSE_I * cIso * rt,
      potentialDifference: difference,
      direction: Math.sign(difference),
      equilibriumPercent,
      finalPercent,
      finalMass: (inputs.initialMass ?? NaN) * (1 + finalPercent / 100),
      percentSlope,
      percentIntercept: -percentSlope * cIso,
      isotonicConcentration: cIso,
      timeConstant: inputs.timeConstant ?? NaN,
    };
  },
};
