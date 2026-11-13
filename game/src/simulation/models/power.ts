import type { SimulationModel } from '../SimulationModel';
import { circuitModel } from './circuit';

type Inputs = Readonly<Record<string, number>>;

// The circuit's variables come first, in its order, so its own step updates them in place.
const at = (id: string) => circuitModel.variables.indexOf(id);
const VOLTAGE = at('voltage');
const VOLTAGE1 = at('voltage1');
const VOLTAGE2 = at('voltage2');
const CURRENT1 = at('current1');
const CURRENT2 = at('current2');
const POWER1 = circuitModel.variables.length;
const POWER2 = POWER1 + 1;
const VOLTAGE_SQUARED = POWER1 + 2;
const LARGER = POWER1 + 3;

/** Writes what follows from the circuit's state: each resistor's power, U² and which takes more. */
function derive(state: Float64Array): void {
  const power1 = (state[VOLTAGE1] ?? NaN) * (state[CURRENT1] ?? NaN);
  const power2 = (state[VOLTAGE2] ?? NaN) * (state[CURRENT2] ?? NaN);
  const voltage = state[VOLTAGE] ?? NaN;
  state[POWER1] = power1;
  state[POWER2] = power2;
  state[VOLTAGE_SQUARED] = voltage * voltage;
  state[LARGER] = Math.sign(power1 - power2);
}

/**
 * Electrical power, P = U·I — a simplified teaching model, not a lab-grade one. The circuit is the
 * DC circuit model `electric.dc-circuit` itself, reused, not copied (its inputs, its refusals,
 * its time): an ideal supply `voltage` U (V) drives, through the switch K and an ideal ammeter,
 * the resistors R1 alone, R1 + R2 in series or R1 ∥ R2 in parallel (`configuration` 0, 1, 2;
 * `resistance1`, `resistance2` in Ω), K closing at `switchTime` and the run ending at `duration`
 * (s). Its variables come first in this model's state and its step advances them. The power is
 * P = U·I for the circuit and Pk = Uk·Ik for each resistor (= Ik²·Rk = Uk²/Rk, as they are ohmic),
 * so P = P1 + P2: in series the larger resistance takes the larger power, in parallel the smaller.
 * The resistors keep their resistance (the circuit model's): no heating is modelled.
 *
 * Variables: the circuit's (`clock` t in s, `switch`, `voltage` U, `current` I, `power` P = U·I,
 * `resistance` U/I, `energy` E, `voltage1`/`voltage2`, `current1`/`current2`), then `power1`,
 * `power2` (W), `voltageSquared` U² (V²) and `largerPower`, the sign of P1 − P2 (+1 R1 takes more,
 * −1 R2, 0 neither: switch open, no voltage or equal powers).
 */
export const powerModel: SimulationModel = {
  id: 'electric.power',
  inputs: circuitModel.inputs,
  variables: [...circuitModel.variables, 'power1', 'power2', 'voltageSquared', 'largerPower'],
  predictions: [
    ...(circuitModel.predictions ?? []),
    'power1',
    'power2',
    'voltageSquared',
    'conductance',
    'largerPower',
  ],

  init(inputs, state) {
    circuitModel.init(inputs, state);
    derive(state);
  },

  step(state, dt, inputs) {
    const advanced = circuitModel.step(state, dt, inputs);
    derive(state);
    return advanced;
  },

  isComplete: (state, inputs) => circuitModel.isComplete?.(state, inputs) ?? false,

  /**
   * The theory: the circuit's (R_eq, U, I, P = U²/R_eq, E, each resistor's U and I), each
   * resistor's power Pk = Uk·Ik; U² and the slope of P against it, 1/R_eq (`conductance`, W/V²);
   * which resistor takes more power.
   */
  predict(inputs: Inputs) {
    const network = circuitModel.predict?.(inputs) ?? {};
    const power1 = (network.voltage1 ?? NaN) * (network.current1 ?? NaN);
    const power2 = (network.voltage2 ?? NaN) * (network.current2 ?? NaN);
    const voltage = network.voltage ?? NaN;
    return {
      ...network,
      power1,
      power2,
      voltageSquared: voltage * voltage,
      conductance: 1 / (network.equivalentResistance ?? NaN),
      largerPower: Math.sign(power1 - power2),
    };
  },
};
