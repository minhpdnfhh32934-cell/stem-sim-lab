import { describe, expect, it } from 'vitest';
import { decimalComma, isFraction, layoutFormula, type Item } from './formula';
import { speakFormula } from './formulaSpeech';

/** A layout written back as text: _{sub}, ^{sup}, [num | den], units marked with «». */
const show = (items: readonly Item[]): string =>
  items
    .map((i) =>
      isFraction(i)
        ? `[${show(i.num)} | ${show(i.den)}]`
        : i.level === 'sub'
          ? `_{${i.text}}`
          : i.level === 'sup'
            ? `^{${i.text}}`
            : i.unit
              ? `«${i.text}»`
              : i.text,
    )
    .join('');

describe('formulas written as a teacher writes them', () => {
  it('subscripts low, exponents raised, primes kept', () => {
    expect(show(layoutFormula('m_A·u_A = m_A·v_A′ + m_B·v_B′'))).toBe(
      'm_{A}·u_{A} = m_{A}·v_{A}′ + m_{B}·v_{B}′',
    );
    expect(show(layoutFormula("v_B' − v_A' = e·u_A"))).toBe("v_{B}' − v_{A}' = e·u_{A}");
    expect(show(layoutFormula('E = e^(−t/τ) and x^2'))).toBe('E = e^{−t/τ} and x^{2}');
    expect(show(layoutFormula('V_max and t_AB'))).toBe('V_{max} and t_{AB}');
  });

  it('a division of quantities a fraction, the numerator the whole product', () => {
    expect(show(layoutFormula('1/f = 1/u + 1/v'))).toBe('[1 | f] = [1 | u] + [1 | v]');
    expect(show(layoutFormula('a = m·g/(M + m)'))).toBe('a = [m·g | M + m]');
    expect(show(layoutFormula('P = U²/R'))).toBe('P = [U² | R]');
    expect(show(layoutFormula('t = √(2h/g)'))).toBe('t = √([2h | g])');
    expect(show(layoutFormula('k = Ea/RT'))).toBe('k = [Ea | RT]');
  });

  it('units, words and a written colon stay as they are; a unit after a number is marked', () => {
    expect(show(layoutFormula('u_A = 0.4 m/s; e = 1'))).toBe('u_{A} = 0.4 «m/s»; e = 1');
    expect(show(layoutFormula('c = 4200 J/(kg·K), g = 9.8 m/s²'))).toBe(
      'c = 4200 «J/(kg·K)», g = 9.8 «m/s²»',
    );
    expect(show(layoutFormula('kinds (choice, true/false), beats/min'))).toBe(
      'kinds (choice, true/false), beats/min',
    );
    expect(show(layoutFormula("Newton's law: 12 : 4 = 3"))).toBe("Newton's law: 12 : 4 = 3");
  });

  it('keeps where each run came from, for text written letter by letter', () => {
    const items = layoutFormula('x = m_A');
    const sub = items.find((i) => !isFraction(i) && i.level === 'sub');
    expect(sub && !isFraction(sub) ? sub.from : -1).toBe(6);
    const frac = layoutFormula('y = 1/f')[1];
    expect(frac && isFraction(frac) ? [frac.from, frac.to] : null).toEqual([4, 7]);
  });

  it('Vietnamese decimals with a comma', () => {
    expect(decimalComma('m_A = 0.5 kg; u_A = 0.4 m/s; 12 V')).toBe(
      'm_A = 0,5 kg; u_A = 0,4 m/s; 12 V',
    );
  });
});

describe('formulas read aloud as a teacher reads them', () => {
  it('Vietnamese', () => {
    expect(speakFormula('m_A·u_A = m_A·v_A′ + m_B·v_B′', 'vi')).toBe(
      'm A nhân u A bằng m A nhân v A phẩy cộng m B nhân v B phẩy',
    );
    expect(speakFormula('u_A = 0.4 m/s; e = 1', 'vi')).toBe('u A bằng 0,4 mét trên giây; e bằng 1');
    expect(speakFormula('1/f = 1/u + 1/v', 'vi')).toBe('1 trên f bằng 1 trên u cộng 1 trên v');
    expect(speakFormula('P = U²/R; g = 9.8 m/s²', 'vi')).toBe(
      'P bằng U bình phương trên R; g bằng 9,8 mét trên giây bình phương',
    );
    expect(speakFormula('Δt = 2 s, θ = 30°, λ = 650 nm', 'vi')).toBe(
      'đen-ta t bằng 2 giây, tê-ta bằng 30 độ, lam-đa bằng 650 na-nô-mét',
    );
    expect(speakFormula('Cu²⁺ + 2e → Cu; Cl⁻', 'vi')).toBe(
      'Cu 2 cộng cộng 2e tạo thành Cu; Cl trừ',
    );
    expect(speakFormula('t = √(2h/g); 12 : 4 = 3; x = −2', 'vi')).toBe(
      't bằng căn (2h trên g); 12 chia 4 bằng 3; x bằng âm 2',
    );
    expect(speakFormula('HR_max = 208 − 0.7·20; k = −v/u', 'vi')).toBe(
      'H R max bằng 208 trừ 0,7 nhân 20; k bằng âm v trên u', // an acronym letter by letter
    );
    expect(speakFormula('CH₃COOH ⇌ H⁺ + CH₃COO⁻; CO₂ và H₂O', 'vi')).toBe(
      'C H 3 C O O H thuận nghịch H cộng cộng C H 3 C O O trừ; C O 2 và H 2 O',
    );
  });

  it('English', () => {
    expect(speakFormula('m_A·u_A = 0.5 kg·m/s', 'en')).toBe(
      'm A times u A equals 0.5 kilograms metres per seconds',
    );
    expect(speakFormula('E = e^(−t/τ)', 'en')).toBe(
      'E equals e to the power minus t divided by tau',
    );
  });
});
