/**
 * Source of randomness for the simulation. Systems depend on this interface, never on
 * Math.random, so a battle replays exactly from its seed (and tests can control it).
 */
export interface Random {
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  chance(probability: number): boolean;
  /** Fisher–Yates shuffle in place; returns the same array. */
  shuffle<T>(items: T[]): T[];
}

/** Seeded PRNG (mulberry32). */
export class SeededRandom implements Random {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = items[i] as T;
      items[i] = items[j] as T;
      items[j] = tmp;
    }
    return items;
  }
}

/** A fresh seed when none is given. Lives outside the sim, so Math.random is fine here. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
