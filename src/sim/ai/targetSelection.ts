import { ENEMY, type Soldier, type Unit } from '../entities';
import type { World } from '../World';

/**
 * Who an AI unit should shoot, in priority order: a nearby decoy (enemies only), the ace (hunters
 * within aceHuntRange, or at any distance once they stalk it), else the nearest hostile in sight.
 */
export function chooseTarget(world: World, u: Soldier): Unit | null {
  if (u.team === ENEMY) {
    for (const d of world.decoys) {
      if (!d.alive) continue;
      const dx = d.x - u.x;
      const dy = d.y - u.y;
      if (dx * dx + dy * dy < d.pullRadius * d.pullRadius) return d;
    }
  }
  const P = world.player;
  if ((u.stalking || u.hunter) && P && P.alive) {
    const range = u.stalking ? Infinity : world.catalog.battle.balance.aceHuntRange;
    const dx = P.x - u.x;
    const dy = P.y - u.y;
    if (dx * dx + dy * dy < range * range) return P;
  }
  return world.grid.nearestHostile(u.x, u.y, u.team, world.catalog.battle.ai.sightRange);
}
