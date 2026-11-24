import type { Player, Soldier } from '../entities';
import type { SpatialGrid } from '../SpatialGrid';

export interface AimContext {
  readonly player: Player;
  readonly grid: SpatialGrid;
}

/**
 * An aim mode's ranking rule. Lower score = better target.
 * To add an aim mode: implement this, register it below, and add an entry to aimModes.json.
 */
export interface AimStrategy {
  score(target: Soldier, distanceSq: number, ctx: AimContext): number;
}

/** Scores are layered: a primary key scaled by 1e7, then distance as the tie-break. */
const TIER = 1e7;

export const AIM_STRATEGIES: Readonly<Record<string, AimStrategy>> = {
  closest: { score: (_u, d) => d },
  furthest: { score: (_u, d) => -d },
  weakest: { score: (u, d) => u.hp * TIER + d },
  strongest: { score: (u, d) => -(u.def.rank * 1e4 + u.hp) * TIER + d },
  cluster: { score: (u, d, ctx) => -ctx.grid.clusterAt(u.cell) * TIER + d },
  attackers: { score: (u, d, ctx) => (u.target === ctx.player ? 0 : 1e13) + d },
};

export function aimStrategy(name: string): AimStrategy {
  const s = AIM_STRATEGIES[name];
  if (!s) throw new Error(`No aim strategy "${name}"`);
  return s;
}
