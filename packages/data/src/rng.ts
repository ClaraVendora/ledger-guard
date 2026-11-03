/** Seeded PRNG (mulberry32) so a run is reproducible: same seed, same store, same alerts. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    /** approximately normal via sum of uniforms */
    normal: (mean: number, sd: number) => {
      let s = 0;
      for (let i = 0; i < 6; i++) s += next();
      return mean + ((s - 3) / Math.sqrt(0.5)) * sd;
    },
  };
}
export type Rng = ReturnType<typeof makeRng>;
