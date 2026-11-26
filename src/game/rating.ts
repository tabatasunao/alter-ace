import { clamp } from '../core/math';
import type { RatingData } from '../data/types';
import type { World } from '../sim/World';

/** How a won sortie rated: the score, its letter, and the factors behind it. */
export interface SortieRating {
  /** Score per enemy × the enemy army's size, rounded. */
  score: number;
  /** Score per enemy in the army; the rank letter comes from it. */
  perEnemy: number;
  letter: string;
  /** Par clear time in seconds for this army size. */
  par: number;
  /** Par time ÷ clear time, clamped. */
  pace: number;
  /** 1 less a share per max HP of damage taken, floored. */
  integrity: number;
  /** 1 plus a bonus for the share of allies alive. */
  line: number;
}

/** The rank letter for a score per enemy. */
export function rankLetter(perEnemy: number, ranks: RatingData['ranks']): string {
  return ranks.find((r) => perEnemy >= r.minScore)?.letter ?? '–';
}

/** How a finished sortie rates (battle.json → rating); null when the ace was lost. */
export function rateSortie(world: World): SortieRating | null {
  if (!world.status.over || !world.status.win) return null;
  const r = world.catalog.battle.rating;
  const s = world.stats;
  const maxHp = world.player?.maxHp ?? 1;
  const par = r.parSecondsPerEnemy * s.enemyTotal;
  const pace = clamp(par / Math.max(1, world.status.endAt), r.paceMin, r.paceMax);
  const integrity = Math.max(r.integrityMin, 1 - r.damagePerMaxHp * (s.dmgTaken / maxHp));
  const line = 1 + (r.lineBonus * Math.max(0, s.allyAlive)) / Math.max(1, s.allyTotal);
  const perEnemy = r.pointsPerEnemy * pace * integrity * line;
  return { score: Math.round(perEnemy * s.enemyTotal), perEnemy, letter: rankLetter(perEnemy, r.ranks), par, pace, integrity, line };
}
