// A small seeded random number generator (mulberry32). The same seed always builds
// the same city and the same screenshot scenes, which keeps the game testable.

export function createRandom(seed) {
  let state = (seed | 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}
