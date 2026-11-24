import type { World } from '../sim/World';

/** The ace rating letter for the share of the enemy army the player destroyed. */
export function aceRank(share: number, ranks: readonly { letter: string; minShare: number }[]): string {
  return ranks.find((r) => share >= r.minShare)?.letter ?? '–';
}

/** How a finished sortie rates: the share of the enemy army the ace destroyed itself, and its letter. */
export function rateSortie(world: World): { share: number; letter: string } {
  const share = world.stats.kills / world.stats.enemyTotal;
  return { share, letter: aceRank(share, world.catalog.battle.ranks) };
}
