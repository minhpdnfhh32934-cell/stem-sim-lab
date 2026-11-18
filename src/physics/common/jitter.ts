/** A fixed pseudo-random number in [0, 1) for particle k (the same picture every time). */
export const jitter = (k: number, salt: number) => {
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
